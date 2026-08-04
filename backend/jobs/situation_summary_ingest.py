"""Gemini로 호르무즈 상황 요약을 생성해 situation_summaries에 저장하는 잡."""
import sys
sys.path.insert(0, ".")

from collectors.summary.situation_summarizer import generate
from collectors.social.trump_translator import translate_pending
from db.client import get_client
from db.upsert import insert_returning
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

        ko, en, geo_score, ko_structured, en_structured = result
        record: dict = {
            "summary_ko": ko,
            "summary_en": en,
            "is_published": False,
        }
        if geo_score is not None:
            record["geo_score"] = geo_score
        if ko_structured:
            record["summary_ko_structured"] = ko_structured
        if en_structured:
            record["summary_en_structured"] = en_structured
        saved_rows = insert_returning("situation_summaries", [record])
        saved_id = saved_rows[0].get("id") if saved_rows else None
        if not saved_id:
            raise RuntimeError("저장된 상황 요약 id를 확인할 수 없음")

        from collectors.summary.situation_summarizer import LOCALE_NAME_MAP, translate_summary_for_locales
        from db.upsert import upsert

        source_structured = en_structured or ko_structured
        source_text = en or ko
        translations = translate_summary_for_locales(source_structured, source_text)
        trans_records = [
            {
                "summary_id": saved_id,
                "locale": locale,
                "summary_text": summary_text,
                "summary_structured": summary_structured,
                "model": model_name,
            }
            for locale, (summary_text, summary_structured, model_name) in translations.items()
        ]

        if trans_records:
            upsert("situation_summary_translations", trans_records, on_conflict="summary_id,locale")
            logger.info("다국어 사전 번역 DB 저장 (%d개 언어)", len(trans_records))

        missing_locales = sorted(set(LOCALE_NAME_MAP) - set(translations))
        if missing_locales:
            logger.warning(
                "상황 요약 일부 번역 미완료 (%d/%d): %s — 영문 요약으로 표시",
                len(trans_records),
                len(LOCALE_NAME_MAP),
                ", ".join(missing_locales),
            )

        with get_client() as client:
            publish_resp = client.patch(
                "/situation_summaries",
                params={"id": f"eq.{saved_id}", "is_published": "eq.false"},
                json={"is_published": True},
                headers={"Prefer": "return=representation"},
            )
            publish_resp.raise_for_status()
            published_rows = publish_resp.json()
        if not isinstance(published_rows, list) or len(published_rows) != 1:
            raise RuntimeError("상황 요약 게시 상태 변경 실패")

        finish_run(run_id, "success", 1, 1)
        logger.info(
            "완료: 요약 저장 (ko %d자, en %d words, geo_score %s, structured ko=%s en=%s)",
            len(ko),
            len(en.split()),
            geo_score,
            bool(ko_structured),
            bool(en_structured),
        )

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

    if failures:
        raise RuntimeError(f"상황 요약 통합 잡 일부 실패: {', '.join(failures)}")


if __name__ == "__main__":
    run()
