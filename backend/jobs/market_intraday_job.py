"""5분봉 시장 데이터 수집 → market_intraday 저장 잡."""
import sys
sys.path.insert(0, ".")

from collectors.market.yfinance_collector import collect_intraday
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("market_intraday")
    logger.info("5분봉 시장 데이터 수집 시작")

    try:
        records = collect_intraday()
        saved = upsert("market_intraday", records, on_conflict="symbol,recorded_at")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market_intraday", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
