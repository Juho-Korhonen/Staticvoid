"""Search query parsing and readable snippets of wikitext."""

from __future__ import annotations

import re

_QUERY_TERM = re.compile(r'"([^"]+)"|(\S+)')
MAX_TERMS = 10
SNIPPET_CHARS = 120  # of context on each side of the first hit
MAX_TEMPLATE_DEPTH = 5  # templates nest; the innermost ones are stripped repeatedly
ELLIPSIS = "…"

_COMMENT = re.compile(r"<!--.*?-->", re.S)
_REF = re.compile(r"<ref[^>/]*/>|<ref[^>]*>.*?</ref>", re.S | re.I)
_TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")
_TABLE = re.compile(r"\{\|.*?\|\}", re.S)
_MEDIA_OR_CATEGORY = re.compile(
    r"\[\[(?:Tiedosto|Kuva|File|Image|Luokka|Category):[^\[\]]*(?:\[\[[^\]]*\]\][^\[\]]*)*\]\]", re.I
)
_WIKILINK = re.compile(r"\[\[([^\]|]*\|)?([^\]]*)\]\]")  # [[target|label]] -> label
_EXTERNAL_LINK = re.compile(r"\[https?://\S+\s*([^\]]*)\]")  # [url label] -> label
_HTML_TAG = re.compile(r"<[^>]+>")
_EMPHASIS_OR_HEADING = re.compile(r"'{2,}|^=+\s*|\s*=+$", re.M)


def parse_terms(q: str) -> list[str]:
    """Search query -> lowercase terms; quoted phrases stay one term."""
    out: list[str] = []
    for phrase, word in _QUERY_TERM.findall(q):
        term = " ".join((phrase or word.strip('"')).split()).lower()
        if term and term not in out:
            out.append(term)
    return out[:MAX_TERMS]


def plain_text(wikitext: str) -> str:
    """Rough wikitext -> readable text, good enough for search snippets."""
    s = _REF.sub("", _COMMENT.sub("", wikitext))
    for _ in range(MAX_TEMPLATE_DEPTH):
        s, n = _TEMPLATE.subn("", s)
        if not n:
            break
    s = _TABLE.sub("", s)
    s = _MEDIA_OR_CATEGORY.sub("", s)
    s = _WIKILINK.sub(r"\2", s)
    s = _EXTERNAL_LINK.sub(r"\1", s)
    s = _HTML_TAG.sub("", s)
    s = _EMPHASIS_OR_HEADING.sub("", s)
    return " ".join(s.split())


def _first_hit(text: str, terms: list[str]) -> int | None:
    low = text.lower()
    hits = [i for i in (low.find(t) for t in terms) if i >= 0]
    return min(hits) if hits else None


def _hit_offsets(piece: str, terms: list[str], shift: int) -> list[list[int]]:
    low = piece.lower()
    matches = []
    for term in terms:
        i = low.find(term)
        while i >= 0:
            matches.append([shift + i, shift + i + len(term)])
            i = low.find(term, i + len(term))
    return sorted(matches)


def snippet(wikitext: str, terms: list[str]) -> dict:
    """Text around the first hit of any term, with the hits' [start, end) offsets in it."""
    text = plain_text(wikitext)
    first = _first_hit(text, terms)
    if first is None:  # hit only inside markup (template, ref, ...): fall back to raw text
        text = " ".join(wikitext.split())
        first = _first_hit(text, terms) or 0
    start = max(0, first - SNIPPET_CHARS)
    end = min(len(text), first + SNIPPET_CHARS)
    # Widen to word boundaries.
    while start > 0 and not text[start - 1].isspace():
        start -= 1
    while end < len(text) and not text[end].isspace():
        end += 1
    lead = ELLIPSIS if start > 0 else ""
    tail = ELLIPSIS if end < len(text) else ""
    piece = text[start:end]
    return {
        "text": lead + piece + tail,
        "matches": _hit_offsets(piece, terms, len(lead)),  # [start, end) offsets into "text"
    }
