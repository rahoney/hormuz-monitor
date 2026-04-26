"""Gemini/Gemma를 이용해 trump_posts의 content_ko가 없는 포스트를 한국어로 번역한다."""
import time
from typing import Any

from dotenv import load_dotenv

from utils.gemini_client import GeminiError, generate_text, translation_models
from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)
_RPM_DELAY = 4.5  # 15 RPM → 요청 사이 4.5초 간격


def _translate_one(text: str) -> str | None:
    """단일 텍스트를 한국어로 번역한다. 실패 시 None 반환."""
    prompt = (
        f"다음 영어 텍스트를 한국어로 번역하세요. "
        f"@멘션, URL, 고유명사는 그대로 유지하세요. "
        f"번역문만 출력하고 설명은 절대 쓰지 마세요.\n\n{text}"
    )
    try:
        result = generate_text(
            prompt,
            task="trump_translate",
            models=translation_models(),
            max_output_tokens=512,
            temperature=0.1,
            timeout=30.0,
        )
        logger.info("트럼프 번역 Gemini 모델: %s (%d attempts)", result.model, result.attempts)
        return _clean_translation(result.text)
    except GeminiError as exc:
        logger.error("트럼프 번역 Gemini 호출 실패: %s", exc)
        return None


def _clean_translation(text: str) -> str:
    """Keep Gemma-style over-explaining out of the public feed."""
    cleaned = text.strip()
    for prefix in ("번역:", "번역문:", "Korean:", "Translation:"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    return cleaned.strip('"“”')


def translate_pending(client: Any, limit: int = 100) -> int:
    """content_ko가 없는 포스트를 번역하고 업데이트된 건수를 반환한다."""
    # content_ko가 NULL인 포스트 조회
    resp = client.get(
        "/trump_posts",
        params={
            "content_ko": "is.null",
            "order": "post_date.desc",
            "limit": limit,
            "select": "id,content",
        },
    )
    resp.raise_for_status()
    posts = resp.json()

    updated = 0
    failed = 0
    for i, post in enumerate(posts):
        if i > 0:
            time.sleep(_RPM_DELAY)

        translated = _translate_one(post["content"])
        if not translated:
            failed += 1
            continue

        patch = client.patch(
            "/trump_posts",
            params={"id": f"eq.{post['id']}"},
            json={"content_ko": translated},
            headers={"Prefer": "return=minimal"},
        )
        if patch.status_code in (200, 204):
            updated += 1

    if posts and updated == 0 and failed == len(posts):
        raise RuntimeError(f"모든 트럼프 포스트 번역 실패 ({failed}건)")

    return updated
