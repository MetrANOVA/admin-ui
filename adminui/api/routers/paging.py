"""Paging, search and sort for the mock list endpoints.

Mirrors what was proposed for the real API (MetrANOVA/api#42): optional
`limit`, `offset`, `q`, `sort` and `order` query parameters, the total in an
`X-Total-Count` response header, and the body left as a plain list. With no
parameters a caller gets the whole list, exactly as before.
"""

from typing import Any, Iterable, Optional

from fastapi import Response

MAX_LIMIT = 500


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return " ".join(_text(item) for item in value)
    return str(value)


def _sort_key(value: Any):
    # None sorts last; numbers before text so mixed columns still order sanely.
    if value is None:
        return (2, "")
    if isinstance(value, bool):
        return (0, int(value))
    if isinstance(value, (int, float)):
        return (0, value)
    return (1, _text(value).lower())


def paginate(
    items: Iterable[dict],
    response: Response,
    *,
    limit: Optional[int],
    offset: int,
    q: Optional[str],
    sort: Optional[str],
    order: str,
    search_fields: Optional[list[str]] = None,
    default_sort: str = "id",
) -> list[dict]:
    rows = list(items)

    needle = (q or "").strip().lower()
    if needle:
        rows = [
            row
            for row in rows
            if any(
                needle in _text(row.get(field)).lower()
                for field in (search_fields or row.keys())
            )
        ]

    # Always order by something, so rows do not move between pages.
    key = sort if sort and rows and sort in rows[0] else default_sort
    rows.sort(key=lambda row: _sort_key(row.get(default_sort)))
    rows.sort(key=lambda row: _sort_key(row.get(key)), reverse=order == "desc")

    response.headers["X-Total-Count"] = str(len(rows))
    if limit is None:
        return rows[offset:]
    return rows[offset : offset + min(limit, MAX_LIMIT)]
