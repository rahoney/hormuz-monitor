"""Al Jazeera/BBC/Anadolu/연합뉴스/한국경제/매일경제 RSS에서 호르무즈 관련 기사를 수집한다."""
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
import feedparser
import httpx

_SOURCES = [
    # 중동·에너지 카테고리 피드 + 제목 키워드 필터
    {"name": "BBC Middle East",  "url": "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",                                          "lang": "en"},
    {"name": "Anadolu Agency",   "url": "https://www.aa.com.tr/en/rss/default?cat=middle-east",                                             "lang": "en"},
    {"name": "NYT Middle East",  "url": "https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml",                                      "lang": "en"},
    {"name": "CNBC Energy",      "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768",               "lang": "en"},
    {"name": "CNBC World",       "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362",              "lang": "en"},
    {"name": "CNBC Asia",        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19832390",               "lang": "en"},
    # 공식 RSS가 없는 로이터/AP통신은 구글 뉴스 RSS의 site: 연산자 활용
    {"name": "Reuters",          "url": "https://news.google.com/rss/search?q=site%3Areuters.com%2Fworld%2Fmiddle-east+(Hormuz+OR+Iran+OR+Trump+OR+%22oil+price%22)+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen", "lang": "en"},
    {"name": "AP News",          "url": "https://news.google.com/rss/search?q=site%3Aapnews.com%2Farticle+(Hormuz+OR+Iran+OR+Trump+OR+%22oil+price%22)+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",           "lang": "en"},
    {"name": "연합뉴스",          "url": "https://www.yna.co.kr/rss/international.xml",                                                      "lang": "ko"},
    {"name": "한국경제",          "url": "https://www.hankyung.com/feed/international",                                                      "lang": "ko"},
    {"name": "매일경제",          "url": "https://www.mk.co.kr/rss/50200011/",                                                               "lang": "ko"},
]

# 트럼프, 호르무즈, 이란, 원유(석유) 4가지 중 1개 이상 포함된 기사만 수집
_CORE_EN = ["trump", "hormuz", "iran", "crude", "crude oil", "oil price"]
_CORE_KO = ["트럼프", "호르무즈", "이란", "원유", "석유"]

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HormuzMonitor/1.0)"}


def _is_relevant(text: str, lang: str) -> bool:
    low = text.lower()
    keywords = _CORE_KO if lang == "ko" else _CORE_EN
    return any(kw in low for kw in keywords)


def _parse_datetime(entry: Any) -> tuple[str | None, str | None]:
    """(event_date, published_at ISO) 반환. published_at은 UTC ISO8601."""
    for field in ("published", "updated"):
        val = getattr(entry, field, None)
        if val:
            try:
                dt = parsedate_to_datetime(val).astimezone(timezone.utc)
                return dt.date().isoformat(), dt.isoformat()
            except Exception:
                pass
    return None, None


def _classify_event_type(title: str, summary: str, lang: str) -> str:
    text = f"{title} {summary}".lower()
    if lang == "ko":
        if any(w in text for w in ["봉쇄", "폐쇄", "차단"]):
            return "closure"
        if any(w in text for w in ["재개", "개방"]):
            return "reopening"
        if any(w in text for w in ["휴전", "정전"]):
            return "ceasefire"
        if any(w in text for w in ["공격", "미사일", "드론", "폭격", "포격"]):
            return "attack"
        if any(w in text for w in ["제재"]):
            return "sanctions"
        if any(w in text for w in ["호위", "해군", "함대"]):
            return "escort_operation"
        if any(w in text for w in ["협상", "회담", "합의", "대화"]):
            return "negotiation"
        return "negotiation"
    else:
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
        lang = source.get("lang", "en")
        try:
            with httpx.Client(timeout=20.0, headers=_HEADERS, follow_redirects=True) as client:
                resp = client.get(source["url"])
                resp.raise_for_status()
            feed = feedparser.parse(resp.text)
        except Exception:
            continue

        for entry in feed.entries:
            title = getattr(entry, "title", "") or ""
            summary = getattr(entry, "summary", "") or ""
            link = getattr(entry, "link", "") or ""

            # 구글 뉴스 RSS의 경우 title 끝에 " - 언론사명"이 붙으므로 제거 (예: " - Reuters")
            if " - " in title:
                title = " - ".join(title.split(" - ")[:-1])

            # 구글 뉴스 RSS의 summary는 HTML 태그(<a href=...>...</a>)로 되어 있으므로, 태그를 제거하고 순수 텍스트만 추출
            import re
            summary = re.sub(r'<[^>]+>', '', summary).strip()
            # HTML 엔티티(&nbsp; 등) 정리
            summary = summary.replace("&nbsp;", " ")

            if not _is_relevant(title, lang):
                continue
            if link in seen_urls:
                continue
            seen_urls.add(link)

            event_date, published_at = _parse_datetime(entry)
            if not event_date:
                continue
            if since and event_date < since.isoformat():
                continue

            records.append({
                "event_date":   event_date,
                "published_at": published_at,
                "event_type":   _classify_event_type(title, summary, lang),
                "title":        title[:500],
                "summary":      summary[:1000] if summary else None,
                "source_name":  source["name"],
                "source_url":   link[:1000] if link else None,
                "is_manual":    False,
            })

    return records
