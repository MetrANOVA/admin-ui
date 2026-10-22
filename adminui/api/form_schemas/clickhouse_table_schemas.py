"""Form schema for the "Create New Clickhouse Table" page.

Follows the design and maps onto MetrANOVA/api, where the
Table Type decides which endpoint is called:

- data      -> POST /type/
               {name, data_fields: [{field_name, field_type, nullable}], identifier, ttl}
- metadata  -> POST /metadata/
               {name, fields: [{name, type, nullable}], identifier}

Things the API decides on its own, so they are not form inputs:
- slug: `name.lower().replace(" ", "_")`, giving tables `data_{slug}` / `meta_{slug}`
- database: from the API's settings
- engine: CoalescingMergeTree (data) / MergeTree (meta), Replicated* when clustered
- reserved columns (collector_id, insert_time, policy_*, ext, ...) are added automatically

Rows ticked as Primary Key become the request's `identifier` list.
"""

TABLE_TYPE_OPTIONS = [
    {"const": "data", "title": "Data Table"},
    {"const": "metadata", "title": "Metadata Table"},
]

TTL_UNITS = ["SECOND", "MINUTE", "HOUR", "DAY", "WEEK", "MONTH", "QUARTER", "YEAR"]

TTL_UNIT_OPTIONS = [{"const": unit, "title": unit.title() + "s"} for unit in TTL_UNITS]

# The API accepts any valid ClickHouse type string; these are the common ones.
FIELD_TYPE_OPTIONS = [
    {"const": "String", "title": "String"},
    {"const": "LowCardinality(String)", "title": "LowCardinality(String)"},
    {"const": "UInt8", "title": "UInt8"},
    {"const": "UInt16", "title": "UInt16"},
    {"const": "UInt32", "title": "UInt32"},
    {"const": "UInt64", "title": "UInt64"},
    {"const": "Int32", "title": "Int32"},
    {"const": "Int64", "title": "Int64"},
    {"const": "Float32", "title": "Float32"},
    {"const": "Float64", "title": "Float64"},
    {"const": "Bool", "title": "Bool"},
    {"const": "Date", "title": "Date"},
    {"const": "DateTime", "title": "DateTime"},
    {"const": "DateTime64(3)", "title": "DateTime64(3)"},
    {"const": "UUID", "title": "UUID"},
    {"const": "IPv4", "title": "IPv4"},
    {"const": "IPv6", "title": "IPv6"},
    {"const": "Array(String)", "title": "Array(String)"},
]

# Column names the API adds to every data/meta table.
RESERVED_FIELD_NAMES = [
    "id",
    "ref",
    "hash",
    "created_at",
    "updated_at",
    "insert_time",
    "collector_id",
    "tag",
    "policy_level",
    "policy_scope",
    "policy_originator",
    "ext",
]

TABLE_SCHEMA = {
    "title": "Schema for creating a new Clickhouse table",
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "title": "Table Name",
            "minLength": 1,
        },
        "table_type": {
            "type": "string",
            "title": "Table Type",
            "oneOf": TABLE_TYPE_OPTIONS,
        },
        # Not in the Figma design yet, but the API requires a TTL for data tables.
        "ttl_value": {
            "type": "integer",
            "title": "Retention",
            "minimum": 1,
        },
        "ttl_unit": {
            "type": "string",
            "title": "Retention Unit",
            "oneOf": TTL_UNIT_OPTIONS,
        },
        "fields": {
            "type": "array",
            "title": "Table Fields",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "field_name": {
                        "type": "string",
                        "title": "Field Name",
                        "minLength": 1,
                        "pattern": "^[A-Za-z_][A-Za-z0-9_]*$",
                        "not": {"enum": RESERVED_FIELD_NAMES},
                    },
                    "field_type": {
                        "type": "string",
                        "title": "Field Type",
                        "oneOf": FIELD_TYPE_OPTIONS,
                    },
                    "primary_key": {
                        "type": "boolean",
                        "title": "Primary Key",
                        "default": False,
                    },
                    "nullable": {
                        "type": "boolean",
                        "title": "Nullable",
                        "default": True,
                    },
                },
                "required": ["field_name", "field_type"],
            },
        },
    },
    "required": ["name", "table_type", "fields"],
    "if": {"properties": {"table_type": {"const": "data"}}},
    "then": {"required": ["ttl_value", "ttl_unit"]},
}

SHOW_FOR_DATA_TABLES = {
    "effect": "SHOW",
    "condition": {"scope": "#/properties/table_type", "schema": {"const": "data"}},
}

TABLE_UI_SCHEMA = {
    "type": "VerticalLayout",
    "elements": [
        {
            "type": "Control",
            "scope": "#/properties/name",
            "customComponent": "pkts-input-text",
            "options": {"placeholder": "Example Copy"},
        },
        {
            "type": "Control",
            "scope": "#/properties/table_type",
            "customComponent": "pkts-select",
            "options": {"placeholder": "Select Option"},
        },
        {
            "type": "HorizontalLayout",
            "rule": SHOW_FOR_DATA_TABLES,
            "elements": [
                {
                    "type": "Control",
                    "scope": "#/properties/ttl_value",
                    "customComponent": "pkts-input-number",
                    "options": {"placeholder": "365"},
                },
                {
                    "type": "Control",
                    "scope": "#/properties/ttl_unit",
                    "customComponent": "pkts-select",
                    "options": {"placeholder": "Select Option"},
                },
            ],
        },
        {
            "type": "Control",
            "scope": "#/properties/fields",
            "options": {
                "detail": {
                    "type": "HorizontalLayout",
                    "elements": [
                        {
                            "type": "Control",
                            "scope": "#/properties/field_name",
                            "customComponent": "pkts-input-text",
                            "options": {"placeholder": "Enter Value"},
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/field_type",
                            "customComponent": "pkts-select",
                            "options": {"placeholder": "Select Option"},
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/primary_key",
                            "customComponent": "pkts-input-checkbox",
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/nullable",
                            "customComponent": "pkts-input-checkbox",
                        },
                    ],
                },
            },
        },
    ],
}

DEFAULT_FIELD_ROW = {"field_name": "", "field_type": "", "primary_key": False, "nullable": True}


def to_api_request(form_data: dict) -> tuple[str, dict]:
    """Convert submitted form data into (MetrANOVA/api path, request body)."""
    rows = form_data.get("fields") or []
    name = (form_data.get("name") or "").strip()
    identifier = [r["field_name"] for r in rows if r.get("primary_key")]

    if form_data.get("table_type") == "metadata":
        return "/metadata/", {
            "name": name,
            "identifier": identifier,
            "fields": [
                {
                    "name": r.get("field_name", ""),
                    "type": r.get("field_type", ""),
                    "nullable": bool(r.get("nullable", True)),
                }
                for r in rows
            ],
        }

    return "/type/", {
        "name": name,
        "data_fields": [
            {
                "field_name": r.get("field_name", ""),
                "field_type": r.get("field_type", ""),
                "nullable": bool(r.get("nullable", True)),
            }
            for r in rows
        ],
        "identifier": identifier,
        "ttl": f"{form_data.get('ttl_value')} {form_data.get('ttl_unit', '')}".strip(),
    }
