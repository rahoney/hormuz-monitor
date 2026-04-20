"""RSS 이벤트 수집 → events 저장 잡."""
import sys
from datetime import date, timedelta
sys.path.insert(0, ".")

from collectors.events.rss_collector import collect
from db.upsert import insert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

_LOOKBACK_DAYS = 3


def run() -> None:
    since = date.today() - timedelta(days=_LOOKBACK_DAYS)
    run_id = start_run("rss_events")
    logger.info("RSS 이벤트 수집 시작 (since %s)", since)

    try:
        records = collect(since=since)
        # 이벤트는 중복 제거 없이 insert (제목+날짜 기준 중복은 추후 정리)
        saved = insert("events", records) if records else 0
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("rss_events", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
