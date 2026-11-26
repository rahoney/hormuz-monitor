"""Collect Yahoo chart data and build snapshots for verified trading sessions."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
import math
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

from collectors.market.sessions import FIVE_MINUTES, MAX_DELAY, OVERNIGHT, Session, sessions_for
from utils.logger import get_logger

logger = get_logger(__name__)

_SYMBOLS: list[dict[str, str]] = [
    {"symbol": "VIX", "ticker": "^VIX", "exchange": "NYSE", "calendar": "VIX"},
    {"symbol": "NASDAQ", "ticker": "^IXIC", "exchange": "NYSE"},
    {"symbol": "SP500", "ticker": "^GSPC", "exchange": "NYSE"},
    {"symbol": "KOSPI", "ticker": "^KS11", "exchange": "KRX"},
    {"symbol": "KOSDAQ", "ticker": "^KQ11", "exchange": "KRX"},
    {"symbol": "ES_FUTURES", "ticker": "ES=F", "exchange": "CME", "calendar": "CME_EQUITY"},
    {"symbol": "NQ_FUTURES", "ticker": "NQ=F", "exchange": "CME", "calendar": "CME_EQUITY"},
    {"symbol": "GOLD_FUTURES", "ticker": "GC=F", "exchange": "CME", "calendar": "CME_METALS"},
    {"symbol": "USD_INDEX", "ticker": "DX-Y.NYB", "exchange": "ICE"},
    {"symbol": "GASOLINE_FUTURES", "ticker": "RB=F", "exchange": "CME", "calendar": "CME_ENERGY"},
    {"symbol": "HEATING_OIL_FUTURES", "ticker": "HO=F", "exchange": "CME", "calendar": "CME_ENERGY"},
    {"symbol": "STOXX600", "ticker": "^STOXX", "exchange": "STOXX"},
    {"symbol": "NIKKEI225", "ticker": "^N225", "exchange": "TSE"},
    {"symbol": "HANG_SENG", "ticker": "^HSI", "exchange": "HKEX"},
    {"symbol": "SHANGHAI", "ticker": "000001.SS", "exchange": "SSE"},
    {"symbol": "US10Y", "ticker": "^TNX", "exchange": "NYSE", "calendar": "US10Y"},
]
SYMBOLS = {s["symbol"]: s for s in _SYMBOLS}
CLOSE_PUBLICATION_DELAY = timedelta(minutes=10)
YAHOO_OVERNIGHT_TIMEZONE = ZoneInfo("America/New_York")
# HKEX can finish its auction at 16:08–16:10. Yahoo's TNX feed ends just before 14:00 Chicago.
_CLOSE_QUOTE_TOLERANCE = {"HKEX": timedelta(minutes=2), "US10Y": timedelta(minutes=1)}
# Yahoo's historical candles disagree with its recorded live closes on these dates.
# The saved live values agree with Nasdaq's published daily closes to two decimals (FRED NASDAQCOM).
_VERIFIED_NASDAQ_CLOSES = {
    "2026-10-06": 27599.8867,
    "2026-11-02": 25164.3633,
}


def calendar_for(symbol: str) -> str:
    config = SYMBOLS[symbol]
    return config.get("calendar", config["exchange"])


def overnight(symbol: str) -> bool:
    return calendar_for(symbol) in OVERNIGHT


def market_sessions(now: datetime) -> dict[str, tuple[Session, ...]]:
    result = {}
    for symbol in SYMBOLS:
        try:
            result[symbol] = sessions_for(calendar_for(symbol), now.date() - timedelta(days=21),
                                          now.date() + timedelta(days=3))
        except Exception:
            logger.exception("Market calendar unavailable for %s", symbol)
    return result


def price_value(value: Any) -> float | None:
    raw = value.iloc[0] if hasattr(value, "iloc") else value
    try:
        number = float(raw)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(number):
        return None
    rounded = round(number, 4)
    return rounded if rounded > 0 else None


def change_percent(price: float, previous: float | None) -> float | None:
    if previous:
        change = (price / previous - 1) * 100
        if math.isfinite(change):
            return round(change, 4)
    return None


def daily_rows(symbol: str, frame) -> list[dict]:
    rows = {}
    for timestamp, row in frame.iterrows():
        if pd.isna(timestamp):
            continue
        day = timestamp.date().isoformat()  # Yahoo's daily index is already in the feed's local timezone.
        values = {field.lower(): price_value(row[field]) for field in ("Open", "High", "Low", "Close")}
        if symbol == "NASDAQ":
            values["close"] = _VERIFIED_NASDAQ_CLOSES.get(day, values["close"])
        if None not in values.values() and values["low"] <= min(values["open"], values["close"]) <= max(
            values["open"], values["close"]
        ) <= values["high"]:
            rows[day] = {"symbol": symbol, "price_date": day, **values, "source": "yfinance"}
    return list(rows.values())


def collect_ohlcv(exchange: str, days: int = 100, *, now: datetime | None = None) -> list[dict]:
    """Maintain the daily chart using completed spot sessions and Yahoo calendar days."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    records = []

    for symbol, config in SYMBOLS.items():
        if config["exchange"] != exchange:
            continue
        try:
            is_overnight = overnight(symbol)
            # Yahoo's overnight daily candles are labelled by New York calendar date.
            # Even after the exchange closes, the provider can update that day's candle.
            today = now.astimezone(YAHOO_OVERNIGHT_TIMEZONE).date() if is_overnight else now.date()
            end = today if is_overnight else today + timedelta(days=1)
            start = today - timedelta(days=days)
            frame = yf.download(config["ticker"], start=start.isoformat(), end=end.isoformat(),
                                interval="1d", progress=False, auto_adjust=True)
            if frame.empty:
                continue
            rows = daily_rows(symbol, frame)
            if is_overnight:
                rows = [row for row in rows if start.isoformat() <= row["price_date"] < end.isoformat()]
            else:
                completed = {
                    session.day.isoformat() for session in sessions_for(calendar_for(symbol), start, end)
                    if session.closes + CLOSE_PUBLICATION_DELAY <= now
                }
                rows = [row for row in rows if row["price_date"] in completed]
            records.extend(rows)
        except Exception:
            logger.exception("OHLCV collection failed for %s", symbol)
    return records


