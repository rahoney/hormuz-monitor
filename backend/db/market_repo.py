"""Bounded market history reads and atomic snapshot writes."""
from datetime import datetime, timezone

from collectors.market.sessions import MAX_DELAY, Session
from collectors.market.yfinance_collector import overnight, snapshot_sessions
from db.client import get_client


def fetch_recent_daily(sessions: dict[str, tuple[Session, ...]], now: datetime) -> list[dict]:
    needed = [s.day for schedule in sessions.values() for s in snapshot_sessions(schedule, now)]
    if not needed:
        return []
    with get_client() as client:
        response = client.get("/market_ohlcv", params={
            "select": "symbol,price_date,close",
            "source": "eq.yfinance",
            "price_date": f"gte.{min(needed).isoformat()}",
        })
        response.raise_for_status()
        return response.json()


def fetch_recent_bars(sessions: dict[str, tuple[Session, ...]], now: datetime) -> list[dict]:
    """Read only the bars that could be chosen, including an overnight reference close."""
    ranges = []
    for symbol, schedule in sessions.items():
        recent = snapshot_sessions(schedule, now)
        for session in recent if overnight(symbol) else recent[1:]:
            end = session.last_trading_time(now)
            start = max(session.opens, end - MAX_DELAY)
            ranges.append(
                f"and(symbol.eq.{symbol},recorded_at.gte.{start.astimezone(timezone.utc).isoformat()},"
                f"recorded_at.lte.{end.astimezone(timezone.utc).isoformat()})"
            )
    if not ranges:
        return []
    with get_client() as client:
        response = client.get("/market_intraday", params={
            "select": "symbol,recorded_at,price",
            "source": "eq.yfinance",
            "or": f"({','.join(ranges)})",
        })
        response.raise_for_status()
        return response.json()


def upsert_market_snapshots(rows: list[dict]) -> int:
    if not rows:
        return 0
    with get_client() as client:
        response = client.post("/rpc/upsert_market_snapshots", json={"snapshots": rows})
        response.raise_for_status()
        return int(response.json())
