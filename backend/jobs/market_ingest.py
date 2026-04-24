"""시장 지표 수집 → market_snapshots 저장 잡."""
import sys
from datetime import datetime, timezone
sys.path.insert(0, ".")

from collectors.market.yfinance_collector import collect_live as yf_collect_live
from collectors.market.pykrx_collector import collect_live as krx_collect_live
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

# 미국 pre-market~after-hours: UTC 08:00~01:00 (weekday)
_MARKET_EXCLUDED_UTC_HOURS = set(range(1, 8))


def _is_market_session() -> bool:
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return False
    return now.hour not in _MARKET_EXCLUDED_UTC_HOURS


def run(force: bool = False) -> None:
    if not force and not _is_market_session():
        logger.info("장외 시간 — 수집 건너뜀")
        return

    run_id = start_run("market")
    logger.info("시장 지표 실시간 수집 시작")

    try:
        raw = yf_collect_live() + krx_collect_live()
        # 같은 (symbol, snapshot_date) 중복 제거 — pykrx가 나중이므로 자동 우선
        seen: dict[tuple, dict] = {}
        for r in raw:
            seen[(r["symbol"], r["snapshot_date"])] = r
        records = list(seen.values())
        saved = upsert("market_snapshots", records, on_conflict="symbol,snapshot_date")
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("market", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="장외 시간 체크 무시하고 강제 수집")
    args = parser.parse_args()
    run(force=args.force)