def _reported_quote(ticker) -> tuple[datetime | None, float | None]:
    try:
        metadata = ticker.get_history_metadata()
        reported = metadata.get("regularMarketTime")
        if isinstance(reported, (int, float)):
            reported = datetime.fromtimestamp(reported, timezone.utc)
        if isinstance(reported, datetime) and reported.tzinfo is not None:
            return reported, price_value(metadata.get("regularMarketPrice"))
    except Exception:
        logger.debug("Yahoo market time unavailable", exc_info=True)
    return None, None


def _valid_bar_timestamp(timestamp: datetime, now: datetime) -> bool:
    return (timestamp.tzinfo is not None and timestamp <= now and timestamp.minute % 5 == 0
            and timestamp.second == timestamp.microsecond == 0)


def collect_intraday(now: datetime, sessions: dict[str, tuple[Session, ...]]) -> list[dict]:
    """Store chart points from one request per relevant symbol, with an empty-response fallback."""
    records = {}
    for symbol, schedule in sessions.items():
        current = next((s for s in reversed(schedule) if s.opens <= now), None)
        if current is None or now - current.last_trading_time(now) > timedelta(hours=2):
            continue
        try:
            ticker = yf.Ticker(SYMBOLS[symbol]["ticker"])
            frame = ticker.history(period="1d", interval="5m", prepost=True)
            if frame.empty:
                frame = ticker.history(period="5d", interval="5m", prepost=True)
            samples = [
                (ts, price) for ts, row in frame.iterrows()
                if pd.notna(ts) and ts.tzinfo is not None and ts <= now
                and (price := price_value(row["Close"])) is not None
            ]
            if not samples:
                continue
            observed_through = max(ts for ts, _ in samples)
            reported, quote = _reported_quote(ticker)
            if reported is not None and reported <= now + FIVE_MINUTES:
                observed_through = max(observed_through, min(reported, now))
            tolerance = _CLOSE_QUOTE_TOLERANCE.get(calendar_for(symbol), timedelta(0))
            for ts, price in samples:
                if not _valid_bar_timestamp(ts, now):
                    continue
                window = next((window for session in reversed(schedule) if (window := session.window_for(ts))), None)
                if window is None:
                    continue
                end = min(ts + FIVE_MINUTES, window[1])
                if end > observed_through:
                    closing_quote = (
                        tolerance and end == current.closes and now >= end and reported is not None
                        and max(ts, end - tolerance) <= reported < end and price == quote
                    )
                    if not closing_quote:
                        continue
                stamp = ts.tz_convert("UTC").isoformat()
                records[symbol, stamp] = dict(symbol=symbol, recorded_at=stamp, price=price, source="yfinance")
        except Exception:
            logger.exception("Intraday collection failed for %s", symbol)
    return list(records.values())


