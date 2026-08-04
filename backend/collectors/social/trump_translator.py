"""Pretranslate pending Truth Social posts before a visitor opens a locale."""
from __future__ import annotations

import json
from dataclasses import dataclass
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
_LOCALE_GROUP_SIZE = 3
_MAX_REQUESTS_PER_RUN = 5
_TARGET_LOCALES = (
    "ko", "ar", "fa", "ja", "es", "tr", "de", "fr", "pt-BR", "it", "zh-CN", "zh-TW", "ru",
)
_LOCALE_NAMES = {
    "ko": "Korean", "ar": "Arabic", "fa": "Persian", "ja": "Japanese", "es": "Spanish",
    "tr": "Turkish", "de": "German", "fr": "French", "pt-BR": "Brazilian Portuguese",
    "it": "Italian", "zh-CN": "Simplified Chinese", "zh-TW": "Traditional Chinese", "ru": "Russian",
}


@dataclass(frozen=True)
class TranslationProgress:
    requested: int
    saved: int
    failed_groups: int


def _locale_groups() -> tuple[tuple[str, ...], ...]:
    return tuple(
        _TARGET_LOCALES[index:index + _LOCALE_GROUP_SIZE]
        for index in range(0, len(_TARGET_LOCALES), _LOCALE_GROUP_SIZE)
    )


