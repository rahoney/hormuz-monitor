"""선박 데이터 수집 → vessels_normalized 저장 잡."""
import sys
sys.path.insert(0, ".")

from collectors.shipping.aisstream_collector import collect
from collectors.shipping.aisstream_estimator import estimate_recent_transits
from db.upsert import insert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("aisstream")
    logger.info("선박 데이터 수집 시작")

    try:
        records = collect()
        saved = insert("vessels_normalized", records) if records else 0
        estimated = estimate_recent_transits()
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d척 수집, %d건 저장, %d일 추정치 갱신", len(records), saved, estimated)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("aisstream", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
