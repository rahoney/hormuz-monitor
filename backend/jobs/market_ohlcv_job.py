"""일봉 OHLCV 수집 → market_ohlcv 저장 잡 (하루 1회)."""
import sys
sys.path.insert(0, ".")

from collectors.market.yfinance_collector import collect_ohlcv as yf_ohlcv
from collectors.market.pykrx_collector import collect_ohlcv as krx_ohlcv
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("market_ohlcv")
    logger.info("일봉 OHLCV 수집 시작")

    try:
        raw = yf_ohlcv() + krx_ohlcv()
        # (symbol, price_date) 중복 제거 — pykrx 우선
        seen: dict[tuple, dict] = {}
        for r in raw:
            seen[(r["symbol"], r["price_date"])] = r
        records = list(seen.values())

        saved = upsert("market_ohlcv", records, on_conflict="symbol,price_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market_ohlcv", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