def snapshot_sessions(schedule: tuple[Session, ...], now: datetime) -> tuple[Session, ...]:
    """Consider the active session and/or the last completed session, with its reference."""
    started = [session for session in schedule if session.opens <= now]
    if not started:
        return ()
    return tuple(started[-3:] if now < started[-1].closes else started[-2:])


def collect_recent_ohlcv(now: datetime, sessions: dict[str, tuple[Session, ...]],
                         stored: list[dict]) -> list[dict]:
    """Fill missing completed spot candles using Yahoo's timestamped daily response."""
    available = {(row["symbol"], row["price_date"]) for row in stored if price_value(row["close"]) is not None}
    result = []
    for symbol, schedule in sessions.items():
        if overnight(symbol):
            continue
        recent = snapshot_sessions(schedule, now)
        if not recent or now - recent[-1].closes > timedelta(hours=36):
            continue
        needed = {
            s.day.isoformat(): s for s in recent
            if s.closes + CLOSE_PUBLICATION_DELAY <= now and (symbol, s.day.isoformat()) not in available
        }
        if not needed:
            continue
        try:
            ticker = yf.Ticker(SYMBOLS[symbol]["ticker"])
            frame = ticker.history(period="5d", interval="1d")
            if frame.empty:
                continue
            reported, _ = _reported_quote(ticker)
            if reported is None or reported > now + FIVE_MINUTES:
                continue
            for row in daily_rows(symbol, frame):
                session = needed.get(row["price_date"])
                if session and reported >= session.closes - FIVE_MINUTES:
                    result.append(row)
        except Exception:
            logger.exception("Recent daily collection failed for %s", symbol)
    return result


def _latest_bars(schedule: tuple[Session, ...], rows: list[dict], now: datetime) -> dict[date, tuple]:
    latest = {}
    for row in rows:
        timestamp = datetime.fromisoformat(row["recorded_at"])
        price = price_value(row["price"])
        if price is None or not _valid_bar_timestamp(timestamp, now):
            continue
        for session in schedule:
            window = session.window_for(timestamp)
            if window is None or min(timestamp + FIVE_MINUTES, window[1]) > now:
                continue
            if session.last_trading_time(now) - timestamp <= MAX_DELAY:
                if session.day not in latest or timestamp >= latest[session.day][0]:
                    latest[session.day] = (timestamp, price)
            break
    return latest


def collect_live(now: datetime, sessions: dict[str, tuple[Session, ...]], intraday: list[dict],
                 daily: list[dict]) -> list[dict]:
    """Build snapshots from the same 5m and daily data used for the charts."""
    by_symbol = defaultdict(list)
    for row in intraday:
        by_symbol[row["symbol"]].append(row)
    closes = {(row["symbol"], date.fromisoformat(row["price_date"])): price_value(row["close"])
              for row in daily}
    rows = []
    for symbol, schedule in sessions.items():
        recent = snapshot_sessions(schedule, now)
        bars = _latest_bars(recent, by_symbol[symbol], now)
        for index, session in enumerate(recent[1:], start=1):
            previous = recent[index - 1]
            if overnight(symbol):
                # Yahoo's midnight labels can include the next session's evening trades.
                # Compare with a stable terminal bar at the previous session close.
                prior_bar = bars.get(previous.day)
                baseline = prior_bar[1] if prior_bar and previous.closes - prior_bar[0] <= 3 * FIVE_MINUTES else None
                close = None
            else:
                baseline = closes.get((symbol, previous.day))
                close = closes.get((symbol, session.day)) if session.closes <= now else None

            if close is not None:
                timestamp, price, kind = session.closes, close, "daily_close"
            elif session.day in bars:
                timestamp, price = bars[session.day]
                kind = "intraday"
            else:
                continue
            rows.append(dict(symbol=symbol, snapshot_date=session.day.isoformat(), price=price,
                             change_pct=change_percent(price, baseline), source="yfinance",
                             price_as_of=timestamp.astimezone(timezone.utc).isoformat(), price_kind=kind))
    return rows
