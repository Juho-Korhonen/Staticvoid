"""What changed in a Wikipedia article between two dates.

Reads the M dataset (Parquet, one row per article version) with DuckDB.
No HTTP here so it can be reused from scripts and tests.
"""

from __future__ import annotations

import hashlib
import os
import secrets
import threading
from datetime import datetime
from pathlib import Path

import duckdb

from .dates import iso
from .diff import DEFAULT_CONTEXT_LINES, diff_texts
from .search import parse_terms, snippet
from .wiki import page_url

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "m"
DEFAULT_LIMIT = 20
DEFAULT_MAX_REVISIONS = 200
# Building the full-text table scans all 12 GB of text; DuckDB's memory for that grows
# with the thread count (≈2.6 GB extra kept at 16 threads, ≈0.7 GB at 4), so cap it.
BUILD_THREADS = 4

META_COLUMNS = ("rev_id", "parent_id", "timestamp", "title", "user", "anonymous",
                "comment", "minor", "sha1", "bytes")

ANONYMOUS_PREFIX = "anon:"  # the frontend shows these editors as anonymous
ANONYMOUS_ID_BYTES = 6
# Keyed, so a pseudonym cannot be matched to an IP address by hashing every address.
_ANONYMOUS_KEY = secrets.token_bytes(hashlib.blake2b.MAX_KEY_SIZE)


class NotFound(Exception):
    pass


def _rows(cur: duckdb.DuckDBPyConnection, sql: str, params=None) -> list[dict]:
    """Query result as dicts keyed by column name."""
    result = cur.execute(sql, params)
    names = [d[0] for d in result.description]
    return [dict(zip(names, row)) for row in result.fetchall()]


def _window(in_range: list[dict], baseline: dict | None, max_revisions: int | None):
    """Revisions to return, the version the first of them is diffed against, and whether some were cut."""
    if max_revisions is None or len(in_range) <= max_revisions:
        return in_range, baseline, False
    first = len(in_range) - max_revisions
    return in_range[first:], in_range[first - 1], True


def _revert_targets(history: list[dict]) -> dict[int, int]:
    """rev_id -> earlier rev_id whose exact text it restores (not merely an unchanged predecessor)."""
    first_with_sha: dict[str, dict] = {}
    targets: dict[int, int] = {}
    prev_sha = None
    for m in history:
        sha = m["sha1"]
        if sha:
            earlier = first_with_sha.setdefault(sha, m)
            if earlier["rev_id"] != m["rev_id"] and sha != prev_sha:
                targets[m["rev_id"]] = earlier["rev_id"]
        prev_sha = sha
    return targets


def _brief(m: dict | None) -> dict | None:
    if m is None:
        return None
    return {"rev_id": m["rev_id"], "timestamp": iso(m["timestamp"]),
            "title": m["title"], "bytes": m["bytes"]}


def _editor(m: dict) -> str | None:
    """The user name; an IP editor's address never leaves the server, only a stable pseudonym."""
    if not (m["anonymous"] and m["user"]):
        return m["user"]
    digest = hashlib.blake2b(m["user"].encode(), key=_ANONYMOUS_KEY, digest_size=ANONYMOUS_ID_BYTES)
    return ANONYMOUS_PREFIX + digest.hexdigest()


def _revision_entry(m: dict, prev: dict | None, diff: dict, revert_of: int | None) -> dict:
    prev_bytes = prev["bytes"] if prev else 0
    return {
        "rev_id": m["rev_id"],
        "before_rev_id": prev["rev_id"] if prev else None,
        "parent_id": m["parent_id"],
        "timestamp": iso(m["timestamp"]),
        "title": m["title"],
        "user": _editor(m),
        "anonymous": bool(m["anonymous"]),
        "minor": bool(m["minor"]),
        "comment": m["comment"],
        "bytes": m["bytes"],
        "bytes_delta": (m["bytes"] or 0) - (prev_bytes or 0),
        "is_new_page": prev is None,
        "is_revert": revert_of is not None,
        "revert_to_rev_id": revert_of,
        **diff,
    }


def _summary(in_range: list[dict], revisions: list[dict], baseline: dict | None, final: dict | None,
             reverts: dict[int, int]) -> dict:
    return {
        "revisions": len(in_range),
        "returned": len(revisions),
        "editors": len({m["user"] for m in in_range}),
        "anonymous_edits": sum(1 for m in in_range if m["anonymous"]),
        "minor_edits": sum(1 for m in in_range if m["minor"]),
        "reverts": sum(1 for m in in_range if m["rev_id"] in reverts),
        "bytes_start": baseline["bytes"] if baseline else 0,
        "bytes_end": final["bytes"] if final else 0,
    }


