"""트럼프 소셜 미디어 포스트 수집 → trump_posts 저장 잡."""
import sys
from datetime import date, timedelta
sys.path.insert(0, ".")

from collectors.social.trump_collector import collect
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

_LOOKBACK_DAYS = 7


def run() -> None:
    since = date.today() - timedelta(days=_LOOKBACK_DAYS)
    run_id = start_run("trump_social")
    logger.info("트럼프 소셜 수집 시작 (since %s)", since)

    try:
        records = collect(since=since)
        saved = upsert("trump_posts", records, on_conflict="source_url") if records else 0
        finish_run(run_id, "success", len(records), saved)
        logger.info("완료: %d건 수집, %d건 저장", len(records), saved)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("trump_social", "unknown", str(exc), run_id)
        logger.error("수집 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
