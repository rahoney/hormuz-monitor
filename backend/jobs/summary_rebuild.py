"""최신 선박 데이터로 strait_metrics summary를 재계산해 저장하는 잡."""
import sys
from datetime import datetime, timedelta, timezone
sys.path.insert(0, ".")

from db.select import fetch
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

_WINDOW_MINUTES = 15


def _status_level(total: int) -> str:
    if total == 0:
        return "restricted"
    if total < 3:
        return "high_risk"
    return "normal"


def run() -> None:
    run_id = start_run("summary_rebuild")

    try:
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=_WINDOW_MINUTES)

        vessels = fetch(
            "vessels_normalized",
            filters={"raw_timestamp": f"gte.{window_start.isoformat()}"},
        )

        inside = [v for v in vessels if v["zone_status"] == "inside_strait"]
        total = len(inside)
        lng_count = sum(1 for v in inside if v.get("ship_type_label") == "lng_tanker")
        crude_count = sum(1 for v in inside if v.get("ship_type_label") == "crude_tanker")
        inland = sum(1 for v in inside if v.get("direction_status") == "inland_entry")
        offshore = sum(1 for v in inside if v.get("direction_status") == "offshore_exit")

        metric = {
            "period_start":        window_start.isoformat(),
            "period_end":          now.isoformat(),
            "total_vessels":       total,
            "lng_vessels":         lng_count,
            "crude_vessels":       crude_count,
            "inland_entry_count":  inland,
            "offshore_exit_count": offshore,
            "status_level":        _status_level(total),
        }

        upsert("strait_metrics", [metric], on_conflict="period_start,period_end")
        finish_run(run_id, "success", total, 1)
        logger.info("summary 저장 완료 — 총 %d척 (LNG:%d 원유:%d 진입:%d 출항:%d) status:%s",
                    total, lng_count, crude_count, inland, offshore, metric["status_level"])

    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("summary_rebuild", "unknown", str(exc), run_id)
        logger.error("summary 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
