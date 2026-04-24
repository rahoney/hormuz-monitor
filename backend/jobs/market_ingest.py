"""시장 지표 통합 수집 잡.

하나의 Render cron에서 스냅샷, 5분봉, 일봉 OHLCV를 조건부로 실행한다.
"""
import sys
from datetime import datetime, timezone
sys.path.insert(0, ".")

from collectors.market.yfinance_collector import (
    collect_intraday as yf_collect_intraday,
    collect_live as yf_collect_live,
    collect_ohlcv as yf_collect_ohlcv,
)
from db.upsert import upsert
from db.run_repo import finish_run, has_successful_run_since, start_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

# 미국 pre-market~after-hours: UTC 08:00~01:00 (weekday)
_MARKET_EXCLUDED_UTC_HOURS = set(range(1, 8))
_DAILY_OHLCV_UTC_HOUR = 22


def _is_market_session() -> bool:
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return False
    return now.hour not in _MARKET_EXCLUDED_UTC_HOURS


def _should_run_daily_ohlcv(force: bool = False) -> bool:
    if force:
        return True

    now = datetime.now(timezone.utc)
    if now.hour < _DAILY_OHLCV_UTC_HOUR:
        return False

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return not has_successful_run_since("market_ohlcv", today_start)


def _run_snapshot() -> bool:
    run_id = start_run("market")
    logger.info("시장 지표 실시간 수집 시작")

    try:
        records = yf_collect_live()
        saved = upsert("market_snapshots", records, on_conflict="symbol,snapshot_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
        return True
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        return False


def _run_intraday() -> bool:
    run_id = start_run("market_intraday")
    logger.info("5분봉 시장 데이터 수집 시작")

    try:
        records = yf_collect_intraday()
        saved = upsert("market_intraday", records, on_conflict="symbol,recorded_at")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
        return True
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market_intraday", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        return False


def _run_ohlcv() -> bool:
    run_id = start_run("market_ohlcv")
    logger.info("일봉 OHLCV 수집 시작")

    try:
        records = yf_collect_ohlcv()
        saved = upsert("market_ohlcv", records, on_conflict="symbol,price_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
        return True
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market_ohlcv", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        return False


def run(force: bool = False) -> None:
    failures: list[str] = []

    if force or _is_market_session():
        if not _run_snapshot():
            failures.append("market")
        if not _run_intraday():
            failures.append("market_intraday")
    else:
        logger.info("장외 시간 — snapshot/intraday 수집 건너뜀")

    if _should_run_daily_ohlcv(force):
        if not _run_ohlcv():
            failures.append("market_ohlcv")
    else:
        logger.info("일봉 OHLCV는 실행 조건 미충족 또는 오늘 이미 성공 — 건너뜀")

    if failures:
        raise RuntimeError(f"시장 통합 수집 일부 실패: {', '.join(failures)}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="시간/일일 실행 조건을 무시하고 강제 수집")
    args = parser.parse_args()
    run(force=args.force)
