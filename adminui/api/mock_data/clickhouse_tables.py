"""Dummy Clickhouse tables for the Clickhouse Tables list and detail pages.

Stands in for MetrANOVA/api until it's wired up: GET /type/ and GET /type/{slug}
for data tables, and the /metadata/ equivalents for metadata tables. Names
follow the Figma mockups. `fields` lists the user-defined columns only; the
API adds its own (insert_time, collector_id, policy_*, ...) on top.
"""


def _fields(*rows):
    return [
        {
            "field_name": name,
            "field_type": field_type,
            "nullable": nullable,
            "primary_key": primary_key,
        }
        for name, field_type, nullable, primary_key in rows
    ]


FLOW_FIELDS = _fields(
    ("start_time", "DateTime64(3, 'UTC')", False, False),
    ("end_time", "DateTime64(3, 'UTC')", False, False),
    ("src_as_id", "UInt32", False, True),
    ("dst_as_id", "UInt32", False, True),
    ("edge_id", "LowCardinality(String)", False, True),
    ("protocol", "LowCardinality(String)", True, False),
    ("bytes", "UInt64", False, False),
    ("packets", "UInt64", False, False),
    ("flow_count", "UInt64", True, False),
)

INTERFACE_TRAFFIC_FIELDS = _fields(
    ("start_time", "DateTime64(3, 'UTC')", False, False),
    ("device_id", "String", False, True),
    ("port", "String", False, True),
    ("in_octets", "UInt64", True, False),
    ("out_octets", "UInt64", True, False),
    ("in_errors", "UInt64", True, False),
    ("out_errors", "UInt64", True, False),
)

INTERFACE_FIELDS = _fields(
    ("device_id", "String", False, True),
    ("port", "String", False, True),
    ("description", "String", True, False),
    ("speed", "UInt64", True, False),
    ("edge", "Bool", True, False),
    ("ipv4", "IPv4", True, False),
    ("ipv6", "IPv6", True, False),
    ("flow_index", "UInt32", True, False),
)

ORGANIZATION_FIELDS = _fields(
    ("org_id", "String", False, True),
    ("name", "String", False, False),
    ("type", "LowCardinality(String)", True, False),
    ("country", "LowCardinality(String)", True, False),
)

IP_FIELDS = _fields(
    ("ip", "IPv6", False, True),
    ("prefix_length", "UInt8", False, False),
    ("org_id", "String", True, False),
    ("as_id", "UInt32", True, False),
)

DEVICE_FIELDS = _fields(
    ("device_id", "String", False, True),
    ("hostname", "String", False, False),
    ("model", "String", True, False),
    ("location", "String", True, False),
    ("os_version", "String", True, False),
)

AS_FIELDS = _fields(
    ("as_id", "UInt32", False, True),
    ("name", "String", False, False),
    ("org_id", "String", True, False),
)


def _table(table_name, fields, created_at, ttl="365 DAY"):
    table_type = "metadata" if table_name.startswith("meta_") else "data"
    return {
        "table_name": table_name,
        "table_type": table_type,
        # Metadata tables have no retention in the API
        "ttl": ttl if table_type == "data" else None,
        "created_by": "jlee@es.net",
        "created_at": created_at,
        "fields": fields,
    }


MOCK_TABLES = [
    _table("data_flow", FLOW_FIELDS, "2027-04-12", "90 DAY"),
    _table("data_flow_by_edge_as_1d", FLOW_FIELDS, "2027-07-13"),
    _table("data_flow_by_edge_as_1d_mv", FLOW_FIELDS, "2027-04-12"),
    _table("meta_interface", INTERFACE_FIELDS, "2027-07-13"),
    _table("data_flow_by_edge_as_5m", FLOW_FIELDS, "2027-07-13", "30 DAY"),
    _table("data_flow_by_edge_as_5m_mv", FLOW_FIELDS, "2027-04-12", "30 DAY"),
    _table("data_flow_by_edge_esdb_5m", FLOW_FIELDS, "2027-07-13", "30 DAY"),
    _table("meta_interface_esdb", INTERFACE_FIELDS, "2027-07-13"),
    _table("meta_organization", ORGANIZATION_FIELDS, "2027-07-13"),
    _table("meta_ip", IP_FIELDS, "2027-07-13"),
    _table("meta_device", DEVICE_FIELDS, "2027-07-13"),
    _table("data_flow_by_pop_1h", FLOW_FIELDS, "2027-05-02", "1 YEAR"),
    _table("meta_as", AS_FIELDS, "2027-05-02"),
    _table("data_interface_traffic", INTERFACE_TRAFFIC_FIELDS, "2027-05-02", "6 MONTH"),
]
