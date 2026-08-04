"""Event article summary cache and generation with 14-locale support and 2-step token-efficient translation."""
from __future__ import annotations

import json
import os
from typing import Any, Literal

from db.select import fetch
from db.upsert import upsert
from utils.gemini_client import GeminiError, generate_text

Locale = Literal[
    "ko", "en", "ar", "fa", "ja", "es", "tr",
    "de", "fr", "pt-BR", "it", "zh-CN", "zh-TW", "ru"
]

_DEFAULT_MODELS = (
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.1-flash-lite",
    "models/gemini-3.5-flash",
)

_LOCALE_NAMES: dict[str, str] = {
    "ko": "Korean",
    "en": "English",
    "ar": "Arabic",
    "fa": "Persian",
    "ja": "Japanese",
    "es": "Spanish",
    "tr": "Turkish",
    "de": "German",
    "fr": "French",
    "pt-BR": "Brazilian Portuguese",
    "it": "Italian",
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
    "ru": "Russian",
}


def _summary_models() -> list[str]:
    raw = os.getenv("ARTICLE_SUMMARY_MODELS", "")
    models = [model.strip() for model in raw.split(",") if model.strip()]
    return models or list(_DEFAULT_MODELS)


def _load_event(event_id: int) -> dict[str, Any]:
    rows = fetch(
        "events",
        columns="id,event_date,event_type,title,summary,source_name,source_url,published_at,severity",
        filters={"id": f"eq.{event_id}"},
        limit=1,
    )
    if not rows:
        raise ValueError("event not found")
    return rows[0]


def _load_cached(event_id: int, locale: str) -> dict[str, Any] | None:
    rows = fetch(
        "event_article_summaries",
        columns="event_id,source_url,locale,summary,model,created_at",
        filters={"event_id": f"eq.{event_id}", "locale": f"eq.{locale}"},
        order="created_at.desc",
        limit=1,
    )
    return rows[0] if rows else None


def _full_prompt(event: dict[str, Any], locale: str) -> str:
    language = _LOCALE_NAMES.get(locale, "English")
    source_summary = event.get("summary") or ""
    return f"""
You summarize a news item for a Hormuz Strait monitoring dashboard.

Rules:
- Write in {language}.
- Use only the provided metadata and excerpt.
- Do not add facts, numbers, quotes, causes, or conclusions that are not present.
- Summarize the article content only.
- Do not say how the event is classified.
- Do not mention the event type, severity, source, URL, publication time, or provided metadata.
- Do not mention that information is missing.
- Keep it concise: 3 to 5 sentences.
- Do not include markdown.
- Return only one JSON object: {{"summary":"..."}}
- If strict JSON is not possible, return only the summary text and nothing else.

Article metadata:
Title: {event.get("title") or ""}
Source: {event.get("source_name") or ""}
Event type: {event.get("event_type") or ""}
Severity: {event.get("severity") or ""}
Published at: {event.get("published_at") or event.get("event_date") or ""}
Existing excerpt/summary: {source_summary}
Original URL: {event.get("source_url") or ""}
""".strip()


def _translate_prompt(base_summary: str, target_locale: str) -> str:
    target_language = _LOCALE_NAMES.get(target_locale, "English")
    return f"""
Translate the following article summary into {target_language}.

Rules:
- Preserve the exact meaning and tone.
- Do not add or remove information.
- Keep the same 3 to 5 sentence structure.
- Do not include markdown.
- Return only one JSON object: {{"summary":"..."}}
- If strict JSON is not possible, return only the summary text.

Summary to translate:
{base_summary}
""".strip()


def _parse_summary(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`").strip()
        if stripped.lower().startswith("json"):
            stripped = stripped[4:].strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if 0 <= start < end:
        candidate = stripped[start:end + 1]
    else:
        candidate = stripped
    try:
        payload = json.loads(candidate)
        summary = str(payload.get("summary", "")).strip()
    except json.JSONDecodeError:
        summary = stripped

    if not summary:
        raise GeminiError("empty article summary")
    return summary[:2000]


def get_or_create_summary(event_id: int, locale: Locale) -> dict[str, Any]:
    cached = _load_cached(event_id, locale)
    event = _load_event(event_id)
    if cached:
        return {
            **cached,
            "event": event,
            "cached": True,
        }

    # 토큰 효율화: 요청된 locale 캐시가 없고 en/ko가 아니면 기존 en/ko 요약을 바탕으로 번역 수행
    prompt_str: str
    base_cached: dict[str, Any] | None = None
    if locale not in ("en", "ko"):
        base_cached = _load_cached(event_id, "en") or _load_cached(event_id, "ko")

    if base_cached and base_cached.get("summary"):
        prompt_str = _translate_prompt(base_cached["summary"], locale)
    else:
        prompt_str = _full_prompt(event, locale)

    result = generate_text(
        prompt_str,
        task="event_article_summary",
        models=_summary_models(),
        max_output_tokens=420,
        temperature=None,
        timeout=45.0,
        retries_per_model=2,
    )
    summary = _parse_summary(result.text)
    record = {
        "event_id": event_id,
        "source_url": event.get("source_url"),
        "locale": locale,
        "summary": summary,
        "model": result.model,
    }
    upsert("event_article_summaries", [record], on_conflict="event_id,locale")

    return {
        **record,
        "created_at": None,
        "event": event,
        "cached": False,
    }
