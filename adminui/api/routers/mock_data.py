"""In-memory stand-ins for the MetrANOVA API's metadata types, records and
transformers. Shapes follow the real responses; `created_at` on types and
transformers and `definition_type` on transformers are the additions the UI
has asked for and are not in the real API yet.
"""

from datetime import datetime, timedelta

_BASE = datetime(2026, 8, 11, 15, 21, 14)


def _stamp(days: int = 0) -> str:
    return (_BASE + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


def _field(name: str, ftype: str, nullable: bool = True) -> dict:
    return {"field_name": name, "field_type": ftype, "nullable": nullable, "table": ""}


INTERFACE_FIELDS = [
    _field("type", "String"),
    _field("description", "String"),
    _field("device_id", "String", False),
    _field("device_ref", "String"),
    _field("edge", "Bool"),
    _field("flow_index", "UInt32"),
    _field("ipv4", "IPv4"),
    _field("ipv6", "IPv6"),
    _field("name", "String", False),
    _field("speed", "UInt64"),
    _field("circuit_id", "Array(String)"),
    _field("circuit_ref", "Array(String)"),
    _field("peer_as_id", "UInt32"),
    _field("peer_as_ref", "String"),
    _field("peer_interface_ipv4", "IPv4"),
    _field("peer_interface_ipv6", "IPv6"),
    _field("lag_member_interface_id", "Array(String)"),
    _field("lag_member_interface_ref", "Array(String)"),
    _field("port_interface_id", "String"),
    _field("port_interface_ref", "String"),
    _field("remote_interface_id", "String"),
    _field("remote_interface_ref", "String"),
    _field("remote_organization_id", "String"),
    _field("remote_organization_ref", "String"),
]

GENERIC_FIELDS = [
    _field("name", "String", False),
    _field("description", "String"),
    _field("active", "Bool"),
    _field("weight", "UInt32"),
]

# (slug, records, days after the base date it was created)
_TYPES = [
    ("as", 48, 0),
    ("circuit", 23, 0),
    ("device", 17, 1),
    ("interface", 137, 1),
    ("ip", 212, 2),
    ("organization", 64, 2),
    ("esdb_org_name_dict", 9, 5),
    ("interface_esdb", 31, 5),
    ("ip_cric", 0, 8),
    ("ip_esdb", 12, 8),
    ("ip_scireg", 7, 13),
    ("kvp", 3, 13),
    ("pop", 26, 21),
    ("service", 41, 21),
    ("tag", 15, 34),
]

TYPES: dict[str, dict] = {}
for _slug, _count, _days in _TYPES:
    _fields = INTERFACE_FIELDS if _slug == "interface" else GENERIC_FIELDS
    TYPES[_slug] = {
        "id": f"def_{_slug}",
        "ref": f"def_{_slug}__v1",
        "name": _slug,
        "slug": _slug,
        "type": "metadata",
        "meta_fields": _fields,
        "data_fields": [],
        "identifier": ["device_id", "name"] if _slug == "interface" else ["name"],
        "ttl": "",
        "created_at": _stamp(_days),
        "updated_at": _stamp(_days + 3),
    }

_DEVICES = ["losa-cr6", "sfo-cr1", "chic-cr5", "wash-cr6", "denv-cr5"]


def _interface(device, name, *, version=1, n=0, **extra) -> dict:
    record = {
        "id": f"{device}::{name}",
        "ref": f"{device}::{name}__v{version}",
        "hash": f"{(n * 2654435761 + 0x3F9A) & 0xFFFFFFFF:08x}{(n * 40503 + 0xC21E) & 0xFFFFFFFF:08x}",
        "created_at": _stamp(),
        "insert_time": _stamp(),
        "updated_at": _stamp(),
        "tag": [],
        "ext": {},
        "type": "port",
        "description": f"{device.split('-')[0].upper()} {name}",
        "device_id": device,
        "device_ref": f"{device}__v1",
        "edge": True,
        "flow_index": 20 + n,
        "ipv4": None,
        "ipv6": None,
        "name": name,
        "speed": 1000,
        "circuit_id": [],
        "circuit_ref": [],
        "peer_as_id": None,
        "peer_as_ref": None,
        "peer_interface_ipv4": None,
        "peer_interface_ipv6": None,
        "lag_member_interface_id": [],
        "lag_member_interface_ref": [],
        "port_interface_id": None,
        "port_interface_ref": None,
        "remote_interface_id": None,
        "remote_interface_ref": None,
        "remote_organization_id": None,
        "remote_organization_ref": None,
    }
    record.update(extra)
    return record


def _interfaces(count: int) -> list[dict]:
    # The first four are real rows from the test stack.
    rows = [
        _interface(
            "sfo-cr1",
            "sfo_se-1553",
            version=2,
            type="service_l3vpn",
            description="San Francisco SE-1553",
            flow_index=7,
            ipv4="207.231.240.165",
            ipv6="2001:504:b:20::165",
            circuit_id=["losa-sfo-1553"],
            circuit_ref=["losa-sfo-1553__v1"],
            peer_as_id=67890,
            peer_interface_ipv4="207.231.240.165",
            peer_interface_ipv6="2001:504:b:20::165",
            port_interface_id="sfo-cr1::lag1",
            port_interface_ref="sfo-cr1::lag1__v2",
            remote_interface_id="losa-cr6::losa_se-1553",
            remote_interface_ref="losa-cr6::losa_se-1553__v2",
        ),
        _interface("sfo-cr1", "port2", version=2, n=1, description="San Francisco Port 2", flow_index=10),
        _interface("losa-cr6", "ae1553", version=2, n=2, description="Los Angeles AE1553", flow_index=12357),
        _interface("sfo-cr1", "port1", version=2, n=3, description="San Francisco Port 1", flow_index=9),
    ]
    for n in range(4, count):
        device = _DEVICES[n % len(_DEVICES)]
        rows.append(_interface(device, f"port{n - 1}", n=n, description=f"{device.split('-')[0].upper()} Port {n - 1}"))
    return rows


def _generic(slug: str, count: int) -> list[dict]:
    return [
        {
            "id": f"{slug}-{n:03d}",
            "ref": f"{slug}-{n:03d}__v1",
            "hash": f"{(n * 2654435761) & 0xFFFFFFFF:08x}{(n * 40503) & 0xFFFFFFFF:08x}",
            "created_at": _stamp(n % 30),
            "insert_time": _stamp(n % 30),
            "updated_at": _stamp(n % 30),
            "tag": [],
            "ext": {},
            "name": f"{slug}-{n:03d}",
            "description": f"{slug.replace('_', ' ').title()} {n}",
            "active": n % 4 != 0,
            "weight": (n * 37) % 100,
        }
        for n in range(1, count + 1)
    ]


RECORDS: dict[str, list[dict]] = {
    slug: _interfaces(count) if slug == "interface" else _generic(slug, count)
    for slug, count, _ in _TYPES
}

# (id, definition slug, is it a metadata table, days after the base date)
_TRANSFORMERS = [
    ("all_interfaces", "interface", False, 0),
    ("data_flow", "flow", False, 2),
    ("data_flow_by_edge_as_1d", "flow", False, 3),
    ("data_flow_by_edge_as_1d_mv", "flow", False, 3),
    ("meta_interface", "interface", True, 4),
    ("data_flow_by_edge_as_5m", "flow", False, 5),
    ("data_flow_by_edge_as_5m_mv", "flow", False, 5),
    ("data_flow_by_edge_esdb_5m", "flow", False, 6),
    ("meta_interface_esdb", "interface_esdb", True, 8),
    ("meta_organization", "organization", True, 8),
    ("meta_ip", "ip", True, 9),
    ("meta_device", "device", True, 10),
    ("data_flow_by_pop_1h", "flow", False, 12),
    ("meta_as", "as", True, 12),
    ("data_flow_by_pop_1d", "flow", False, 15),
    ("data_flow_by_service_5m", "flow", False, 15),
    ("data_flow_by_service_1h", "flow", False, 16),
    ("meta_circuit", "circuit", True, 18),
    ("meta_pop", "pop", True, 18),
    ("meta_service", "service", True, 19),
    ("data_snmp_interface_1m", "interface", False, 21),
    ("data_snmp_interface_5m", "interface", False, 21),
    ("data_snmp_interface_1h", "interface", False, 22),
    ("meta_tag", "tag", True, 25),
    ("meta_kvp", "kvp", True, 25),
    ("data_flow_by_tag_1h", "flow", False, 28),
    ("meta_ip_esdb", "ip_esdb", True, 30),
    ("meta_ip_scireg", "ip_scireg", True, 30),
    ("data_flow_top_talkers_1h", "flow", False, 33),
    ("data_flow_top_talkers_1d", "flow", False, 33),
    ("meta_ip_cric", "ip_cric", True, 36),
]

TRANSFORMERS: list[dict] = [
    {
        "id": tid,
        "ref": f"{tid}__v1",
        "definition_ref": f"def_{definition}__v1",
        "definition_type": "metadata" if is_meta else "data",
        "name": tid,
        "slug": tid,
        "description": f"{tid.replace('_', ' ').capitalize()} transformer",
        "match_field": "source" if is_meta else "protocol",
        "created_at": _stamp(days),
        "updated_at": _stamp(days + 1),
    }
    for tid, definition, is_meta, days in _TRANSFORMERS
]
