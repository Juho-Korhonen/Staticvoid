"""Parsing and formatting of UTC timestamps."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone

# An unencoded "+" in a query string arrives as a space: "...T12:00:00 02:00".
_SPACE_AS_PLUS = re.compile(r"(T[\d:.]+) (\d\d:?\d\d)$")


def parse_when(value: str | datetime | date) -> datetime:
    """ISO date or datetime -> aware UTC datetime. Naive input is taken as UTC."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day)
    else:
        text = _SPACE_AS_PLUS.sub(r"\1+\2", value.strip().replace("Z", "+00:00"))
        dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
