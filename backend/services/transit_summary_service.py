"""Transit summary aggregation for dashboard metrics."""
from typing import Any

from collectors.shipping.aisstream_estimator import estimate_direction_counts
from db.select import fetch


def status_level(total: int) -> str:
    if total == 0:
        return "restricted"
    if total < 5:
        return "high_risk"
    return "normal"


def weekly_average_transit() -> dict[str, int | None]:
    rows = fetch(
        "chokepoint_transits",
        columns="transit_date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo",
        filters={"portid": "eq.chokepoint6"},
        order="transit_date.desc",
        limit=7,
    )
    if not rows:
        return {
            "n_total": None,
            "n_tanker": None,
            "n_container": None,
            "n_dry_bulk": None,
            "n_general_cargo": None,
        }

    def avg(key: str) -> int:
        vals = [int(row.get(key) or 0) for row in rows]
        return round(sum(vals) / len(vals))

    return {
        "n_total": avg("n_total"),
        "n_tanker": avg("n_tanker"),
        "n_container": avg("n_container"),
        "n_dry_bulk": avg("n_dry_bulk"),
        "n_general_cargo": avg("n_general_cargo"),
    }


def build_strait_metric(transit_date: str) -> dict[str, Any]:
    weekly = weekly_average_transit()
    total = weekly.get("n_total") or 0
    tanker = weekly.get("n_tanker") or 0
    direction = estimate_direction_counts().get(transit_date, {})
    offshore_exit = int(direction.get("offshore_exit") or 0)
    inland_entry = max(total - offshore_exit, 0) if direction else 0

    return {
        "period_start": f"{transit_date}T00:00:00+00:00",
        "period_end": f"{transit_date}T23:59:59+00:00",
        "total_vessels": total,
        "lng_vessels": weekly.get("n_container") or 0,
        "crude_vessels": tanker,
        "inland_entry_count": inland_entry,
        "offshore_exit_count": offshore_exit,
        "status_level": status_level(total),
    }
