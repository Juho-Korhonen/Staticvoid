"""What changed in a Wikipedia article between two dates.

Reads the M dataset from a MariaDB system-versioned table (see load_mariadb.py):
`article` is each page's current version, `FOR SYSTEM_TIME` reaches the earlier ones.
No HTTP here so it can be reused from scripts and tests.
"""

from __future__ import annotations

import hashlib
import secrets
from contextlib import contextmanager
from datetime import datetime, timezone

from .dates import iso
from .db import connect
from .diff import DEFAULT_CONTEXT_LINES, diff_texts
from .search import parse_terms, snippet
from .wiki import page_url

DEFAULT_LIMIT = 20
DEFAULT_MAX_REVISIONS = 200
REDIRECT = r"(?i)^\s*#(ohjaus|redirect)"

ANONYMOUS_PREFIX = "anon:"  # the frontend shows these editors as anonymous
ANONYMOUS_ID_BYTES = 6
# Keyed, so a pseudonym cannot be matched to an IP address by hashing every address.
_ANONYMOUS_KEY = secrets.token_bytes(hashlib.blake2b.MAX_KEY_SIZE)


class NotFound(Exception):
    pass


def _rows(cur, sql: str, params=None) -> list[dict]:
    """Query result as dicts keyed by column name; MariaDB's naive timestamps are UTC."""
    cur.execute(sql, params)
    return [{name: value.replace(tzinfo=timezone.utc) if isinstance(value, datetime) else value
             for name, value in row.items()} for row in cur.fetchall()]


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
    def __init__(self):
        with self._cursor() as cur:
            if not cur.execute("SHOW TABLES LIKE 'page'"):
                raise RuntimeError("the database is empty; run: python -m server.load_mariadb")

    @contextmanager
    def _cursor(self):
        # A connection per call: they are not safe to share across threads.
        con = connect()
        try:
            with con.cursor() as cur:
                yield cur
        finally:
            con.close()

    # ---- lookup -------------------------------------------------------

    def search(self, q: str, limit: int = DEFAULT_LIMIT) -> list[dict]:
        with self._cursor() as cur:
            return _rows(
                cur,
                """
                SELECT page_id, title, n_versions FROM (
                    SELECT p.page_id, p.title, p.n_versions,
                           min(CASE WHEN lower(t.title) = lower(%(q)s) THEN 0
                                    WHEN locate(lower(%(q)s), lower(t.title)) = 1 THEN 1
                                    ELSE 2 END) AS match_rank
                    FROM page_title t JOIN page p USING (page_id)
                    WHERE locate(lower(%(q)s), lower(t.title)) > 0
                    GROUP BY p.page_id, p.title, p.n_versions
                ) AS matches
                ORDER BY match_rank, n_versions DESC, page_id
                LIMIT %(limit)s
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
        params: dict = {"limit": limit, "offset": offset, "redirect": REDIRECT}
        where, hits, title_hits = [], [], []
        for i, term in enumerate(terms):
            params[f"t{i}"] = term
            where.append(f"(locate(%(t{i})s, lt) > 0 OR locate(%(t{i})s, ltitle) > 0)")
            hits.append(f"(char_length(lt) - char_length(replace(lt, %(t{i})s, ''))) DIV char_length(%(t{i})s)")
            title_hits.append(f"(locate(%(t{i})s, ltitle) > 0)")
        with self._cursor() as cur:
            rows = _rows(
                cur,
                # Without FOR SYSTEM_TIME, `article` is every page's current version.
                f"""
                WITH m AS (
                    SELECT a.page_id, p.title, p.n_versions, p.last_edit, a.rev_id, a.text,
                           lower(a.text) AS lt, lower(p.title) AS ltitle
                    FROM article a JOIN page p USING (page_id)
                    WHERE NOT coalesce(a.text, '') REGEXP %(redirect)s
                )
                SELECT page_id, title, n_versions, last_edit, rev_id, text,
                       {" + ".join(hits)} AS hits,
                       {" + ".join(title_hits)} AS title_hits,
                       count(*) OVER () AS total
                FROM m
                WHERE {" AND ".join(where)}
                ORDER BY title_hits DESC, hits DESC, page_id
                LIMIT %(limit)s OFFSET %(offset)s
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
                    "hits": int(r["hits"]),
                    "snippet": snippet(r["text"] or "", terms),
                    "url": page_url(r["page_id"]),
                }
                for r in rows
            ],
        }

    def resolve_page(self, title: str | None = None, page_id: int | None = None) -> int:
        with self._cursor() as cur:
            if page_id is not None:
                rows = _rows(cur, "SELECT page_id FROM page WHERE page_id = %s", [page_id])
                if not rows:
                    raise NotFound(f"page_id {page_id} not found")
                return rows[0]["page_id"]
            if not title or not title.strip():
                raise ValueError("title or page_id required")
            title = title.strip().replace("_", " ")
            # Prefer an exact match, then case-insensitive; among those the most recently used title.
            rows = _rows(
                cur,
                """
                SELECT page_id FROM page_title
                WHERE lower(title) = lower(%s)
                ORDER BY (title = %s) DESC, last_seen DESC
                LIMIT 1
                """,
                [title, title],
            )
            if not rows:
                raise NotFound(f"title {title!r} not found")
            return rows[0]["page_id"]

    # ---- changes ------------------------------------------------------

    def _history(self, cur, page_id: int, end: datetime) -> list[dict]:
        """Metadata (no text) of every version before `end`: cheap, and lets us
        detect reverts to any earlier version, not only ones inside the range."""
        return _rows(
            cur,
            # A version's system-time period starts when it was saved. The cast keeps dates
            # outside the TIMESTAMP range comparable.
            """
            SELECT rev_id, parent_id, row_start AS timestamp, title, user, anonymous, comment, minor, sha1, bytes
            FROM article FOR SYSTEM_TIME ALL
            WHERE page_id = %s AND row_start < CAST(%s AS DATETIME(6))
            ORDER BY row_start
            """,
            [page_id, end],
        )

    def _texts(self, cur, page_id: int, rev_ids: set[int]) -> dict[int, str]:
        if not rev_ids:
            return {}
        ids = sorted(rev_ids)
        rows = _rows(
            cur,
            f"""
            SELECT rev_id, text FROM article FOR SYSTEM_TIME ALL
            WHERE page_id = %s AND rev_id IN ({",".join(["%s"] * len(ids))})
            """,
            [page_id, *ids],
        )
        return {row["rev_id"]: row["text"] or "" for row in rows}

    def _page_info(self, cur, page_id: int) -> dict | None:
        rows = _rows(cur, "SELECT title, n_versions, created, last_edit FROM page WHERE page_id = %s", [page_id])
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
        with self._cursor() as cur:
            history = self._history(cur, page_id, end)
            page = self._page_info(cur, page_id)
        in_range = [m for m in history if m["timestamp"] >= start]
        before = [m for m in history if m["timestamp"] < start]
        baseline = before[-1] if before else None
        final = in_range[-1] if in_range else baseline
        kept, prev, truncated = _window(in_range, baseline, max_revisions)

        with self._cursor() as cur:
            texts = self._texts(cur, page_id, {m["rev_id"] for m in (*kept, prev, baseline, final) if m})

        def text_of(m: dict | None) -> str:
            return texts.get(m["rev_id"], "") if m else ""

        reverts = _revert_targets(history)
        revisions = []
        for m in kept:
            diff = diff_texts(text_of(prev), text_of(m), context_lines, word_details)
            revisions.append(_revision_entry(m, prev, diff, reverts.get(m["rev_id"])))
            prev = m

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