def _batch_posts(posts: list[dict[str, Any]], pending_locales: dict[int, set[str]], locales: tuple[str, ...]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    total_chars = 0
    for post in posts:
        post_id = post.get("id")
        text = str(post.get("content") or "")
        if not isinstance(post_id, int) or not text:
            continue
        requested_locales = sorted(pending_locales.get(post_id, set()).intersection(locales))
        if not requested_locales:
            continue
        if selected and (len(selected) >= _BATCH_MAX_POSTS or total_chars + len(text) > _BATCH_MAX_INPUT_CHARS):
            break
        selected.append({
            "post_id": post_id,
            "mode": "summarize" if len(text) > _LONG_TEXT_THRESHOLD else "translate",
            "target_locales": requested_locales,
            "text": text,
        })
        total_chars += len(text)
    return selected


def _batch_translation_schema(locales: tuple[str, ...]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "translations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "post_id": {"type": "integer"},
                        "locale": {"type": "string", "enum": list(locales)},
                        "content_translated": {"type": "string"},
                    },
                    "required": ["post_id", "locale", "content_translated"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["translations"],
        "additionalProperties": False,
    }


def _clean_translation(text: str) -> str:
    cleaned = text.strip()
    for prefix in ("번역:", "번역문:", "Korean:", "Translation:"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    return cleaned.strip('"“”')


def _translate_batch(posts: list[dict[str, Any]], locales: tuple[str, ...]) -> tuple[dict[tuple[int, str], str], str | None]:
    if not posts:
        return {}, None

    locale_instructions = ", ".join(f"{locale} ({_LOCALE_NAMES[locale]})" for locale in locales)
    prompt = f"""
Translate the supplied Truth Social posts into their requested target languages in one JSON response.

Allowed locales for this request: {locale_instructions}

Rules:
- Produce exactly one item for every requested post_id + locale pair and no other pair.
- For mode "translate", preserve complete meaning and tone.
- For mode "summarize", write a context-preserving 5-8 sentence summary retaining claims, numbers, targets, and conclusion.
- Preserve @mentions, URLs, and proper names whenever possible.
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
            task="trump_translate_group",
            models=translation_models(),
            max_output_tokens=16384,
            temperature=None,
            timeout=90.0,
            retries_per_model=1,
            extra_generation_config={
                "responseMimeType": "application/json",
                "responseJsonSchema": _batch_translation_schema(locales),
            },
            validate_text=_has_translations,
        )
    except GeminiError as exc:
        logger.warning("트럼프 사전 번역 그룹 실패 (%s): %s", ", ".join(locales), exc)
        return {}, None

    try:
        response_rows = json.loads(result.text)["translations"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.warning("트럼프 사전 번역 JSON 파싱 실패: %s", exc)
        return {}, None

    requested_pairs = {
        (post["post_id"], locale)
        for post in posts
        for locale in post["target_locales"]
    }
    modes = {post["post_id"]: post["mode"] for post in posts}
    translated: dict[tuple[int, str], str] = {}
    for row in response_rows:
        if not isinstance(row, dict):
            continue
        post_id = row.get("post_id")
        locale = row.get("locale")
        text = row.get("content_translated")
        pair = (post_id, locale)
        if not isinstance(post_id, int) or not isinstance(locale, str) or pair not in requested_pairs or pair in translated:
            continue
        if not isinstance(text, str) or not (cleaned := _clean_translation(text)):
            continue
        translated[pair] = _LONG_SUMMARY_PREFIX + cleaned if modes[post_id] == "summarize" else cleaned

    logger.info(
        "트럼프 사전 번역 Gemini 모델: %s (%d attempts, %d/%d건)",
        result.model,
        result.attempts,
        len(translated),
        len(requested_pairs),
    )
    return translated, result.model


def _pending_locales(client: Any, posts: list[dict[str, Any]]) -> dict[int, set[str]]:
    post_ids = [post["id"] for post in posts if isinstance(post.get("id"), int)]
    if not post_ids:
        return {}
    response = client.get(
        "/trump_post_translations",
        params={
            "post_id": f"in.({','.join(str(post_id) for post_id in post_ids)})",
            "select": "post_id,locale",
        },
    )
    response.raise_for_status()
    saved_pairs = {
        (row.get("post_id"), row.get("locale"))
        for row in response.json()
        if isinstance(row, dict)
    }
    pending: dict[int, set[str]] = {}
    for post in posts:
        post_id = post.get("id")
        if not isinstance(post_id, int):
            continue
        locales = {
            locale
            for locale in _TARGET_LOCALES
            if (locale == "ko" and not post.get("content_ko"))
            or (locale != "ko" and (post_id, locale) not in saved_pairs)
        }
        if locales:
            pending[post_id] = locales
    return pending


def _save_translations(client: Any, translated: dict[tuple[int, str], str], model: str) -> int:
    ko_rows = [(post_id, text) for (post_id, locale), text in translated.items() if locale == "ko"]
    localized_rows = [
        {
            "post_id": post_id,
            "locale": locale,
            "content_translated": text,
            "model": model,
        }
        for (post_id, locale), text in translated.items()
        if locale != "ko"
    ]
    saved = 0
    for post_id, text in ko_rows:
        response = client.patch(
            "/trump_posts",
            params={"id": f"eq.{post_id}"},
            json={"content_ko": text},
            headers={"Prefer": "return=minimal"},
        )
        if response.status_code in (200, 204):
            saved += 1
    if localized_rows:
        response = client.post(
            "/trump_post_translations",
            params={"on_conflict": "post_id,locale"},
            json=localized_rows,
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        response.raise_for_status()
        saved += len(localized_rows)
    return saved


def translate_pending(client: Any, limit: int = 100) -> TranslationProgress:
    """Pretranslate the latest pending posts without making page views call Gemini."""
    response = client.get(
        "/trump_posts",
        params={
            "order": "post_date.desc,posted_at.desc",
            "limit": limit,
            "select": "id,content,content_ko",
        },
    )
    response.raise_for_status()
    posts = response.json()
    pending = _pending_locales(client, posts)
    requested = saved = failed_groups = 0

    for locales in _locale_groups()[:_MAX_REQUESTS_PER_RUN]:
        batch = _batch_posts(posts, pending, locales)
        if not batch:
            continue
        requested += sum(len(post["target_locales"]) for post in batch)
        translated, model = _translate_batch(batch, locales)
        if not translated or not model:
            failed_groups += 1
            continue
        saved += _save_translations(client, translated, model)

    return TranslationProgress(requested=requested, saved=saved, failed_groups=failed_groups)
