"""Audit legacy market snapshots. Default mode issues only read requests."""
import argparse
from bisect import bisect_left, bisect_right
from collections import Counter
from datetime import date, datetime, timedelta, timezone
import json
import math
from pathlib import Path

import yfinance as yf

from collectors.market.sessions import MAX_DELAY, Session, sessions_for
from collectors.market.yfinance_collector import SYMBOLS, calendar_for, change_percent, daily_rows, overnight, price_value
from db.client import get_client

_PRICE_TOLERANCE = 0.001
_PERCENT_TOLERANCE = 0.005


def _same(a: float | None, b: float | None, tolerance: float) -> bool:
    return a is not None and b is not None and math.isclose(a, b, rel_tol=0, abs_tol=tolerance)


def review_symbol(symbol: str, snapshots: list[dict], daily: dict[date, float],
                  now: datetime, read_closing_bars, recollected=None) -> list[dict]:
    if not snapshots:
        return []
    dates = [date.fromisoformat(row["snapshot_date"]) for row in snapshots]
    schedule = sessions_for(calendar_for(symbol), min(dates) - timedelta(days=21), max(dates))
    positions = {session.day: index for index, session in enumerate(schedule)}
    yahoo_daily, yahoo_bar = recollected if recollected else ({}, None)
    closes = {**yahoo_daily, **daily}
    result = []
    for row, day in zip(snapshots, dates, strict=True):
        position = positions.get(day)
        before = {field: row.get(field) for field in
                  ("id", "symbol", "snapshot_date", "price", "change_pct", "source", "created_at")}
        item = {"before": before, "after": None, "reason": None}
        if row.get("price_as_of") or row["source"] != "yfinance":
            item["reason"] = "verified_or_other_source"
        elif position is None:
            item["reason"] = "non_session_date"
        elif schedule[position].opens > now:
            item["reason"] = "session_not_started"
        elif schedule[position].closes > now:
            item["reason"] = "session_in_progress"
        elif overnight(symbol):
            item["reason"] = "overnight_daily_session_unverified"
        elif position < 2 or not all(closes.get(schedule[i].day) for i in range(position - 2, position + 1)):
            item["reason"] = "missing_daily_reference"
        else:
            session = schedule[position]
            older, previous, close = (closes[schedule[i].day] for i in range(position - 2, position + 1))
            if _same(row["price"], close, _PRICE_TOLERANCE):
                item["reason"] = "matches_daily_close"
            elif (_same(row["price"], previous, _PRICE_TOLERANCE)
                  and _same(row["change_pct"], change_percent(previous, older), _PERCENT_TOLERANCE)):
                start = max(session.opens, session.closes - MAX_DELAY)
                bars = read_closing_bars(symbol, start, session.closes)
                last = next((bar for bar in bars if price_value(bar["price"]) is not None
                             and session.window_for(datetime.fromisoformat(bar["recorded_at"]))), None)
                reason = "daily_and_stored_5m"
                if not (last and _same(last["price"], close, _PRICE_TOLERANCE)):
                    last = yahoo_bar(session) if yahoo_bar and _same(yahoo_daily.get(day), close, _PRICE_TOLERANCE) else None
                    reason = f"daily_and_refetched_{last['interval']}" if last else "closing_bar_unconfirmed"
                if last and _same(last["price"], close, _PRICE_TOLERANCE):
                    item["reason"] = ("previous_close_and_return_repeated; daily_and_5m_confirm_replacement"
                                      if reason == "daily_and_stored_5m"
                                      else f"previous_close_and_return_repeated; {reason}_confirm_replacement")
                    item["closing_bar"] = last
                    item["previous_session"] = schedule[position - 1].day.isoformat()
                    item["previous_close"] = previous
                    item["after"] = {
                        "price": close, "change_pct": change_percent(close, previous), "price_kind": "daily_close",
                        "price_as_of": session.closes.astimezone(timezone.utc).isoformat(),
                    }
                else:
                    item["reason"] = "previous_close_and_return_repeated; closing_bar_unconfirmed"
            else:
                item["reason"] = "daily_mismatch_without_stale_fingerprint"
        result.append(item)
    return result


def _pages(client, table: str, **params) -> list[dict]:
    rows = []
    next_id = 0
    while True:
        response = client.get(f"/{table}", params={**params, "id": f"gt.{next_id}", "order": "id.asc", "limit": 1000})
        response.raise_for_status()
        batch = response.json()
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        next_id = batch[-1]["id"]


