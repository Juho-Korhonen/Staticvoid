"""Links to Finnish Wikipedia pages and revisions."""

from __future__ import annotations

WIKI_INDEX_URL = "https://fi.wikipedia.org/w/index.php"


def page_url(page_id: int) -> str:
    return f"{WIKI_INDEX_URL}?curid={page_id}"


def revision_sources(before_id: int | None, after_id: int | None) -> dict:
    """Links to the earlier and later revisions and the diff between them."""
    has_both = before_id is not None and after_id is not None
    return {
        "before": f"{WIKI_INDEX_URL}?oldid={before_id}" if before_id is not None else None,
        "after": f"{WIKI_INDEX_URL}?oldid={after_id}" if after_id is not None else None,
        "diff": f"{WIKI_INDEX_URL}?oldid={before_id}&diff={after_id}" if has_both else None,
    }
