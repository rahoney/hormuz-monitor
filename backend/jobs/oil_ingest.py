"""EIA 유가·휘발유 수집 → Supabase 저장 잡."""
import sys
from datetime import date, timedelta
sys.path.insert(0, ".")

from collectors.oil.eia_collector import collect as collect_oil
from collectors.oil.gasoline_collector import collect as collect_gasoline
from collectors.oil.yfinance_futures_collector import collect as collect_oil_futures
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

# EIA spot series can publish with a lag and revise recent rows.
_OIL_LOOKBACK_DAYS = 45
_GASOLINE_LOOKBACK_DAYS = 90


def _run_oil(end: date) -> None:
    start = end - timedelta(days=_OIL_LOOKBACK_DAYS)
    run_id = start_run("eia_oil")
    logger.info("EIA 유가 수집 시작 (%s ~ %s)", start, end)

    try:
        eia_records = collect_oil(start, end)
        eia_keys = {(record["symbol"], record["price_date"]) for record in eia_records}
        futures_records = [
            record
            for record in collect_oil_futures(start, end)
            if (record["symbol"], record["price_date"]) not in eia_keys
        ]
        records = eia_records + futures_records
        saved = upsert("oil_price_series", records, on_conflict="symbol,price_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info(
            "유가 완료: EIA %d건, Yahoo futures 보조 %d건, 저장 %d건",
            len(eia_records),
            len(futures_records),
            saved,
        )
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("eia_oil", "unknown", str(exc), run_id)
        logger.error("EIA 유가 수집 실패: %s", exc)
        raise


def _run_gasoline(end: date) -> None:
    start = end - timedelta(days=_GASOLINE_LOOKBACK_DAYS)
    run_id = start_run("eia_gasoline")
    logger.info("EIA 휘발유 가격 수집 시작 (%s ~ %s)", start, end)

    try:
        records = collect_gasoline(start, end)
        saved = upsert("gasoline_prices", records, on_conflict="area_code,price_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("EIA 휘발유 완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("eia_gasoline", "unknown", str(exc), run_id)
        logger.error("EIA 휘발유 수집 실패: %s", exc)
        raise


def run() -> None:
    end = date.today()
    _run_oil(end)
    _run_gasoline(end)


if __name__ == "__main__":
    run()
