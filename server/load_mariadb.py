"""Load the M dataset into a MariaDB system-versioned table.

    python -m server.load_mariadb [--pages N]

`article` holds one row per page: its current version. Every earlier version is a
history row whose system-time period is the time that version was the live one, so
`FOR SYSTEM_TIME AS OF <date>` returns the article as it read on that date.
Does nothing when the database is already loaded.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import duckdb

from .db import connect

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "m"
BATCH_ROWS = 500  # versions per round trip; pymysql splits them into statements of about 1 MB

SCHEMA = (
    "DROP TABLE IF EXISTS page, page_title, article",
    """
    CREATE TABLE article (
        page_id INT UNSIGNED NOT NULL,
        rev_id INT UNSIGNED NOT NULL,
        parent_id INT UNSIGNED,
        title VARCHAR(255) NOT NULL,
        `user` VARCHAR(255),
        anonymous BOOLEAN NOT NULL,
        `comment` TEXT,
        minor BOOLEAN NOT NULL,
        sha1 VARCHAR(40),
        bytes INT UNSIGNED,
        `text` LONGTEXT COMPRESSED,
        row_start TIMESTAMP(6) GENERATED ALWAYS AS ROW START,
        row_end TIMESTAMP(6) GENERATED ALWAYS AS ROW END,
        PERIOD FOR SYSTEM_TIME (row_start, row_end),
        PRIMARY KEY (page_id),
        KEY (rev_id)
    ) WITH SYSTEM VERSIONING CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
    """,
)

# Small lookup tables for title search, derived from the full history. `page` is created
# last: its presence marks a complete load.
INDEXES = (
    """
    CREATE TABLE page_title (
        page_id INT UNSIGNED NOT NULL, title VARCHAR(255) NOT NULL, last_seen DATETIME(6) NOT NULL,
        PRIMARY KEY (page_id, title)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
    SELECT page_id, title, max(row_start) AS last_seen
    FROM article FOR SYSTEM_TIME ALL GROUP BY page_id, title
    """,
    """
    CREATE TABLE page (
        page_id INT UNSIGNED PRIMARY KEY, title VARCHAR(255) NOT NULL, n_versions INT UNSIGNED NOT NULL,
        created DATETIME(6) NOT NULL, last_edit DATETIME(6) NOT NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
    SELECT h.page_id, a.title, count(*) AS n_versions, min(h.row_start) AS created, max(h.row_start) AS last_edit
    FROM article FOR SYSTEM_TIME ALL AS h JOIN article AS a USING (page_id)
    GROUP BY h.page_id, a.title
    """,
)

# When each version became the live one, and when the next one replaced it. Versions of a
# page saved in the same second are spaced a microsecond apart, so no period is empty.
PERIODS = """
    CREATE TABLE periods AS
    WITH started AS (
        SELECT page_id, rev_id,
               timestamp + to_microseconds(row_number() OVER (PARTITION BY page_id, timestamp ORDER BY rev_id) - 1)
                   AS row_start
        FROM versions
    )
    SELECT page_id, rev_id, row_start,
           lead(row_start) OVER (PARTITION BY page_id ORDER BY row_start) AS row_end
    FROM started
"""

TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S.%f"
COLUMNS = ("page_id", "rev_id", "parent_id", "title", "user", "anonymous", "comment", "minor",
           "sha1", "bytes", "text", "row_start", "row_end")
INSERT = (f"INSERT INTO article ({', '.join(f'`{c}`' for c in COLUMNS)}) "
          f"VALUES ({', '.join(['%s'] * len(COLUMNS))})")


def _is_loaded(cur) -> bool:
    return bool(cur.execute("SHOW TABLES LIKE 'page'"))


def _current_row_end(cur) -> str:
    """The `row_end` that marks a current row; it depends on the server version."""
    cur.execute("CREATE OR REPLACE TABLE row_end_probe (x INT) WITH SYSTEM VERSIONING")
    cur.execute("INSERT INTO row_end_probe VALUES (1)")
    cur.execute("SELECT row_end FROM row_end_probe")
    row_end = cur.fetchone()["row_end"]
    cur.execute("DROP TABLE row_end_probe")
    return row_end.strftime(TIMESTAMP_FORMAT)


def _versions(files: list[Path], pages: int | None) -> duckdb.DuckDBPyConnection:
    duck = duckdb.connect()
    duck.execute("SET TimeZone='UTC'")
    file_list = ", ".join("'" + str(f).replace("'", "''") + "'" for f in files)
    wanted = f"WHERE page_id IN (SELECT DISTINCT page_id FROM all_versions ORDER BY page_id LIMIT {int(pages)})" if pages else ""
    duck.execute(f"CREATE VIEW all_versions AS SELECT * FROM read_parquet([{file_list}])")
    duck.execute(f"CREATE VIEW versions AS SELECT * FROM all_versions {wanted}")
    duck.execute(PERIODS)
    return duck


def load(data_dir: Path, pages: int | None = None) -> None:
    files = sorted(data_dir.glob("versions-*.parquet"))
    if not files:
        raise FileNotFoundError(f"no versions-*.parquet in {data_dir}")
    con = connect()
    with con, con.cursor() as cur:
        if _is_loaded(cur):
            print("Already loaded.")
            return
        for statement in SCHEMA:
            cur.execute(statement)
        current_row_end = _current_row_end(cur)
        duck = _versions(files, pages)
        total = duck.execute("SELECT count(*) FROM periods").fetchone()[0]
        # Lets the history rows be inserted with the periods they had on Wikipedia.
        cur.execute("SET system_versioning_insert_history = ON")
        rows = duck.execute(
            f"""
            SELECT v.page_id, v.rev_id, v.parent_id, v.title, v.user, v.anonymous, v.comment, v.minor,
                   v.sha1, v.bytes, v.text,
                   strftime(p.row_start AT TIME ZONE 'UTC', '{TIMESTAMP_FORMAT}'),
                   coalesce(strftime(p.row_end AT TIME ZONE 'UTC', '{TIMESTAMP_FORMAT}'), ?)
            FROM versions v JOIN periods p USING (page_id, rev_id)
            """,
            [current_row_end],
        )
        done = 0
        while batch := rows.fetchmany(BATCH_ROWS):
            cur.executemany(INSERT, batch)
            con.commit()
            done += len(batch)
            print(f"\r{done}/{total} versions", end="", flush=True)
        print()
        for statement in INDEXES:
            cur.execute(statement)
        con.commit()
    print("Loaded.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--pages", type=int, help="load only the first N articles, for a quick trial")
    load(Path(os.environ.get("DATA_DIR") or DEFAULT_DATA_DIR), parser.parse_args().pages)
