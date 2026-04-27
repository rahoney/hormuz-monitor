"""Transit summary aggregation for dashboard metrics."""
from typing import Any

from collectors.shipping.aisstream_estimator import estimate_direction_counts
from db.select import fetch


def status_level(inland_entry: int | None, offshore_exit: int | None, total: int) -> str:
    # 30% weight for inland_entry, 70% weight for offshore_exit
    inland_score = (1.0 - min((inland_entry or 0) / 35.0, 1.0)) * 30.0 if inland_entry is not None else 0.0
    offshore_score = (1.0 - min((offshore_exit or 0) / 35.0, 1.0)) * 70.0 if offshore_exit is not None else 0.0
    
    # If both are None, fallback to total vessels logic
    if inland_entry is None and offshore_exit is None:
        risk_score = (1.0 - min(total / 70.0, 1.0)) * 100.0
    else:
        risk_score = inland_score + offshore_score

    if risk_score <= 15:
        return "normal"
    if risk_score <= 35:
        return "slightly_delayed"
    if risk_score <= 55:
        return "congested"
    if risk_score <= 75:
        return "high_risk"
    if risk_score <= 90:
        return "critical"
    return "blockade_level"


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
            "inland_entry_count": None,
            "offshore_exit_count": None,
        }

    def avg(key: str) -> int:
        vals = [int(row.get(key) or 0) for row in rows]
        return round(sum(vals) / len(vals))

    latest_date = rows[0].get("transit_date")
    since = rows[-1].get("transit_date")
    direction_rows = fetch(
        "strait_metrics",
        columns="period_start,offshore_exit_count",
        filters={
            "period_start": f"gte.{since}T00:00:00+00:00",
        },
        order="period_start.desc",
    ) if latest_date and since else []
    offshore_by_date = {
        str(row.get("period_start"))[:10]: row.get("offshore_exit_count")
        for row in direction_rows
        if row.get("offshore_exit_count") is not None
    }
    offshore_vals = [
        int(offshore_by_date[str(row.get("transit_date"))])
        for row in rows
        if str(row.get("transit_date")) in offshore_by_date
    ]
    offshore_avg = round(sum(offshore_vals) / len(offshore_vals)) if offshore_vals else None
    total_avg = avg("n_total")

    return {
        "n_total": total_avg,
        "n_tanker": avg("n_tanker"),
        "n_container": avg("n_container"),
        "n_dry_bulk": avg("n_dry_bulk"),
        "n_general_cargo": avg("n_general_cargo"),
        "inland_entry_count": max(total_avg - offshore_avg, 0) if offshore_avg is not None else None,
        "offshore_exit_count": offshore_avg,
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
        "status_level": status_level(inland_entry, offshore_exit, total),
    }
