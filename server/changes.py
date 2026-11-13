"""Core logic: what changed in a Wikipedia article between two dates.

Reads the M dataset (Parquet, one row per article version) with DuckDB.
No HTTP here so it can be reused from scripts and tests.
"""

from __future__ import annotations

import difflib
import os
import re
import threading
from datetime import date, datetime, timezone
from pathlib import Path

import duckdb

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "m"

META_COLS = "rev_id, parent_id, timestamp, title, user, anonymous, comment, minor, sha1, bytes"


class NotFound(Exception):
    pass


def parse_when(value: str | datetime | date) -> datetime:
    """ISO date or datetime -> aware UTC datetime. Naive input is taken as UTC."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day)
    else:
        s = value.strip().replace("Z", "+00:00")
        # An unencoded "+" in a query string arrives as a space: "...T12:00:00 02:00".
        s = re.sub(r"(T[\d:.]+) (\d\d:?\d\d)$", r"\1+\2", s)
        dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


_TOKEN = re.compile(r"\s+|\w+|[^\w\s]", re.UNICODE)
MAX_WORD_CHANGES = 200
WORD_CONTEXT = 6  # tokens of context on each side


def word_changes(old_line: str, new_line: str) -> list[dict]:
    """Word-level edits inside one changed paragraph (wikitext paragraphs are long lines)."""
    a, b = _TOKEN.findall(old_line), _TOKEN.findall(new_line)
    out = []
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        out.append(
            {
                "before": "".join(a[i1:i2]),
                "after": "".join(b[j1:j2]),
                "context": "".join(b[max(0, j1 - WORD_CONTEXT):j1])
                + "[[CHANGE]]"
                + "".join(b[j2:j2 + WORD_CONTEXT]),
            }
        )
    return out


def diff_texts(old: str, new: str, context_lines: int = 2) -> dict:
    """Line diff of two wikitexts, plus word-level detail for edited paragraphs."""
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    added: list[str] = []
    removed: list[str] = []
    words: list[dict] = []
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ("replace", "delete"):
            removed.extend(old_lines[i1:i2])
        if tag in ("replace", "insert"):
            added.extend(new_lines[j1:j2])
        if tag == "replace" and len(words) < MAX_WORD_CHANGES:
            # Pair up paragraphs that were edited in place.
            for ol, nl in zip(old_lines[i1:i2], new_lines[j1:j2]):
                if difflib.SequenceMatcher(None, ol, nl, autojunk=False).quick_ratio() > 0.6:
                    words.extend(word_changes(ol, nl))
    words = words[:MAX_WORD_CHANGES]
    unified = "\n".join(
        difflib.unified_diff(old_lines, new_lines, n=context_lines, lineterm="")
    )
    # Drop the "--- / +++" header lines, they carry no information here.
    if unified.startswith("---"):
        unified = unified.split("\n", 2)[2] if unified.count("\n") >= 2 else ""
    return {"added": added, "removed": removed, "word_changes": words, "unified_diff": unified}


class ChangesStore:
    def __init__(self, data_dir: str | Path | None = None):
        data_dir = Path(data_dir or os.environ.get("DATA_DIR") or DEFAULT_DATA_DIR)
        files = sorted(data_dir.glob("versions-*.parquet"))
        if not files:
            raise FileNotFoundError(f"no versions-*.parquet in {data_dir}")
        self._lock = threading.Lock()
        self.con = duckdb.connect()
        self.con.execute("SET TimeZone='UTC'")
        file_list = ", ".join("'" + str(f).replace("'", "''") + "'" for f in files)
        self.con.execute(
            f"CREATE VIEW versions AS SELECT * FROM read_parquet([{file_list}])"
        )
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
            SELECT v.page_id, arg_max(v.title, v.timestamp) AS title,
                   count(*) AS n_versions,
                   min(v.timestamp) AS created, max(v.timestamp) AS last_edit
            FROM versions v GROUP BY v.page_id
            """
        )

    def _cursor(self) -> duckdb.DuckDBPyConnection:
        # A cursor per call: DuckDB connections are not safe to share across threads.
        with self._lock:
            return self.con.cursor()

    # ---- lookup -------------------------------------------------------

    def search(self, q: str, limit: int = 20) -> list[dict]:
        cur = self._cursor()
        rows = cur.execute(
            """
            SELECT p.page_id, p.title, p.n_versions,
                   min(CASE WHEN lower(t.title) = lower($q) THEN 0
                            WHEN lower(t.title) LIKE lower($q) || '%' THEN 1
                            ELSE 2 END) AS rank
            FROM titles t JOIN pages p USING (page_id)
            WHERE t.title ILIKE '%' || $q || '%'
            GROUP BY ALL
            ORDER BY rank, p.n_versions DESC
            LIMIT $limit
            """,
            {"q": q, "limit": limit},
        ).fetchall()
        return [{"page_id": r[0], "title": r[1], "n_versions": r[2]} for r in rows]

    def resolve_page(self, title: str | None = None, page_id: int | None = None) -> int:
        cur = self._cursor()
        if page_id is not None:
            row = cur.execute("SELECT page_id FROM pages WHERE page_id = ?", [page_id]).fetchone()
            if not row:
                raise NotFound(f"page_id {page_id} not found")
            return row[0]
        if not title:
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

    def get_changes(
        self,
        page_id: int,
        start: datetime,
        end: datetime,
        max_revisions: int = 200,
        context_lines: int = 2,
    ) -> dict:
        if start >= end:
            raise ValueError("start must be before end")
        cur = self._cursor()

        # Metadata (no text) of every version up to `end`: cheap, and lets us
        # detect reverts to any earlier version, not only ones inside the range.
        meta = cur.execute(
            f"""
            SELECT {META_COLS} FROM versions
            WHERE page_id = ? AND timestamp < ?
            ORDER BY timestamp, rev_id
            """,
            [page_id, end],
        ).fetchall()
        cols = [c.strip() for c in META_COLS.split(",")]
        meta = [dict(zip(cols, r)) for r in meta]

        before = [m for m in meta if m["timestamp"] < start]
        in_range = [m for m in meta if m["timestamp"] >= start]
        baseline = before[-1] if before else None

        truncated = len(in_range) > max_revisions
        kept = in_range[-max_revisions:] if max_revisions > 0 else []
        # The version each kept revision is diffed against.
        if truncated:
            prev_of_first = in_range[-max_revisions - 1] if max_revisions > 0 else in_range[-1]
        else:
            prev_of_first = baseline

        need = {m["rev_id"] for m in kept}
        for m in (baseline, prev_of_first, in_range[-1] if in_range else None):
            if m is not None:
                need.add(m["rev_id"])
        texts: dict[int, str] = {}
        if need:
            ids = sorted(need)
            rows = cur.execute(
                f"""
                SELECT rev_id, text FROM versions
                WHERE page_id = ? AND rev_id IN ({",".join("?" * len(ids))})
                """,
                [page_id, *ids],
            ).fetchall()
            texts = {r[0]: r[1] or "" for r in rows}

        # sha1 -> first version that had it (for revert detection).
        first_with_sha: dict[str, dict] = {}
        index_of: dict[int, int] = {}
        for i, m in enumerate(meta):
            index_of[m["rev_id"]] = i
            if m["sha1"] and m["sha1"] not in first_with_sha:
                first_with_sha[m["sha1"]] = m

        revisions = []
        prev = prev_of_first
        for m in kept:
            old_text = texts.get(prev["rev_id"], "") if prev else ""
            new_text = texts.get(m["rev_id"], "")
            d = diff_texts(old_text, new_text, context_lines)
            # Revert: text identical to an older version that is not the direct predecessor.
            revert_of = None
            if m["sha1"] and m["sha1"] in first_with_sha:
                earlier = first_with_sha[m["sha1"]]
                i = index_of[m["rev_id"]]
                if earlier["rev_id"] != m["rev_id"] and (i == 0 or meta[i - 1]["sha1"] != m["sha1"]):
                    revert_of = earlier["rev_id"]
            prev_bytes = prev["bytes"] if prev else 0
            revisions.append(
                {
                    "rev_id": m["rev_id"],
                    "parent_id": m["parent_id"],
                    "timestamp": iso(m["timestamp"]),
                    "title": m["title"],
                    "user": m["user"],
                    "anonymous": bool(m["anonymous"]),
                    "minor": bool(m["minor"]),
                    "comment": m["comment"],
                    "bytes": m["bytes"],
                    "bytes_delta": (m["bytes"] or 0) - (prev_bytes or 0),
                    "is_new_page": prev is None,
                    "is_revert": revert_of is not None,
                    "revert_to_rev_id": revert_of,
                    **d,
                }
            )
            prev = m

        final = in_range[-1] if in_range else baseline
        if in_range:
            net = diff_texts(
                texts.get(baseline["rev_id"], "") if baseline else "",
                texts.get(final["rev_id"], ""),
                context_lines,
            )
        else:
            net = {"added": [], "removed": [], "word_changes": [], "unified_diff": ""}

        page = cur.execute(
            "SELECT title, n_versions, created, last_edit FROM pages WHERE page_id = ?", [page_id]
        ).fetchone()

        def brief(m):
            if m is None:
                return None
            return {"rev_id": m["rev_id"], "timestamp": iso(m["timestamp"]),
                    "title": m["title"], "bytes": m["bytes"]}

        return {
            "page_id": page_id,
            "title": page[0] if page else None,
            "page": {
                "n_versions": page[1],
                "created": iso(page[2]),
                "last_edit": iso(page[3]),
                "url": f"https://fi.wikipedia.org/w/index.php?curid={page_id}",
            } if page else None,
            "range": {"start": iso(start), "end": iso(end)},
            "baseline": brief(baseline),
            "final": brief(final),
            "summary": {
                "revisions": len(in_range),
                "returned": len(revisions),
                "editors": len({m["user"] for m in in_range}),
                "anonymous_edits": sum(1 for m in in_range if m["anonymous"]),
                "minor_edits": sum(1 for m in in_range if m["minor"]),
                "reverts": sum(1 for r in revisions if r["is_revert"]),
                "bytes_start": baseline["bytes"] if baseline else 0,
                "bytes_end": final["bytes"] if final else 0,
            },
            "revisions": revisions,
            "net_change": net,
            "truncated": truncated,
        }
