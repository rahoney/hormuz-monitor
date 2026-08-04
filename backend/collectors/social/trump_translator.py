"""Gemini를 이용해 미번역 Trump 포스트를 한국어로 일괄 번역한다."""
import json
from typing import Any

from dotenv import load_dotenv

from utils.gemini_client import GeminiError, generate_text, translation_models
from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)
_LONG_TEXT_THRESHOLD = 1500
_LONG_SUMMARY_PREFIX = "[긴 글 요약 번역]\n"
_BATCH_MAX_POSTS = 10
_BATCH_MAX_INPUT_CHARS = 16000


def _batch_posts(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    total_chars = 0
    for post in posts:
        text = str(post.get("content") or "")
        if not text:
            continue
        if selected and (len(selected) >= _BATCH_MAX_POSTS or total_chars + len(text) > _BATCH_MAX_INPUT_CHARS):
            break
        selected.append({
            "post_id": post["id"],
            "mode": "summarize" if len(text) > _LONG_TEXT_THRESHOLD else "translate",
            "text": text,
        })
        total_chars += len(text)
    return selected


def _batch_translation_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "translations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "post_id": {"type": "integer"},
                        "content_ko": {"type": "string"},
                    },
                    "required": ["post_id", "content_ko"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["translations"],
        "additionalProperties": False,
    }


def _translate_batch(posts: list[dict[str, Any]]) -> dict[int, str]:
    if not posts:
        return {}

    prompt = f"""
Translate the supplied Truth Social posts into Korean in one JSON response.

Rules:
- For mode "translate", preserve the complete meaning and tone.
- For mode "summarize", write a context-preserving Korean summary in about 5-8 sentences, retaining core claims, numbers, targets, and conclusion.
- Preserve @mentions, URLs, and proper names exactly whenever possible.
- Return exactly one item for each input post_id. Do not add any post_id.
- Output only JSON matching the supplied schema.

Posts:
{json.dumps(posts, ensure_ascii=False)}
""".strip()

    def _has_translations(text: str) -> bool:
        try:
            parsed = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return False
        return isinstance(parsed, dict) and isinstance(parsed.get("translations"), list)

    try:
        result = generate_text(
            prompt,
            task="trump_translate_batch",
            models=translation_models(),
            max_output_tokens=16384,
            temperature=None,
            timeout=90.0,
            retries_per_model=1,
            extra_generation_config={
                "responseMimeType": "application/json",
                "responseJsonSchema": _batch_translation_schema(),
            },
            validate_text=_has_translations,
        )
    except GeminiError as exc:
        logger.error("트럼프 일괄 번역 실패: %s", exc)
        return {}

    try:
        response_rows = json.loads(result.text)["translations"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.error("트럼프 일괄 번역 JSON 파싱 실패: %s", exc)
        return {}

    modes = {post["post_id"]: post["mode"] for post in posts}
    translated: dict[int, str] = {}
    for row in response_rows:
        if not isinstance(row, dict):
            continue
        post_id = row.get("post_id")
        text = row.get("content_ko")
        if not isinstance(post_id, int) or post_id not in modes or post_id in translated:
            continue
        if not isinstance(text, str) or not (cleaned := _clean_translation(text)):
            continue
        translated[post_id] = _LONG_SUMMARY_PREFIX + cleaned if modes[post_id] == "summarize" else cleaned

    logger.info(
        "트럼프 일괄 번역 Gemini 모델: %s (%d attempts, %d/%d건)",
        result.model,
        result.attempts,
        len(translated),
        len(posts),
    )
    return translated


def _clean_translation(text: str) -> str:
    """Keep Gemma-style over-explaining out of the public feed."""
    cleaned = text.strip()
    for prefix in ("번역:", "번역문:", "Korean:", "Translation:"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    return cleaned.strip('"“”')


def translate_pending(client: Any, limit: int = 100) -> int:
    """content_ko가 없는 포스트 한 배치를 Gemini 한 번으로 번역한다."""
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

    batch = _batch_posts(posts)
    translated_by_id = _translate_batch(batch)
    updated = 0
    for post_id, translated in translated_by_id.items():

        patch = client.patch(
            "/trump_posts",
            params={"id": f"eq.{post_id}"},
            json={"content_ko": translated},
            headers={"Prefer": "return=minimal"},
        )
        if patch.status_code in (200, 204):
            updated += 1

    if batch and not translated_by_id:
        raise RuntimeError(f"트럼프 포스트 일괄 번역 실패 ({len(batch)}건)")

    return updated
