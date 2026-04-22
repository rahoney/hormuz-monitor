"""trump_posts content_ko 번역 잡."""
import sys
sys.path.insert(0, ".")

from collectors.social.trump_translator import translate_pending
from db.client import get_client
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("trump_translate")
    logger.info("트럼프 포스트 번역 시작")

    try:
        with get_client() as client:
            updated = translate_pending(client)
        finish_run(run_id, "success", updated, updated)
        logger.info("완료: %d건 번역", updated)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("trump_translate", "unknown", str(exc), run_id)
        logger.error("번역 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
