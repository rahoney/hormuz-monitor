"""Gemini를 이용해 호르무즈 상황 요약을 생성한다."""
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
from dotenv import load_dotenv

from db.select import fetch

load_dotenv()

_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY", "")
_MODEL = "models/gemini-3.1-flash-lite-preview"
_BASE = "https://generativelanguage.googleapis.com/v1beta"

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
            market_block = f"\n[Market Indices (live session)]\n" + " | ".join(parts)

    return f"""You are a concise analyst for the Hormuz Monitor dashboard.

Generate a situation summary AND a geopolitical tension score based on the data below.
- FOCUS: US-Iran war/negotiations and Trump's statements are the PRIMARY topic.
- Oil prices and market indices are SECONDARY (mention briefly).
- Korean: 150~400 characters (자).
- English: 60~150 words.
- SCORE: integer 1~30 measuring geopolitical tension for the Hormuz Strait.
  1~7 = Safe (peace agreement, strait open, ceasefire holding, normalization confirmed)
  8~15 = Caution (negotiations ongoing, talks in progress, ceasefire active but unresolved)
  16~22 = Warning (diplomatic breakdown, negotiations failed/suspended, escalating threats, sanctions increased)
  23~30 = Danger (military action imminent or underway, attack/seizure/blockade occurring or just confirmed)
  Use the full range — e.g. score 5 vs 3 or 20 vs 17 to reflect degrees within each band.
- Output ONLY these three lines, nothing else:
KO: [Korean summary]
EN: [English summary]
SCORE: [integer 1-30]

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
        resp = httpx.post(
            f"{_BASE}/{_MODEL}:generateContent",
            params={"key": _API_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.3},
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None

    ko, en, geo_score = "", "", None
    for line in text.splitlines():
        if line.startswith("KO:"):
            ko = line[3:].strip()
        elif line.startswith("EN:"):
            en = line[3:].strip()
        elif line.startswith("SCORE:"):
            raw = line[6:].strip()
            try:
                val = int(raw)
                geo_score = max(1, min(30, val))
            except ValueError:
                pass

    if not ko:
        return None
    return ko, en or "", geo_score
