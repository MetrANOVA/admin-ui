"""Mock of the MetrANOVA API's transformer list, with the paging parameters
proposed in MetrANOVA/api#42."""

from typing import Literal, Optional

from fastapi import APIRouter, Query, Response

from adminui.api.routers import mock_data
from adminui.api.routers.paging import paginate

router = APIRouter(prefix="/transformers", tags=["transformer"])


@router.get("/", summary="Transformers (pipelines)")
def get_all_transformers(
    response: Response,
    definition_ref: Optional[str] = None,
    limit: Optional[int] = Query(default=None, ge=1),
    offset: int = Query(default=0, ge=0),
    q: Optional[str] = None,
    sort: Optional[str] = None,
    order: Literal["asc", "desc"] = "asc",
):
    rows = [
        row
        for row in mock_data.TRANSFORMERS
        if definition_ref is None or row["definition_ref"] == definition_ref
    ]
    return paginate(
        rows,
        response,
        limit=limit,
        offset=offset,
        q=q,
        sort=sort,
        order=order,
        search_fields=["name", "slug", "description"],
        default_sort="created_at",
    )
