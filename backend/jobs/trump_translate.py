"""Pretranslate Trump posts for every supported dashboard locale."""
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
            progress = translate_pending(client)
        status = "partial" if progress.failed_groups else "success"
        finish_run(run_id, status, progress.requested, progress.saved)
        if progress.failed_groups:
            message = f"{progress.failed_groups}개 트럼프 번역 그룹이 다음 회차 재시도 대상으로 남음"
            log_error("trump_translate", "gemini", message, run_id)
            logger.warning("%s (저장 %d/%d)", message, progress.saved, progress.requested)
        else:
            logger.info("완료: %d/%d건 사전 번역", progress.saved, progress.requested)
    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("trump_translate", "unknown", str(exc), run_id)
        logger.error("번역 잡 오류(다음 회차 재시도): %s", exc)


if __name__ == "__main__":
    run()
