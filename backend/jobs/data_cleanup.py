"""10일 이상 지난 고빈도 데이터를 삭제하는 잡."""
import sys
from datetime import datetime, timezone, timedelta
sys.path.insert(0, ".")

from db.client import get_client
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)

_RETENTION_DAYS = 10


def _delete_old(table: str, col: str, cutoff: str) -> int:
    with get_client() as client:
        resp = client.delete(
            f"/{table}",
            params={col: f"lt.{cutoff}", "is_manual": "eq.false"} if table == "events"
            else {col: f"lt.{cutoff}"},
            headers={"Prefer": "return=minimal", "Content-Type": "application/json"},
        )
        if resp.status_code in (200, 204):
            return 1
    return 0


def run() -> None:
    run_id = start_run("data_cleanup")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=_RETENTION_DAYS)).isoformat()
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=_RETENTION_DAYS)).date().isoformat()
    logger.info("데이터 정리 시작 (기준: %s일 이전)", _RETENTION_DAYS)

    try:
        targets = [
            ("situation_summaries", "generated_at", cutoff),
            ("events",              "published_at",  cutoff),
            ("trump_posts",         "post_date",     cutoff_date),
        ]
        for table, col, cut in targets:
            _delete_old(table, col, cut)
            logger.info("%s: %s 이전 데이터 삭제 완료", table, cut)

        finish_run(run_id, "success", 0, 0)
        logger.info("데이터 정리 완료")
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("data_cleanup", "unknown", str(exc), run_id)
        logger.error("정리 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
