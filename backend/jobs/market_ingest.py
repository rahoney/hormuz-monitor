"""시장 지표 수집 → market_snapshots 저장 잡."""
import sys
from datetime import date, timedelta
sys.path.insert(0, ".")

from collectors.market.yfinance_collector import collect as collect_yf
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

_LOOKBACK_DAYS = 7


def run() -> None:
    end = date.today()
    start = end - timedelta(days=_LOOKBACK_DAYS)
    run_id = start_run("market")
    logger.info("시장 지표 수집 시작 (%s ~ %s)", start, end)

    try:
        records = collect_yf(start, end)
        saved = upsert("market_snapshots", records, on_conflict="symbol,snapshot_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
