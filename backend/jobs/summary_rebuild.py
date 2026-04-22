"""chokepoint_transits 최신 1일 데이터로 strait_metrics summary를 재계산해 저장하는 잡."""
import sys
from datetime import datetime, timezone
sys.path.insert(0, ".")

from db.select import fetch_latest
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def _status_level(total: int) -> str:
    if total == 0:
        return "restricted"
    if total < 5:
        return "high_risk"
    return "normal"


def run() -> None:
    run_id = start_run("summary_rebuild")

    try:
        latest = fetch_latest("chokepoint_transits", "transit_date")

        if not latest:
            logger.warning("chokepoint_transits 데이터 없음 — summary 건너뜀")
            finish_run(run_id, "success", 0, 0)
            return

        transit_date = latest["transit_date"]
        total = latest.get("n_total") or 0
        tanker = latest.get("n_tanker") or 0

        # strait_metrics는 period 기반이므로 transit_date를 하루 범위로 매핑
        period_start = f"{transit_date}T00:00:00+00:00"
        period_end   = f"{transit_date}T23:59:59+00:00"

        metric = {
            "period_start":        period_start,
            "period_end":          period_end,
            "total_vessels":       total,
            "lng_vessels":         0,
            "crude_vessels":       tanker,
            "inland_entry_count":  0,
            "offshore_exit_count": 0,
            "status_level":        _status_level(total),
        }

        upsert("strait_metrics", [metric], on_conflict="period_start,period_end")
        finish_run(run_id, "success", total, 1)
        logger.info("summary 저장 완료 — %s 총 %d척 (탱커:%d) status:%s",
                    transit_date, total, tanker, metric["status_level"])

    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("summary_rebuild", "unknown", str(exc), run_id)
        logger.error("summary 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
