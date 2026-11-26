"""Audit legacy market snapshots. Default mode issues only read requests."""
import argparse
from collections import Counter
from datetime import date, datetime, timedelta, timezone
import json
import math
from pathlib import Path

from collectors.market.sessions import MAX_DELAY, sessions_for
from collectors.market.yfinance_collector import SYMBOLS, calendar_for, change_percent, overnight, price_value
from db.client import get_client

_PRICE_TOLERANCE = 0.001
_PERCENT_TOLERANCE = 0.005


def _same(a: float | None, b: float | None, tolerance: float) -> bool:
    return a is not None and b is not None and math.isclose(a, b, rel_tol=0, abs_tol=tolerance)


def review_symbol(symbol: str, snapshots: list[dict], daily: dict[date, float],
                  now: datetime, read_closing_bars) -> list[dict]:
    if not snapshots:
        return []
    dates = [date.fromisoformat(row["snapshot_date"]) for row in snapshots]
    schedule = sessions_for(calendar_for(symbol), min(dates) - timedelta(days=21), max(dates))
    positions = {session.day: index for index, session in enumerate(schedule)}
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
        elif position < 2 or not all(daily.get(schedule[i].day) for i in range(position - 2, position + 1)):
            item["reason"] = "missing_daily_reference"
        else:
            session = schedule[position]
            older, previous, close = (daily[schedule[i].day] for i in range(position - 2, position + 1))
            if _same(row["price"], close, _PRICE_TOLERANCE):
                item["reason"] = "matches_daily_close"
            elif (_same(row["price"], previous, _PRICE_TOLERANCE)
                  and _same(row["change_pct"], change_percent(previous, older), _PERCENT_TOLERANCE)):
                start = max(session.opens, session.closes - MAX_DELAY)
                bars = read_closing_bars(symbol, start, session.closes)
                last = next((bar for bar in bars if price_value(bar["price"]) is not None
                             and session.window_for(datetime.fromisoformat(bar["recorded_at"]))), None)
                if last and _same(last["price"], close, _PRICE_TOLERANCE):
                    item["reason"] = "previous_close_and_return_repeated; daily_and_5m_confirm_replacement"
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


def audit(client, start: date | None, end: date, now: datetime) -> dict:
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
    for symbol in SYMBOLS:
        rows = [row for row in snapshots if row["symbol"] == symbol]
        closes = {date.fromisoformat(row["price_date"]): price_value(row["close"])
                  for row in daily if row["symbol"] == symbol}
        evidence = review_symbol(symbol, rows, closes, now, read_closing_bars)
        changes = [item for item in evidence if item["after"]]
        report["changes"].extend(changes)
        report["symbols"][symbol] = {
            "examined": len(rows), "apply_candidates": len(changes),
            "reasons": dict(Counter(item["reason"] for item in evidence)),
            "review": [dict(id=item["before"]["id"], day=item["before"]["snapshot_date"], reason=item["reason"])
                       for item in evidence if not item["after"] and item["reason"] not in
                       {"matches_daily_close", "verified_or_other_source", "overnight_daily_session_unverified"}],
        }
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
    parser.add_argument("--apply", type=Path, metavar="REVIEWED_REPORT_JSON",
                        help="Apply only candidates unchanged since this reviewed dry-run report")
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    with get_client() as client:
        if args.apply:
            approved = json.loads(args.apply.read_text())
            start = date.fromisoformat(approved["start"]) if approved["start"] else None
            fresh = audit(client, start, date.fromisoformat(approved["end"]), now)
            print(json.dumps(apply_reviewed(client, approved, fresh), indent=2))
        else:
            print(json.dumps(audit(client, args.start, args.end, now), indent=2))


if __name__ == "__main__":
    main()
