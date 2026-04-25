"""chokepoint_transits 최신 1일 데이터로 strait_metrics summary를 재계산해 저장하는 잡."""
import sys
sys.path.insert(0, ".")

from db.select import fetch_latest
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from services.risk_score_service import save_risk_score_today
from services.transit_summary_service import build_strait_metric
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("summary_rebuild")

    try:
        latest = fetch_latest("chokepoint_transits", "transit_date")

        if not latest:
            logger.warning("chokepoint_transits 데이터 없음 — summary 건너뜀")
            finish_run(run_id, "success", 0, 0)
            return

        transit_date = latest["transit_date"]
        metric = build_strait_metric(transit_date)

        upsert("strait_metrics", [metric], on_conflict="period_start,period_end")
        save_risk_score_today()
        finish_run(run_id, "success", metric["total_vessels"], 1)
        logger.info("summary 저장 완료 — %s 주간평균 %d척 (탱커:%d, 외해출항:%d) status:%s",
                    transit_date, metric["total_vessels"], metric["crude_vessels"],
                    metric["offshore_exit_count"], metric["status_level"])

    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("summary_rebuild", "unknown", str(exc), run_id)
        logger.error("summary 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
