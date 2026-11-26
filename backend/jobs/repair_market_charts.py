"""Preview repairs for selected daily chart dates and five-minute bars."""
import argparse
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path

import yfinance as yf

from collectors.market.sessions import FIVE_MINUTES, sessions_for
from collectors.market.yfinance_collector import (
    SYMBOLS,
    YAHOO_OVERNIGHT_TIMEZONE,
    calendar_for,
    daily_rows,
    overnight,
    price_value,
)
from db.client import get_client


def _get_row(client, table: str, **filters) -> dict | None:
    response = client.get(f"/{table}", params={"source": "eq.yfinance", "limit": 1, **filters})
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def _daily_candidate(client, symbol: str, day: date) -> dict | None:
    stored = _get_row(client, "market_ohlcv", symbol=f"eq.{symbol}", price_date=f"eq.{day}")
    if stored is None:
        return None
    ticker = yf.Ticker(SYMBOLS[symbol]["ticker"])
    end = (day + timedelta(days=1)).isoformat()
    # Overlapping requests must return the same full candle with this exact Yahoo date label.
    responses = [
        {row["price_date"]: row for row in daily_rows(symbol, ticker.history(
            start=start.isoformat(), end=end, interval="1d", auto_adjust=True, timeout=15,
        ))}
        for start in (day - timedelta(days=7), day)
    ]
    candle = responses[0].get(day.isoformat())
    if candle is None or candle != responses[1].get(day.isoformat()):
        return None
    values = {key: candle[key] for key in ("open", "high", "low", "close")}
    if all(price_value(stored[key]) == value for key, value in values.items()):
        return None
    return {"table": "market_ohlcv", "before": stored, "after": values,
            "basis": "Yahoo overlapping closed daily requests agree"}


def _bar_candidate(client, symbol: str, stamp: datetime) -> dict | None:
    end = stamp + FIVE_MINUTES
    schedule = sessions_for(calendar_for(symbol), stamp.date() - timedelta(days=2),
                             stamp.date() + timedelta(days=2))
    if not any((window := session.window_for(stamp)) and end <= window[1] for session in schedule):
        return None
    stored = _get_row(client, "market_intraday", symbol=f"eq.{symbol}", recorded_at=f"eq.{stamp.isoformat()}")
    if stored is None:
        return None
    ticker = yf.Ticker(SYMBOLS[symbol]["ticker"])
    samples = {
        interval: {ts: price_value(row["Close"]) for ts, row in ticker.history(
            start=stamp, end=end, interval=interval, prepost=True, timeout=15,
        ).iterrows() if stamp <= ts < end}
        for interval in ("5m", "1m")
    }
    target = samples["5m"].get(stamp)
    expected_minutes = [stamp + timedelta(minutes=minute) for minute in range(5)]
    minute_prices = [samples["1m"].get(minute) for minute in expected_minutes]
    old_price = price_value(stored["price"])
    if (target is None or None in minute_prices or minute_prices[-1] != target
            or old_price == target or old_price not in minute_prices[:-1]):
        return None
    return {"table": "market_intraday", "before": stored, "after": {"price": target},
            "basis": "Yahoo 5m close agrees with the last of five complete 1m bars", "minute_prices": minute_prices}


def audit(client, days: list[date], bars: list[tuple[str, datetime]], now: datetime) -> dict:
    changes = []
    skipped = []
    for day in sorted(set(days)):
        if day >= now.astimezone(YAHOO_OVERNIGHT_TIMEZONE).date():
            raise ValueError(f"Yahoo's New York day has not closed: {day}")
        for symbol in SYMBOLS:
            if not overnight(symbol):
                continue
            item = _daily_candidate(client, symbol, day)
            if item:
                changes.append(item)
            else:
                skipped.append({"symbol": symbol, "price_date": day.isoformat()})
    for symbol, stamp in sorted(set(bars)):
        if stamp + FIVE_MINUTES > now:
            raise ValueError(f"Five-minute bar has not closed: {symbol} {stamp}")
        item = _bar_candidate(client, symbol, stamp)
        if item:
            changes.append(item)
        else:
            skipped.append({"symbol": symbol, "recorded_at": stamp.isoformat()})
    return {
        "daily_dates": [day.isoformat() for day in days],
        "five_minute": [[symbol, stamp.isoformat()] for symbol, stamp in bars],
        "changes": changes,
        "unchanged_or_unconfirmed": skipped,
    }


def apply_reviewed(client, approved: dict, fresh: dict) -> dict:
    current = {(item["table"], item["before"]["id"]): item for item in fresh["changes"]}
    outcome = {"applied": [], "skipped": []}
    for item in approved["changes"]:
        before = item["before"]
        key = (item["table"], before["id"])
        if current.get(key) != item:
            outcome["skipped"].append(key)
            continue
        fields = ("id", "symbol", "price_date", "open", "high", "low", "close", "source") if key[0] == "market_ohlcv" else (
            "id", "symbol", "recorded_at", "price", "source",
        )
        response = client.patch(f"/{key[0]}", params={field: f"eq.{before[field]}" for field in fields},
                                json=item["after"], headers={"Prefer": "return=representation"})
        response.raise_for_status()
        outcome["applied" if response.json() else "skipped"].append(key)
    return outcome


def _parse_bar(value: str) -> tuple[str, datetime]:
    symbol, _, raw_time = value.partition("@")
    timestamp = datetime.fromisoformat(raw_time)
    if (symbol not in SYMBOLS or timestamp.tzinfo is None or timestamp.minute % 5
            or timestamp.second or timestamp.microsecond):
        raise ValueError("Expected SYMBOL@timestamp with a timezone on a five-minute boundary")
    return symbol, timestamp.astimezone(timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--daily-date", action="append", type=date.fromisoformat, default=[],
                        help="Closed New York date for the six overnight chart tickers")
    parser.add_argument("--five-minute", action="append", type=_parse_bar, default=[], metavar="SYMBOL@TIMESTAMP")
    parser.add_argument("--apply", type=Path, metavar="REVIEWED_REPORT_JSON")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    with get_client() as client:
        if args.apply:
            approved = json.loads(args.apply.read_text())
            days = [date.fromisoformat(day) for day in approved["daily_dates"]]
            bars = [_parse_bar(f"{symbol}@{timestamp}") for symbol, timestamp in approved["five_minute"]]
            print(json.dumps(apply_reviewed(client, approved, audit(client, days, bars, now)), indent=2))
        else:
            print(json.dumps(audit(client, args.daily_date, args.five_minute, now), indent=2))


if __name__ == "__main__":
    main()
