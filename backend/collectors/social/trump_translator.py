"""Gemma 4 31B를 이용해 trump_posts의 content_ko가 없는 포스트를 한국어로 번역한다."""
import os
import time
from typing import Any
import httpx
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY", "")
_MODEL = "models/gemini-3.1-flash-lite-preview"
_BASE = "https://generativelanguage.googleapis.com/v1beta"
_RPM_DELAY = 4.5  # 15 RPM → 요청 사이 4.5초 간격


def _translate_one(text: str) -> str | None:
    """단일 텍스트를 한국어로 번역한다. 실패 시 None 반환."""
    prompt = (
        f"다음 영어 텍스트를 한국어로 번역하세요. "
        f"@멘션, URL, 고유명사는 그대로 유지하세요. "
        f"번역문만 출력하고 설명은 절대 쓰지 마세요.\n\n{text}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 512, "temperature": 0.1},
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{_BASE}/{_MODEL}:generateContent",
                params={"key": _API_KEY},
                json=payload,
            )
            resp.raise_for_status()
        candidates = resp.json().get("candidates", [])
        if not candidates:
            return None
        return candidates[0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


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
    for i, post in enumerate(posts):
        if i > 0:
            time.sleep(_RPM_DELAY)

        translated = _translate_one(post["content"])
        if not translated:
            continue

        patch = client.patch(
            "/trump_posts",
            params={"id": f"eq.{post['id']}"},
            json={"content_ko": translated},
            headers={"Prefer": "return=minimal"},
        )
        if patch.status_code in (200, 204):
            updated += 1

    return updated
