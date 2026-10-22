import copy
import re
from datetime import date

from fastapi import APIRouter, HTTPException

from adminui.api.form_schemas.clickhouse_table_schemas import (
    DEFAULT_FIELD_ROW,
    TABLE_SCHEMA,
    TABLE_UI_SCHEMA,
    to_api_request,
)
from adminui.api.mock_data.clickhouse_tables import MOCK_TABLES

router = APIRouter(tags=["tables"])

# In-memory store, seeded with dummy tables. Replace with calls to MetrANOVA/api
# (GET /type/, GET /metadata/, and `POST /type/` or `POST /metadata/` from
# to_api_request) once the frontend talks to the real API.
TABLES = copy.deepcopy(MOCK_TABLES)

TTL_PATTERN = re.compile(r"^\d+\s+(SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|QUARTER|YEAR)$")


def validate_api_request(path: str, body: dict) -> list[str]:
    """Same checks MetrANOVA/api runs on these requests."""
    errors = []
    fields = body["data_fields"] if path == "/type/" else body["fields"]
    names = [f.get("field_name") or f.get("name") for f in fields]

    if not body["name"]:
        errors.append("Table Name is required")
    if not fields:
        errors.append("add at least one field")
    if len(names) != len(set(names)):
        errors.append("field names must be unique")
    if not body["identifier"]:
        errors.append("mark at least one field as a Primary Key")
    if path == "/type/" and not TTL_PATTERN.match(body["ttl"]):
        errors.append("retention must look like '365 DAY'")

    return errors


def table_name_for(path: str, name: str) -> str:
    """The API names tables data_<slug> / meta_<slug>, slug = name.lower() with _ for spaces."""
    prefix = "data" if path == "/type/" else "meta"
    return f"{prefix}_{name.lower().replace(' ', '_')}"


@router.get("/table/new/form/", summary="Return the schema for the new Clickhouse table form")
def get_new_table_form():
    return {
        "json_schema": TABLE_SCHEMA,
        "ui_schema": TABLE_UI_SCHEMA,
        "form_data": {
            "name": "",
            "table_type": "",
            "ttl_value": 365,
            "ttl_unit": "DAY",
            "fields": [dict(DEFAULT_FIELD_ROW), dict(DEFAULT_FIELD_ROW)],
        },
    }


@router.get("/table/", summary="List mock Clickhouse tables")
def list_tables():
    return [
        {key: table[key] for key in ("table_name", "table_type", "created_by", "created_at")}
        for table in TABLES
    ]


@router.get("/table/{table_name}", summary="Return one mock Clickhouse table with its fields")
def get_table(table_name: str):
    for table in TABLES:
        if table["table_name"] == table_name:
            return table
    raise HTTPException(status_code=404, detail=f"No table named {table_name}")


@router.post("/table/", summary="Create a mock Clickhouse table")
def create_table(payload: dict):
    path, body = to_api_request(payload)
    errors = validate_api_request(path, body)

    table_name = table_name_for(path, body["name"])
    if any(table["table_name"] == table_name for table in TABLES):
        errors.append(f"a table named {table_name} already exists")
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    rows = payload.get("fields") or []
    TABLES.insert(
        0,
        {
            "table_name": table_name,
            "table_type": "data" if path == "/type/" else "metadata",
            "ttl": body.get("ttl"),
            "created_by": "ssbaveja@es.net",
            "created_at": date.today().isoformat(),
            "fields": [
                {
                    "field_name": row.get("field_name", ""),
                    "field_type": row.get("field_type", ""),
                    "nullable": bool(row.get("nullable", True)),
                    "primary_key": bool(row.get("primary_key", False)),
                }
                for row in rows
            ],
        },
    )
    return {"path": path, "body": body, "table_name": table_name}
