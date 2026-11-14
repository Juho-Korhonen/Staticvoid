"""Line and word diffs of two wikitexts."""

from __future__ import annotations

import difflib
import re

_TOKEN = re.compile(r"\s+|\w+|[^\w\s]", re.UNICODE)
MAX_WORD_CHANGES = 200
WORD_CONTEXT = 6  # tokens of context on each side
# Paragraphs at least this similar are treated as one paragraph edited in place.
SAME_PARAGRAPH_RATIO = 0.6
_BLOCK_KIND = {"replace": "modified", "insert": "added", "delete": "removed"}
_UNIFIED_HEADER_LINES = 2  # "---" and "+++"
DEFAULT_CONTEXT_LINES = 2


def _matcher(a, b) -> difflib.SequenceMatcher:
    return difflib.SequenceMatcher(None, a, b, autojunk=False)


def word_changes(old_line: str, new_line: str) -> list[dict]:
    """Word-level edits inside one changed paragraph (wikitext paragraphs are long lines)."""
    a, b = _TOKEN.findall(old_line), _TOKEN.findall(new_line)
    return [
        {
            "before": "".join(a[i1:i2]),
            "after": "".join(b[j1:j2]),
            "context": "".join(b[max(0, j1 - WORD_CONTEXT):j1])
            + "[[CHANGE]]"
            + "".join(b[j2:j2 + WORD_CONTEXT]),
        }
        for tag, i1, i2, j1, j2 in _matcher(a, b).get_opcodes()
        if tag != "equal"
    ]


def _paired_word_changes(old_lines: list[str], new_lines: list[str]) -> list[dict]:
    """Word changes of paragraphs that were edited in place."""
    out = []
    for old, new in zip(old_lines, new_lines):
        if _matcher(old, new).quick_ratio() > SAME_PARAGRAPH_RATIO:
            out.extend(word_changes(old, new))
    return out


def _unified_diff(old_lines: list[str], new_lines: list[str], context_lines: int) -> str:
    lines = list(difflib.unified_diff(old_lines, new_lines, n=context_lines, lineterm=""))
    # The "--- / +++" header lines carry no information here.
    return "\n".join(lines[_UNIFIED_HEADER_LINES:])


def diff_texts(old: str, new: str, context_lines: int = DEFAULT_CONTEXT_LINES, word_details: bool = True) -> dict:
    """Line diff of two wikitexts, plus word-level detail for edited paragraphs."""
    old_lines, new_lines = old.splitlines(), new.splitlines()
    added: list[str] = []
    removed: list[str] = []
    words: list[dict] = []
    blocks: list[dict] = []
    for tag, i1, i2, j1, j2 in _matcher(old_lines, new_lines).get_opcodes():
        if tag == "equal":
            continue
        old_part, new_part = old_lines[i1:i2], new_lines[j1:j2]
        blocks.append({
            "kind": _BLOCK_KIND[tag],
            "oldText": "\n".join(old_part) if old_part else None,
            "newText": "\n".join(new_part) if new_part else None,
        })
        removed.extend(old_part)
        added.extend(new_part)
        if word_details and tag == "replace" and len(words) < MAX_WORD_CHANGES:
            words.extend(_paired_word_changes(old_part, new_part))
    return {
        "added": added,
        "removed": removed,
        "word_changes": words[:MAX_WORD_CHANGES],
        "unified_diff": _unified_diff(old_lines, new_lines, context_lines),
        "blocks": blocks,
    }
