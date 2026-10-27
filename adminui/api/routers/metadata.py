"""Mock of the MetrANOVA API's metadata endpoints, as far as the UI uses them.

Paths and response shapes follow the real API (`/metadata`, `/type`); the list
endpoints add the paging parameters proposed in MetrANOVA/api#42.
"""

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Body, HTTPException, Query, Response

from adminui.api.routers import mock_data
from adminui.api.routers.paging import paginate

router = APIRouter(prefix="/metadata", tags=["metadata"])
type_router = APIRouter(prefix="/type", tags=["resource_type"])

Order = Literal["asc", "desc"]


def _type_or_404(slug: str) -> dict:
    type_def = mock_data.TYPES.get(slug)
    if type_def is None:
        raise HTTPException(status_code=404, detail=f"Metadata type '{slug}' not found.")
    return type_def


@type_router.get("/{slug}", summary="One resource type definition")
def get_type(slug: str):
    return _type_or_404(slug)


@router.get("/", summary="Metadata types")
def get_metadata_types(
    response: Response,
    limit: Optional[int] = Query(default=None, ge=1),
    offset: int = Query(default=0, ge=0),
    q: Optional[str] = None,
    sort: Optional[str] = None,
    order: Order = "asc",
):
    return paginate(
        mock_data.TYPES.values(),
        response,
        limit=limit,
        offset=offset,
        q=q,
        sort=sort,
        order=order,
        search_fields=["name", "slug"],
        default_sort="slug",
    )


@router.get("/{slug}", summary="Latest version of every record of a metadata type")
def get_metadata_records(
    slug: str,
    response: Response,
    limit: Optional[int] = Query(default=None, ge=1),
    offset: int = Query(default=0, ge=0),
    q: Optional[str] = None,
    sort: Optional[str] = None,
    order: Order = "asc",
):
    _type_or_404(slug)
    return paginate(
        mock_data.RECORDS[slug],
        response,
        limit=limit,
        offset=offset,
        q=q,
        sort=sort,
        order=order,
    )


@router.put("/{slug}/{mid}/{version}", summary="Update one version of a record")
def update_metadata_version(slug: str, mid: str, version: str, record: dict = Body(...)):
    type_def = _type_or_404(slug)
    rows = mock_data.RECORDS[slug]
    ref = f"{mid}__v{version}"
    current = next((row for row in rows if row["ref"] == ref), None)
    if current is None:
        raise HTTPException(status_code=404, detail=f"Record '{ref}' not found in metadata type '{slug}'.")

    # Same rule as the real API: the identifier fields make up the id.
    for key in type_def["identifier"]:
        if key in record and record[key] != current[key]:
            raise HTTPException(status_code=400, detail="Metadata primary keys cannot be modified.")

    editable = {field["field_name"] for field in type_def["meta_fields"]}
    current.update({key: value for key, value in record.items() if key in editable})
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    current["updated_at"] = now
    current["insert_time"] = now
    return {"id": mid, "ref": ref}
