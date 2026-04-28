"""Gemini를 이용해 호르무즈 상황 요약을 생성한다."""
from datetime import datetime, timezone, timedelta
from typing import Any

from dotenv import load_dotenv

from db.select import fetch
from utils.gemini_client import GeminiError, generate_text, summary_models
from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

# 미국 동부 기준 pre-market~after-hours: UTC 08:00~01:00 (weekday)
# UTC 01:00~08:00 구간(심야)에는 시장 데이터 미포함
_MARKET_EXCLUDED_UTC_HOURS = set(range(1, 8))

_EN_SOURCES = {"BBC Middle East", "Anadolu Agency", "NYT Middle East",
               "CNBC Energy", "CNBC World", "CNBC Asia"}


def _is_market_session() -> bool:
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:  # 토·일
        return False
    return now.hour not in _MARKET_EXCLUDED_UTC_HOURS


def _fetch_recent_events(hours: int = 24) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = fetch(
        "events",
        columns="title,source_name,published_at",
        filters={"published_at": f"gte.{since}"},
        order="published_at.desc",
        limit=20,
    )
    return [r for r in rows if r.get("source_name") in _EN_SOURCES]


def _fetch_trump_posts(hours: int = 24) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).date().isoformat()
    return fetch(
        "trump_posts",
        columns="content,post_date",
        filters={"post_date": f"gte.{since}"},
        order="post_date.desc",
        limit=10,
    )


def _fetch_oil() -> dict[str, float | None]:
    result: dict[str, float | None] = {"WTI": None, "BRENT": None}
    for sym in ("WTI", "BRENT"):
        rows = fetch("oil_price_series", columns="price_usd",
                     filters={"symbol": f"eq.{sym}"},
                     order="price_date.desc", limit=1)
        if rows:
            result[sym] = rows[0].get("price_usd")
    return result


def _fetch_gasoline() -> float | None:
    rows = fetch(
        "gasoline_prices",
        columns="price_usd",
        filters={"area_code": "eq.US", "area_type": "eq.national"},
        order="price_date.desc",
        limit=1,
    )
    if not rows:
        # area_type 컬럼 없는 경우 fallback
        rows = fetch("gasoline_prices", columns="price_usd,area_type",
                     order="price_date.desc", limit=5)
        national = [r for r in rows if r.get("area_type") == "national"]
        rows = national[:1]
    return rows[0].get("price_usd") if rows else None


def _fetch_market() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for sym in ("SP500", "NASDAQ", "VIX"):
        rows = fetch("market_snapshots", columns="price,change_pct",
                     filters={"symbol": f"eq.{sym}"},
                     order="snapshot_date.desc", limit=1)
        if rows:
            result[sym] = rows[0]
    return result


