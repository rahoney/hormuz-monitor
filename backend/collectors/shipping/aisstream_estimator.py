"""AISStream raw positions -> provisional daily Hormuz transit estimates."""
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

from db.select import fetch
from db.upsert import upsert

_HORMUZ_ID = "chokepoint6"
_HORMUZ_NAME = "Strait of Hormuz"
_ESTIMATE_SOURCE = "aisstream_estimate"


def _parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _direction_from_course(value: Any) -> str | None:
    try:
        cog = float(value)
    except (TypeError, ValueError):
        return None
    if cog < 10 or cog > 350:
        return None
    if 80 <= cog <= 180:
        return "offshore_exit"
    if 240 <= cog <= 340:
        return "inland_entry"
    return None


def _latest_portwatch_date() -> str | None:
    rows = fetch(
        "chokepoint_transits",
        columns="transit_date",
        filters={"portid": f"eq.{_HORMUZ_ID}", "source": "eq.portwatch"},
        order="transit_date.desc",
        limit=1,
    )
    return rows[0]["transit_date"] if rows else None


def _classify_direction(rows: list[dict[str, Any]]) -> str | None:
    gates = [
        row.get("zone_status")
        for row in rows
        if row.get("zone_status") in {"inland_gate", "offshore_gate"}
    ]
    if gates:
        return "inland_entry" if gates[-1] == "inland_gate" else "offshore_exit"

    directions = [direction for row in rows if (direction := _direction_from_course(row.get("course_deg")))]
    if not directions:
        return None

    inland = directions.count("inland_entry")
    offshore = directions.count("offshore_exit")
    if inland == offshore:
        return directions[-1]
    return "inland_entry" if inland > offshore else "offshore_exit"


def estimate_direction_counts(days: int = 10) -> dict[str, dict[str, int]]:
    """Return daily AIS direction estimates based on MMSI gate movement."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = fetch(
        "vessels_normalized",
        columns="mmsi,ship_type_label,raw_timestamp,speed_knots,zone_status,course_deg",
        filters={"raw_timestamp": f"gte.{since}"},
        order="raw_timestamp.asc",
        limit=10000,
    )

    by_vessel_day: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        mmsi = row.get("mmsi")
        raw_timestamp = row.get("raw_timestamp")
        if not mmsi or not raw_timestamp:
            continue
        speed = row.get("speed_knots")
        if speed is not None and float(speed) < 1.0:
            continue
        transit_date = _parse_ts(raw_timestamp).date().isoformat()
        by_vessel_day[(transit_date, mmsi)].append(row)

    counts: dict[str, dict[str, int]] = defaultdict(lambda: {
        "inland_entry": 0,
        "offshore_exit": 0,
        "total": 0,
        "tanker": 0,
    })
    for (transit_date, _mmsi), vessel_rows in by_vessel_day.items():
        direction = _classify_direction(vessel_rows)
        if direction is None:
            continue

        counts[transit_date][direction] += 1
        counts[transit_date]["total"] += 1
        if any(r.get("ship_type_label") in {"tanker", "lng_tanker", "crude_tanker"} for r in vessel_rows):
            counts[transit_date]["tanker"] += 1

    return dict(counts)


def estimate_recent_direction_totals(hours: int = 24) -> dict[str, int]:
    """Return aggregate AIS direction estimates for the recent rolling window."""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = fetch(
        "vessels_normalized",
        columns="mmsi,ship_type_label,raw_timestamp,speed_knots,zone_status,course_deg",
        filters={"raw_timestamp": f"gte.{since}"},
        order="raw_timestamp.asc",
        limit=10000,
    )

    by_vessel: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        mmsi = row.get("mmsi")
        if not mmsi or not row.get("raw_timestamp"):
            continue
        speed = row.get("speed_knots")
        if speed is not None and float(speed) < 1.0:
            continue
        by_vessel[str(mmsi)].append(row)

    counts = {
        "inland_entry": 0,
        "offshore_exit": 0,
        "total": 0,
        "tanker": 0,
    }
    for vessel_rows in by_vessel.values():
        direction = _classify_direction(vessel_rows)
        if direction is None:
            continue

        counts[direction] += 1
        counts["total"] += 1
        if any(r.get("ship_type_label") in {"tanker", "lng_tanker", "crude_tanker"} for r in vessel_rows):
            counts["tanker"] += 1

    return counts


def estimate_recent_transits(days: int = 10) -> int:
    """Fill missing post-PortWatch dates with AISStream direction-based estimates."""
    latest_portwatch = _latest_portwatch_date()
    by_date = estimate_direction_counts(days)

    transit_records = []
    metric_records = []
    for transit_date, counts in sorted(by_date.items()):
        total = counts["total"]
        if total == 0:
            continue
        inland_score = (1.0 - min(counts["inland_entry"] / 35.0, 1.0)) * 30.0
        offshore_score = (1.0 - min(counts["offshore_exit"] / 35.0, 1.0)) * 70.0
        risk_score = inland_score + offshore_score
        
        status_level_str = "normal"
        if risk_score > 90: status_level_str = "blockade_level"
        elif risk_score > 75: status_level_str = "critical"
        elif risk_score > 55: status_level_str = "high_risk"
        elif risk_score > 35: status_level_str = "congested"
        elif risk_score > 15: status_level_str = "slightly_delayed"

        metric_records.append({
            "period_start": f"{transit_date}T00:00:00+00:00",
            "period_end": f"{transit_date}T23:59:59+00:00",
            "total_vessels": total,
            "lng_vessels": 0,
            "crude_vessels": counts["tanker"],
            "inland_entry_count": counts["inland_entry"],
            "offshore_exit_count": counts["offshore_exit"],
            "status_level": status_level_str,
        })
        if latest_portwatch and transit_date <= latest_portwatch:
            continue
        transit_records.append({
            "portid": _HORMUZ_ID,
            "portname": _HORMUZ_NAME,
            "transit_date": transit_date,
            "n_total": total,
            "n_tanker": counts["tanker"],
            "n_container": 0,
            "n_dry_bulk": 0,
            "n_general_cargo": 0,
            "capacity_total": None,
            "capacity_tanker": None,
            "source": _ESTIMATE_SOURCE,
        })

    saved = upsert("strait_metrics", metric_records, on_conflict="period_start,period_end") if metric_records else 0
    saved += upsert("chokepoint_transits", transit_records, on_conflict="portid,transit_date") if transit_records else 0
    return saved
