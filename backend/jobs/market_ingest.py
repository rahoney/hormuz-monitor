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
    collect_recent_ohlcv,
    market_sessions,
)
from collectors.market.sessions import Session
from db.market_repo import fetch_recent_bars, fetch_recent_daily, upsert_market_snapshots
from db.upsert import upsert
from db.run_repo import finish_run, has_successful_run_since, start_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)
_OHLCV_TARGET_HOURS_UTC = {
    "KRX": 14,
    "NYSE": 1,
    # 06:00 UTC is after Yahoo's New York date boundary in both EST and EDT.
    "CME": 6,
    "ICE": 6,
    "TSE": 8,
    "HKEX": 9,
    "SSE": 8,
    "STOXX": 18,
}

def _run_snapshot(now: datetime, sessions: dict[str, tuple[Session, ...]], intraday: list[dict]) -> bool:
    run_id = start_run("market")
    logger.info("시장 지표 실시간 수집 시작")

    try:
        daily = fetch_recent_daily(sessions, now)
        recent_daily = collect_recent_ohlcv(now, sessions, daily)
        upsert("market_ohlcv", recent_daily, on_conflict="symbol,price_date")
        records = yf_collect_live(now, sessions, fetch_recent_bars(sessions, now) + intraday, daily + recent_daily)
        saved = upsert_market_snapshots(records)
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
        return True
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        return False


def _run_intraday(now: datetime, sessions: dict[str, tuple[Session, ...]]) -> tuple[bool, list[dict]]:
    run_id = start_run("market_intraday")
    logger.info("5분봉 시장 데이터 수집 시작")

    try:
        records = yf_collect_intraday(now, sessions)
        saved = upsert("market_intraday", records, on_conflict="symbol,recorded_at")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
        return True, records
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market_intraday", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        return False, []


def _run_ohlcv(exchange: str, now: datetime) -> bool:
    run_id = start_run(f"market_ohlcv_{exchange}")
    logger.info(f"일봉 OHLCV ({exchange}) 수집 시작")

    try:
        records = yf_collect_ohlcv(exchange, now=now)
        saved = upsert("market_ohlcv", records, on_conflict="symbol,price_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
        return True
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error(f"market_ohlcv_{exchange}", "unknown", str(exc), run_id)
        logger.error(f"수집 실패 ({exchange}): %s", exc)
        return False


def run(force: bool = False, *, now: datetime | None = None) -> None:
    failures: list[str] = []

    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    sessions = market_sessions(now)

    # Charts are written first so snapshots can reuse the exact bars from this run.
    success, intraday = _run_intraday(now, sessions)
    if not success:
        failures.append("market_intraday")

    # Keep the existing daily chart schedule and reuse its candles before the short daily fetch.
    for exc, target_hour in _OHLCV_TARGET_HOURS_UTC.items():
        # 타겟 시간이 지났고, 해당 타겟 시간 이후로 성공한 기록이 없는 경우에만 실행
        target_time = now.replace(hour=target_hour, minute=0, second=0, microsecond=0)
        
        if force or (now.hour >= target_hour and not has_successful_run_since(f"market_ohlcv_{exc}", target_time)):
            if not _run_ohlcv(exc, now):
                failures.append(f"market_ohlcv_{exc}")
        else:
            logger.info(f"일봉 OHLCV ({exc})는 실행 조건 미충족(타겟:{target_hour}시, 현재:{now.hour}시) 또는 오늘 이미 완료 — 건너뜀")

    if not _run_snapshot(now, sessions, intraday):
        failures.append("market")

    if failures:
        raise RuntimeError(f"시장 통합 수집 일부 실패: {', '.join(failures)}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="시간/일일 실행 조건을 무시하고 강제 수집")
    args = parser.parse_args()
    run(force=args.force)