def _build_prompt(events: list, trump: list, oil: dict,
                  gasoline: float | None, market: dict) -> str:
    news_block = "\n".join(
        f"- [{r['source_name']}] {r['title']}" for r in events
    ) or "(no recent headlines)"

    trump_block = "\n".join(
        f"- {r['content'][:200]}" for r in trump
    ) or "(no recent posts)"

    wti_str = f"${oil['WTI']:.2f}/bbl" if oil.get("WTI") else "N/A"
    brent_str = f"${oil['BRENT']:.2f}/bbl" if oil.get("BRENT") else "N/A"
    gas_str = f"${gasoline:.3f}/gal" if gasoline else "N/A"

    market_block = ""
    if _is_market_session() and market:
        parts = []
        for sym, label in (("SP500", "S&P500"), ("NASDAQ", "NASDAQ"), ("VIX", "VIX")):
            if sym in market:
                p = market[sym].get("price", "")
                c = market[sym].get("change_pct")
                chg = f" ({c:+.2f}%)" if c is not None else ""
                parts.append(f"{label}: {p}{chg}")
        if parts:
            market_block = "\n[Market Indices (live session)]\n" + " | ".join(parts)

    return f"""You are a concise analyst for the Hormuz Monitor dashboard.

주어진 데이터를 바탕으로 한국어 요약을 먼저 작성하라.
한국어 요약은 내용이 간단하더라도 최소 150자 이상으로 작성하고, 내용이 다양하거나 추가 설명이 필요한 경우에는 450자 이내에서 충분히 길게 작성하라. 이 글자 수 기준은 한국어 요약문에만 적용한다. 150자는 최소 기준일 뿐이며, 가능한 한 짧게 쓰라는 의미가 아니다. 핵심 내용, 배경, 주요 수치, 관련 주체, 영향 또는 전망 등 중요한 정보는 글자 수를 줄이기 위해 과도하게 생략하지 말라.
- FOCUS: US-Iran war/negotiations and Trump's statements are the PRIMARY topic. Oil prices and market indices are SECONDARY.

요약문은 불렛 포인트와 마크다운 문법을 사용해 읽기 좋게 정돈하되, 제목·불릿·강조 표시는 내용의 구조를 이해하는 데 도움이 되도록 적절히 사용하라.

그다음, 작성한 한국어 요약문을 내용 누락, 추가, 변형 없이 영어로 정확히 번역하라. 영어 번역은 한국어 요약문의 의미와 구조를 가능한 한 그대로 유지하되, 영어로 자연스럽게 읽히도록 작성하라.

마지막으로, 현재 호르무즈 해협의 지정학적 긴장도를 나타내는 SCORE(정수 1~30)를 산출하라.
- 1~7 = Safe (peace agreement, strait open, ceasefire holding, normalization confirmed)
- 8~15 = Caution (negotiations ongoing, talks in progress, ceasefire active but unresolved)
- 16~22 = Warning (diplomatic breakdown, negotiations failed/suspended, escalating threats, sanctions increased)
- 23~30 = Danger (military action imminent or underway, attack/seizure/blockade occurring or just confirmed)

Output ONLY these three sections, nothing else. The summaries can be multi-line:
### KO
[Korean Markdown summary]
### EN
[English Markdown summary]
### SCORE
[integer 1-30]

[Recent News Headlines (last 24h)]
{news_block}

[Trump Recent Posts (last 24h)]
{trump_block}

[Oil Prices]
WTI: {wti_str} | Brent: {brent_str}

[US Gasoline (national avg)]
{gas_str}
{market_block}"""


def generate() -> tuple[str, str, int | None] | None:
    """(summary_ko, summary_en, geo_score) 반환. 실패 시 None."""
    events = _fetch_recent_events()
    trump = _fetch_trump_posts()
    oil = _fetch_oil()
    gasoline = _fetch_gasoline()
    market = _fetch_market() if _is_market_session() else {}

    prompt = _build_prompt(events, trump, oil, gasoline, market)

    try:
        result = generate_text(
            prompt,
            task="situation_summary",
            models=summary_models(),
            max_output_tokens=1024,
            temperature=0.3,
            timeout=30.0,
        )
        text = result.text
        logger.info("상황 요약 Gemini 모델: %s (%d attempts)", result.model, result.attempts)
    except GeminiError as exc:
        logger.error("상황 요약 Gemini 호출 실패: %s", exc)
        return None

    import re
    
    # AI가 헤더에 굵은 글씨나 공백을 넣어도 무시하고 잡아내는 정규식
    ko_match = re.search(r'###\s*\*?KO\b\*?:?(.*?)(?=###\s*\*?EN\b|\Z)', text, re.IGNORECASE | re.DOTALL)
    en_match = re.search(r'###\s*\*?EN\b\*?:?(.*?)(?=###\s*\*?SCORE\b|\Z)', text, re.IGNORECASE | re.DOTALL)
    score_match = re.search(r'###\s*\*?SCORE\b\*?:?\s*(\d+)', text, re.IGNORECASE)

    ko = ko_match.group(1).strip() if ko_match else ""
    en = en_match.group(1).strip() if en_match else ""
    
    geo_score = None
    if score_match:
        try:
            val = int(score_match.group(1))
            geo_score = max(1, min(30, val))
        except ValueError:
            pass

    if not ko:
        return None
    return ko, en, geo_score