class ChangesStore:
    def __init__(self, data_dir: str | Path | None = None):
        data_dir = Path(data_dir or os.environ.get("DATA_DIR") or DEFAULT_DATA_DIR)
        files = sorted(data_dir.glob("versions-*.parquet"))
        if not files:
            raise FileNotFoundError(f"no versions-*.parquet in {data_dir}")
        self._lock = threading.Lock()
        self.con = duckdb.connect()
        self.con.execute("SET TimeZone='UTC'")
        self._create_view(files)
        self._build_indexes()
        threads = self.con.execute("SELECT current_setting('threads')").fetchone()[0]
        self.con.execute(f"SET threads={min(threads, BUILD_THREADS)}")
        try:
            self._build_latest()
        finally:
            self.con.execute(f"SET threads={threads}")

    def _create_view(self, files: list[Path]) -> None:
        file_list = ", ".join("'" + str(f).replace("'", "''") + "'" for f in files)
        self.con.execute(f"CREATE VIEW versions AS SELECT * FROM read_parquet([{file_list}])")

    def _build_indexes(self) -> None:
        # Small title index (no text column): every title a page has had.
        self.con.execute(
            """
            CREATE TABLE titles AS
            SELECT page_id, title, max(timestamp) AS last_seen
            FROM versions GROUP BY page_id, title
            """
        )
        self.con.execute(
            """
            CREATE TABLE pages AS
            SELECT page_id, arg_max(title, timestamp) AS title,
                   count(*) AS n_versions,
                   min(timestamp) AS created, max(timestamp) AS last_edit
            FROM versions GROUP BY page_id
            """
        )

    def _build_latest(self) -> None:
        """Text of each page's latest version, for full-text search (~19.7k rows, ~135 MB)."""
        self.con.execute(
            """
            CREATE TABLE latest AS
            WITH last AS (
                SELECT page_id, max_by(rev_id, (timestamp, rev_id)) AS rev_id
                FROM versions GROUP BY page_id
            )
            SELECT v.page_id, v.rev_id, coalesce(v.text, '') AS text,
                   regexp_matches(coalesce(v.text, ''), '^\\s*#(ohjaus|redirect)', 'i') AS is_redirect
            FROM versions v SEMI JOIN last ON v.page_id = last.page_id AND v.rev_id = last.rev_id
            """
        )

    def _cursor(self) -> duckdb.DuckDBPyConnection:
        # A cursor per call: DuckDB connections are not safe to share across threads.
        with self._lock:
            return self.con.cursor()

    # ---- lookup -------------------------------------------------------

    def search(self, q: str, limit: int = DEFAULT_LIMIT) -> list[dict]:
        return _rows(
            self._cursor(),
            """
            SELECT page_id, title, n_versions FROM (
                SELECT p.page_id, p.title, p.n_versions,
                       min(CASE WHEN lower(t.title) = lower($q) THEN 0
                                WHEN starts_with(lower(t.title), lower($q)) THEN 1
                                ELSE 2 END) AS rank
                FROM titles t JOIN pages p USING (page_id)
                WHERE contains(lower(t.title), lower($q))
                GROUP BY ALL
            )
            ORDER BY rank, n_versions DESC, page_id
            LIMIT $limit
            """,
            {"q": q, "limit": limit},
        )

    def search_text(self, q: str, limit: int = DEFAULT_LIMIT, offset: int = 0) -> dict:
        """Articles whose current text (or title) contains every term of `q`.

        Case-insensitive substring match; `"double quotes"` keep a phrase together.
        Ranked by how many terms are in the title, then by number of occurrences.
        """
        terms = parse_terms(q)
        if not terms:
            return {"query": q, "terms": [], "total": 0, "results": []}
        params: dict = {"limit": limit, "offset": offset}
        where, hits, title_hits = [], [], []
        for i, term in enumerate(terms):
            params[f"t{i}"] = term
            where.append(f"(contains(lt, $t{i}) OR contains(ltitle, $t{i}))")
            hits.append(f"(strlen(lt) - strlen(replace(lt, $t{i}, ''))) // strlen($t{i})")
            title_hits.append(f"contains(ltitle, $t{i})::INT")
        rows = _rows(
            self._cursor(),
            f"""
            WITH m AS (
                SELECT l.page_id, p.title, p.n_versions, p.last_edit, l.rev_id, l.text,
                       lower(l.text) AS lt, lower(p.title) AS ltitle
                FROM latest l JOIN pages p USING (page_id)
                WHERE NOT l.is_redirect
            )
            SELECT page_id, title, n_versions, last_edit, rev_id, text,
                   {" + ".join(hits)} AS hits,
                   {" + ".join(title_hits)} AS title_hits,
                   count(*) OVER () AS total
            FROM m
            WHERE {" AND ".join(where)}
            ORDER BY title_hits DESC, hits DESC, page_id
            LIMIT $limit OFFSET $offset
            """,
            params,
        )
        return {
            "query": q,
            "terms": terms,
            "total": rows[0]["total"] if rows else 0,
            "results": [
                {
                    "page_id": r["page_id"],
                    "title": r["title"],
                    "n_versions": r["n_versions"],
                    "last_edit": iso(r["last_edit"]),
                    "rev_id": r["rev_id"],
                    "hits": r["hits"],
                    "snippet": snippet(r["text"], terms),
                    "url": page_url(r["page_id"]),
                }
                for r in rows
            ],
        }

    def resolve_page(self, title: str | None = None, page_id: int | None = None) -> int:
        cur = self._cursor()
        if page_id is not None:
            row = cur.execute("SELECT page_id FROM pages WHERE page_id = ?", [page_id]).fetchone()
            if not row:
                raise NotFound(f"page_id {page_id} not found")
            return row[0]
        if not title or not title.strip():
            raise ValueError("title or page_id required")
        title = title.strip().replace("_", " ")
        # Prefer an exact match, then case-insensitive; among those the most recently used title.
        row = cur.execute(
            """
            SELECT page_id FROM titles
            WHERE lower(title) = lower(?)
            ORDER BY (title = ?) DESC, last_seen DESC
            LIMIT 1
            """,
            [title, title],
        ).fetchone()
        if not row:
            raise NotFound(f"title {title!r} not found")
        return row[0]

    # ---- changes ------------------------------------------------------

    def _history(self, cur, page_id: int, end: datetime) -> list[dict]:
        """Metadata (no text) of every version before `end`: cheap, and lets us
        detect reverts to any earlier version, not only ones inside the range."""
        return _rows(
            cur,
            f"""
            SELECT {", ".join(META_COLUMNS)} FROM versions
            WHERE page_id = ? AND timestamp < ?
            ORDER BY timestamp, rev_id
            """,
            [page_id, end],
        )

    def _texts(self, cur, page_id: int, rev_ids: set[int]) -> dict[int, str]:
        if not rev_ids:
            return {}
        ids = sorted(rev_ids)
        rows = cur.execute(
            f"""
            SELECT rev_id, text FROM versions
            WHERE page_id = ? AND rev_id IN ({",".join("?" * len(ids))})
            """,
            [page_id, *ids],
        ).fetchall()
        return {rev_id: text or "" for rev_id, text in rows}

    def _page_info(self, cur, page_id: int) -> dict | None:
        rows = _rows(cur, "SELECT title, n_versions, created, last_edit FROM pages WHERE page_id = ?", [page_id])
        return rows[0] if rows else None

    def get_changes(
        self,
        page_id: int,
        start: datetime,
        end: datetime,
        max_revisions: int | None = DEFAULT_MAX_REVISIONS,
        context_lines: int = DEFAULT_CONTEXT_LINES,
        word_details: bool = True,
    ) -> dict:
        if start >= end:
            raise ValueError("start must be before end")
        cur = self._cursor()
        history = self._history(cur, page_id, end)
        in_range = [m for m in history if m["timestamp"] >= start]
        before = [m for m in history if m["timestamp"] < start]
        baseline = before[-1] if before else None
        final = in_range[-1] if in_range else baseline
        kept, prev, truncated = _window(in_range, baseline, max_revisions)

        texts = self._texts(cur, page_id, {m["rev_id"] for m in (*kept, prev, baseline, final) if m})

        def text_of(m: dict | None) -> str:
            return texts.get(m["rev_id"], "") if m else ""

        reverts = _revert_targets(history)
        revisions = []
        for m in kept:
            diff = diff_texts(text_of(prev), text_of(m), context_lines, word_details)
            revisions.append(_revision_entry(m, prev, diff, reverts.get(m["rev_id"])))
            prev = m

        page = self._page_info(cur, page_id)
        return {
            "page_id": page_id,
            "title": page["title"] if page else None,
            "page": {
                "n_versions": page["n_versions"],
                "created": iso(page["created"]),
                "last_edit": iso(page["last_edit"]),
                "url": page_url(page_id),
            } if page else None,
            "range": {"start": iso(start), "end": iso(end)},
            "baseline": _brief(baseline),
            "final": _brief(final),
            "summary": _summary(in_range, revisions, baseline, final, reverts),
            "revisions": revisions,
            "net_change": diff_texts(text_of(baseline), text_of(final), context_lines, word_details),
            "truncated": truncated,
        }
