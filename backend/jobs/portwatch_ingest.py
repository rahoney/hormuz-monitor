"""IMF PortWatch 일별 통행량 수집 → chokepoint_transits 저장 잡."""
import sys
sys.path.insert(0, ".")

from collectors.shipping.portwatch_collector import collect
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("portwatch")
    logger.info("PortWatch 통행량 수집 시작")

    try:
        records = collect()
        saved = upsert("chokepoint_transits", records, on_conflict="portid,transit_date") if records else 0
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d일치 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("portwatch", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
