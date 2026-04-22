"""trumpstruth.org RSS에서 트럼프 소셜 미디어 포스트를 수집한다."""
import html
import re
from datetime import date, timezone
from email.utils import parsedate_to_datetime
from typing import Any
import feedparser
import httpx

_SOURCES = [
    {"name": "Truth Social", "url": "https://trumpstruth.org/feed"},
]

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HormuzMonitor/1.0)"}


def _strip_html(raw: str) -> str:
    """HTML 태그 제거 후 텍스트만 반환한다."""
    # 엔티티 먼저 디코딩 (&lt;p&gt; → <p>)
    text = html.unescape(raw)
    # <br>, </p> → 줄바꿈
    text = re.sub(r"<br\s*/?>|</p>", "\n", text, flags=re.IGNORECASE)
    # 나머지 태그 제거
    text = re.sub(r"<[^>]+>", "", text)
    # 중첩 인코딩 처리
    text = html.unescape(text)
    # 연속 공백/줄바꿈 정리
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _is_valid(content: str) -> bool:
    """빈 포스트, RT 링크만 있는 포스트를 걸러낸다."""
    if not content:
        return False
    # URL만 있는 경우 (RT: https://... 형태)
    stripped = re.sub(r"RT:\s*https?://\S+", "", content).strip()
    return bool(stripped)


def _parse_dt(entry: Any) -> tuple[str | None, str | None]:
    """(post_date ISO, posted_at ISO) 반환"""
    for field in ("published", "updated"):
        val = getattr(entry, field, None)
        if val:
            try:
                dt = parsedate_to_datetime(val).astimezone(timezone.utc)
                return dt.date().isoformat(), dt.isoformat()
            except Exception:
                pass
    return None, None


def collect(since: date | None = None) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for source in _SOURCES:
        try:
            with httpx.Client(timeout=20.0, headers=_HEADERS) as client:
                resp = client.get(source["url"])
                resp.raise_for_status()
            feed = feedparser.parse(resp.text)
        except Exception:
            continue

        for entry in feed.entries:
            title   = getattr(entry, "title",   "") or ""
            summary = getattr(entry, "summary", "") or ""
            link    = getattr(entry, "link",    "") or ""

            # HTML 제거 후 텍스트 추출 (summary 우선)
            raw = summary.strip() if summary.strip() else title.strip()
            content = _strip_html(raw)
            if not _is_valid(content):
                continue
            if link and link in seen_urls:
                continue
            if link:
                seen_urls.add(link)

            post_date, posted_at = _parse_dt(entry)
            if not post_date:
                continue
            if since and post_date < since.isoformat():
                continue

            records.append({
                "post_date":   post_date,
                "posted_at":   posted_at,
                "content":     content[:2000],
                "source_url":  link[:1000] if link else None,
                "source_name": source["name"],
            })

    return records