def recollect_history(symbol: str, start: date, end: date, now: datetime):
    """Fetch historical Yahoo candles once per interval for this symbol's audit."""
    before = min(end + timedelta(days=1), now.date())
    five_minute_start = max(start, now.date() - timedelta(days=58))
    ticker = yf.Ticker(SYMBOLS[symbol]["ticker"])
    daily_close = {}
    intraday = {}
    interval_ranges = (("1d", start - timedelta(days=21), before),
                       ("5m", five_minute_start, before), ("1h", start, min(five_minute_start, before)))
    for interval, start_at, end_at in interval_ranges:
        if start_at >= end_at:
            continue
        frame = ticker.history(start=start_at.isoformat(), end=end_at.isoformat(),
                               interval=interval, prepost=interval == "5m", auto_adjust=True, timeout=15)
        if interval == "1d":
            daily_close = {
                date.fromisoformat(row["price_date"]): row["close"] for row in daily_rows(symbol, frame)
                if row["price_date"] < end_at.isoformat()
            }
        else:
            bars = {
                ts.to_pydatetime(): price for ts, row in frame.iterrows()
                if ts.tzinfo is not None and (price := price_value(row["Close"])) is not None
            }
            intraday[interval] = (sorted(bars), bars)

    def closing_bar(session: Session) -> dict | None:
        interval = "5m" if session.day >= five_minute_start else "1h"
        stamps, bars = intraday.get(interval, ([], {}))
        tolerance = MAX_DELAY if interval == "5m" else timedelta(minutes=90)
        start_at = bisect_left(stamps, session.closes - tolerance)
        end_at = bisect_right(stamps, session.closes)
        stamp = next((ts for ts in reversed(stamps[start_at:end_at]) if session.window_for(ts)), None)
        if stamp:
            return {"recorded_at": stamp.astimezone(timezone.utc).isoformat(), "price": bars[stamp],
                    "interval": interval}
        return None

    return daily_close, closing_bar


def audit(client, start: date | None, end: date, now: datetime, *, recollect: bool = False) -> dict:
    date_filters = {"snapshot_date": f"lte.{end.isoformat()}"}
    if start:
        date_filters["and"] = f"(snapshot_date.gte.{start.isoformat()})"
    snapshots = _pages(client, "market_snapshots", **date_filters)
    earliest = min((date.fromisoformat(row["snapshot_date"]) for row in snapshots), default=end)
    daily = _pages(client, "market_ohlcv", select="id,symbol,price_date,close", source="eq.yfinance",
                   **{"and": f"(price_date.gte.{earliest - timedelta(days=21)},price_date.lte.{end})"})

    def read_closing_bars(symbol, start_time, end_time):
        response = client.get("/market_intraday", params={
            "select": "recorded_at,price",
            "symbol": f"eq.{symbol}", "source": "eq.yfinance", "order": "recorded_at.desc",
            "and": f"(recorded_at.gte.{start_time.isoformat()},recorded_at.lte.{end_time.isoformat()})",
        })
        response.raise_for_status()
        return response.json()

    report = {"start": start.isoformat() if start else None, "end": end.isoformat(), "symbols": {}, "changes": []}
    if recollect:
        report["recollect"] = True
    for symbol in SYMBOLS:
        rows = [row for row in snapshots if row["symbol"] == symbol]
        closes = {date.fromisoformat(row["price_date"]): price_value(row["close"])
                  for row in daily if row["symbol"] == symbol}
        extra = None
        recollect_error = None
        if recollect and rows and not overnight(symbol):
            try:
                first = min(date.fromisoformat(row["snapshot_date"]) for row in rows)
                extra = recollect_history(symbol, first, end, now)
            except Exception as exc:
                recollect_error = str(exc)
        evidence = review_symbol(symbol, rows, closes, now, read_closing_bars, extra)
        changes = [item for item in evidence if item["after"]]
        report["changes"].extend(changes)
        report["symbols"][symbol] = {
            "examined": len(rows), "apply_candidates": len(changes),
            "reasons": dict(Counter(item["reason"] for item in evidence)),
            "review": [dict(id=item["before"]["id"], day=item["before"]["snapshot_date"], reason=item["reason"])
                       for item in evidence if not item["after"] and item["reason"] not in
                       {"matches_daily_close", "verified_or_other_source", "overnight_daily_session_unverified"}],
        }
        if recollect_error:
            report["symbols"][symbol]["recollect_error"] = recollect_error
    return report


def apply_reviewed(client, approved: dict, fresh: dict) -> dict:
    fresh_by_id = {item["before"]["id"]: item for item in fresh["changes"]}
    outcome = {"applied": [], "skipped": []}
    for item in approved["changes"]:
        before = item["before"]
        item_id = before["id"]
        if fresh_by_id.get(item_id) != item:
            outcome["skipped"].append(item_id)
            continue
        change = before["change_pct"]
        response = client.patch("/market_snapshots", json=item["after"], headers={"Prefer": "return=representation"},
                                params=dict(id=f"eq.{item_id}", symbol=f"eq.{before['symbol']}",
                                            snapshot_date=f"eq.{before['snapshot_date']}", source="eq.yfinance",
                                            price=f"eq.{before['price']}", price_as_of="is.null",
                                            change_pct=f"eq.{change}" if change is not None else "is.null"))
        response.raise_for_status()
        outcome["applied" if response.json() else "skipped"].append(item_id)
    return outcome


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    parser.add_argument("--recollect", action="store_true",
                        help="Re-fetch Yahoo daily, 5m and 1h history to verify older spot snapshots")
    parser.add_argument("--apply", type=Path, metavar="REVIEWED_REPORT_JSON",
                        help="Apply only candidates unchanged since this reviewed dry-run report")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    with get_client() as client:
        if args.apply:
            approved = json.loads(args.apply.read_text())
            start = date.fromisoformat(approved["start"]) if approved["start"] else None
            fresh = audit(client, start, date.fromisoformat(approved["end"]), now,
                          recollect=approved.get("recollect", False))
            print(json.dumps(apply_reviewed(client, approved, fresh), indent=2))
        else:
            print(json.dumps(audit(client, args.start, args.end, now, recollect=args.recollect), indent=2))


if __name__ == "__main__":
    main()
