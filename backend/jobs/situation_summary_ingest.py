"""Gemini로 호르무즈 상황 요약을 생성해 situation_summaries에 저장하는 잡."""
import sys
sys.path.insert(0, ".")

from collectors.summary.situation_summarizer import generate
from collectors.social.trump_translator import translate_pending
from db.client import get_client
from db.upsert import insert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    failures: list[str] = []
    run_id = start_run("situation_summary")
    logger.info("상황 요약 생성 시작")

    try:
        result = generate()
        if not result:
            raise RuntimeError("요약 생성 실패 또는 빈 결과")

        ko, en, geo_score = result
        record: dict = {"summary_ko": ko, "summary_en": en}
        if geo_score is not None:
            record["geo_score"] = geo_score
        insert("situation_summaries", [record])
        finish_run(run_id, "success", 1, 1)
        logger.info("완료: 요약 저장 (ko %d자, en %d words, geo_score %s)",
                    len(ko), len(en.split()), geo_score)

    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("situation_summary", "unknown", str(exc), run_id)
        logger.error("요약 실패: %s", exc)
        failures.append("situation_summary")

    translate_run_id = start_run("trump_translate")
    logger.info("트럼프 포스트 번역 시작")
    try:
        with get_client() as client:
            updated = translate_pending(client)
        finish_run(translate_run_id, "success", updated, updated)
        logger.info("트럼프 포스트 번역 완료: %d건", updated)
    except Exception as exc:
        finish_run(translate_run_id, "failed", 0, 0)
        log_error("trump_translate", "unknown", str(exc), translate_run_id)
        logger.error("트럼프 포스트 번역 실패: %s", exc)
        failures.append("trump_translate")

    if failures:
        raise RuntimeError(f"상황 요약 통합 잡 일부 실패: {', '.join(failures)}")


if __name__ == "__main__":
    run()
