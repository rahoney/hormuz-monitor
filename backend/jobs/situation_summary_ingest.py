"""Gemini로 호르무즈 상황 요약을 생성해 situation_summaries에 저장하는 잡."""
import sys
sys.path.insert(0, ".")

from collectors.summary.situation_summarizer import generate
from db.upsert import insert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def run() -> None:
    run_id = start_run("situation_summary")
    logger.info("상황 요약 생성 시작")

    try:
        result = generate()
        if not result:
            logger.warning("요약 생성 실패 또는 빈 결과")
            finish_run(run_id, "success", 0, 0)
            return

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
        raise


if __name__ == "__main__":
    run()
