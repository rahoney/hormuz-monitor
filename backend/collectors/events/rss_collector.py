"""Al Jazeera/BBC/Anadolu RSS에서 호르무즈 관련 기사를 수집한다."""
from datetime import date, timezone
from email.utils import parsedate_to_datetime
from typing import Any
import feedparser
import httpx

_SOURCES = [
    {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
    {"name": "BBC Middle East", "url": "http://feeds.bbci.co.uk/news/world/middle_east/rss.xml"},
    {"name": "Anadolu Agency", "url": "https://www.aa.com.tr/en/rss/default?cat=middle-east"},
]

_KEYWORDS = [
    "hormuz", "strait of hormuz",
    "iran", "gulf", "persian gulf", "arabian sea",
    "tanker", "oil", "lng", "sanctions",
    "ceasefire", "attack", "blockade", "escort",
]

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HormuzMonitor/1.0)"}


def _is_relevant(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in _KEYWORDS)


def _parse_date(entry: Any) -> str | None:
    for field in ("published", "updated"):
        val = getattr(entry, field, None)
        if val:
            try:
                dt = parsedate_to_datetime(val)
                return dt.astimezone(timezone.utc).date().isoformat()
            except Exception:
                pass
    return None


def _classify_event_type(title: str, summary: str) -> str:
    text = f"{title} {summary}".lower()
    if any(w in text for w in ["closure", "close", "blockade", "shut"]):
        return "closure"
    if any(w in text for w in ["reopen", "reopening"]):
        return "reopening"
    if any(w in text for w in ["ceasefire", "cease-fire", "truce"]):
        return "ceasefire"
    if any(w in text for w in ["negotiat", "talk", "deal", "agreement"]):
        return "negotiation"
    if any(w in text for w in ["attack", "strike", "missile", "drone", "bomb"]):
        return "attack"
    if any(w in text for w in ["sanction"]):
        return "sanctions"
    if any(w in text for w in ["escort", "convoy", "naval"]):
        return "escort_operation"
    return "negotiation"


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
            title = getattr(entry, "title", "") or ""
            summary = getattr(entry, "summary", "") or ""
            link = getattr(entry, "link", "") or ""

            if not _is_relevant(title + " " + summary):
                continue
            if link in seen_urls:
                continue
            seen_urls.add(link)

            event_date = _parse_date(entry)
            if not event_date:
                continue
            if since and event_date < since.isoformat():
                continue

            records.append({
                "event_date":  event_date,
                "event_type":  _classify_event_type(title, summary),
                "title":       title[:500],
                "summary":     summary[:1000] if summary else None,
                "source_name": source["name"],
                "source_url":  link[:1000] if link else None,
                "is_manual":   False,
            })

    return records
