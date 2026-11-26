from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
import subprocess

import pandas as pd
import pytest

from collectors.market import yfinance_collector as yf_market
from collectors.market.sessions import sessions_for
from jobs import market_ingest
from jobs.repair_market_snapshots import apply_reviewed, review_symbol


def stamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def sessions(symbol: str, now: datetime) -> dict:
    return {symbol: yf_market.market_sessions(now)[symbol]}


def bar(symbol: str, at: str, price: float) -> dict:
    return dict(symbol=symbol, recorded_at=at, price=price)


def candle(symbol: str, day: str, close: float) -> dict:
    return dict(symbol=symbol, price_date=day, close=close)


def snapshots(symbol: str, now: str, bars=(), daily=()) -> dict:
    when = stamp(now)
    return {row["snapshot_date"]: row for row in yf_market.collect_live(when, sessions(symbol, when), bars, daily)}


def test_all_sixteen_symbols_have_live_sessions():
    now = stamp("2026-11-25T17:10:00Z")
    schedules = yf_market.market_sessions(now)
    assert set(schedules) == {
        "SP500", "NASDAQ", "VIX", "KOSPI", "KOSDAQ", "NIKKEI225", "HANG_SENG", "SHANGHAI",
        "STOXX600", "ES_FUTURES", "NQ_FUTURES", "GOLD_FUTURES", "GASOLINE_FUTURES",
        "HEATING_OIL_FUTURES", "US10Y", "USD_INDEX",
    }
    bars = []
    daily = []
    for symbol, schedule in schedules.items():
        previous, current = yf_market.snapshot_sessions(schedule, now)[-2:]
        daily.append(candle(symbol, previous.day.isoformat(), 100))
        for session, price in [(previous, 100), (current, 101)]:
            at = session.last_trading_time(now).astimezone(timezone.utc) - timedelta(minutes=5)
            bars.append(bar(symbol, at.isoformat(), price))
    by_symbol = {row["symbol"]: row for row in yf_market.collect_live(now, schedules, bars, daily)}
    assert by_symbol.keys() == schedules.keys()
    assert {(row["snapshot_date"], row["price"], row["change_pct"]) for row in by_symbol.values()} == {
        ("2026-11-25", 101, 1.0)
    }


def test_live_uses_newest_completed_five_minute_bar_and_prior_trade_date():
    symbol = "SP500"
    result = snapshots(symbol, "2026-11-27T15:05:00Z", bars=[
        bar(symbol, "2026-11-27T14:45:00Z", 104),
        bar(symbol, "2026-11-27T15:00:00Z", 110),
        bar(symbol, "2026-11-27T15:05:00Z", 111),  # incomplete
        bar(symbol, "2026-11-27T15:10:00Z", 150),  # future
        bar(symbol, "2026-11-27T14:55:00Z", float("nan")),
    ], daily=[
        candle(symbol, "2026-11-25", 100),
        candle(symbol, "2026-11-26", 999),  # Thanksgiving
        candle(symbol, "2026-11-27", 500),  # date only, no current price time
    ])["2026-11-27"]
    assert (result["price"], result["change_pct"], result["price_kind"], result["price_as_of"]) == (
        110, 10.0, "intraday", "2026-11-27T15:00:00+00:00",
    )


def test_no_new_row_for_stale_bars_or_pre_open_weekend_prices():
    symbol = "SP500"
    daily = [candle(symbol, "2026-11-24", 100), candle(symbol, "2026-11-25", 95)]
    bars = [bar(symbol, "2026-11-27T14:35:00Z", 120)]
    for now in ("2026-11-26T01:00:00Z", "2026-11-27T13:00:00Z", "2026-11-27T16:00:00Z", "2026-11-29T15:00:00Z"):
        rows = snapshots(symbol, now, bars, daily)
        assert "2026-11-26" not in rows
        assert "2026-11-27" not in rows
        assert rows.get("2026-11-25", {}).get("price", 95) == 95


def test_early_close_provisional_then_daily_and_missing_exact_reference():
    symbol = "NASDAQ"
    now = "2026-11-27T18:30:00Z"
    bars = [bar(symbol, "2026-11-27T17:55:00Z", 104),
            bar(symbol, "2026-11-27T18:05:00Z", 900)]
    prior = [candle(symbol, "2026-11-24", 80), candle(symbol, "2026-11-25", 100)]
    provisional = snapshots(symbol, now, bars, prior)["2026-11-27"]
    assert (provisional["price"], provisional["change_pct"], provisional["price_kind"]) == (104, 4, "intraday")
    final = snapshots(symbol, now, bars, prior + [candle(symbol, "2026-11-27", 105)])["2026-11-27"]
    assert (final["price"], final["change_pct"], final["price_kind"], final["price_as_of"]) == (
        105, 5, "daily_close", "2026-11-27T18:00:00+00:00",
    )
    assert snapshots(symbol, now, bars, prior[:1])["2026-11-27"]["change_pct"] is None


@pytest.mark.parametrize(("market", "opens", "closes"), [
    ("KRX", "00:00", "06:30"), ("TSE", "00:00", "06:30"),
    ("HKEX", "01:30", "08:10"), ("SSE", "01:30", "07:00"),
    ("STOXX", "08:00", "17:00"), ("NYSE", "14:30", "21:00"),
    ("VIX", "08:15", "21:15"), ("US10Y", "13:20", "20:00"),
])
def test_exchange_specific_trading_hours(market, opens, closes):
    day = date(2026, 11, 25)
    session, = sessions_for(market, day, day)
    assert session.opens.astimezone(timezone.utc).strftime("%H:%M") == opens
    assert session.closes.astimezone(timezone.utc).strftime("%H:%M") == closes


def test_lunch_retains_last_valid_bar_and_rejects_quotes_inside_the_break():
    symbol = "NIKKEI225"
    rows = snapshots(symbol, "2026-11-25T03:10:00Z", bars=[
        bar(symbol, "2026-11-25T02:25:00Z", 102), bar(symbol, "2026-11-25T02:45:00Z", 110),
    ], daily=[candle(symbol, "2026-11-24", 100)])
    assert rows["2026-11-25"]["price"] == 102
    assert rows["2026-11-25"]["change_pct"] == 2


def test_sunday_night_and_cme_holiday_trade_date_and_basis():
    symbol = "ES_FUTURES"
    sunday = snapshots(symbol, "2026-11-22T23:30:00Z", bars=[
        bar(symbol, "2026-11-20T21:55:00Z", 100), bar(symbol, "2026-11-22T23:15:00Z", 108),
    ], daily=[candle(symbol, "2026-11-20", 300), candle(symbol, "2026-11-22", 999)])
    assert sunday["2026-11-23"]["price"] == 108
    assert sunday["2026-11-23"]["change_pct"] == 8
    rows = snapshots(symbol, "2026-11-26T00:20:00Z", bars=[
        bar(symbol, "2026-11-25T21:55:00Z", 100), bar(symbol, "2026-11-25T22:30:00Z", 999),
        bar(symbol, "2026-11-25T23:55:00Z", 110),
    ])
    assert rows["2026-11-27"]["price"] == 110
    assert rows["2026-11-27"]["change_pct"] == 10
    assert "2026-11-26" not in rows


def test_after_midnight_utc_us_quote_keeps_previous_local_session():
    symbol = "VIX"
    rows = snapshots(symbol, "2026-11-26T00:20:00Z", bars=[bar(symbol, "2026-11-25T21:15:00Z", 28.29)],
                     daily=[candle(symbol, "2026-11-24", 26.36)])
    assert [(row["snapshot_date"], row["price"], row["change_pct"]) for row in rows.values()] == [
        ("2026-11-25", 28.29, 7.3217),
    ]


def test_yahoo_empty_error_and_valid_completed_bar_are_isolated(monkeypatch):
    calls = []

    class Ticker:
        def __init__(self, ticker):
            self.ticker = ticker

        def history(self, *, period, interval, prepost):
            calls.append((self.ticker, period, interval))
            if self.ticker == "^KS11":
                raise RuntimeError("Yahoo unavailable")
            if self.ticker == "^KQ11":
                return pd.DataFrame()
            return pd.DataFrame({"Close": [103, 120, 900]}, index=pd.to_datetime([
                "2026-11-25T01:55:00Z", "2026-11-25T02:00:00Z", "2026-11-25T02:03:00Z",
            ]))

    monkeypatch.setattr(yf_market.yf, "Ticker", Ticker)
    now = stamp("2026-11-25T02:03:00Z")
    schedule = yf_market.market_sessions(now)
    rows = yf_market.collect_intraday(now, {s: schedule[s] for s in ("KOSPI", "KOSDAQ", "NIKKEI225")})
    assert [(r["symbol"], r["price"], r["recorded_at"]) for r in rows] == [
        ("NIKKEI225", 103, "2026-11-25T01:55:00+00:00"),
    ]
    assert calls == [("^KS11", "1d", "5m"), ("^KQ11", "1d", "5m"), ("^KQ11", "5d", "5m"), ("^N225", "1d", "5m")]


@pytest.mark.parametrize(("listed_day", "reported", "accepted"), [
    ("2026-11-24", "2026-11-25T06:31:00Z", []),
    ("2026-11-25", "2026-11-25T05:55:00Z", []),
    ("2026-11-25", "2026-11-25T06:30:00Z", ["2026-11-25"]),
])
def test_daily_timestamp_and_completion_are_verified(monkeypatch, listed_day, reported, accepted):
    calls = []

    class Ticker:
        def history(self, *, period, interval):
            calls.append((period, interval))
            return pd.DataFrame({"Open": [100], "High": [111], "Low": [99], "Close": [105]},
                                index=pd.DatetimeIndex([listed_day], tz="Asia/Seoul"))

        def get_history_metadata(self):
            return {"regularMarketTime": stamp(reported)}

    monkeypatch.setattr(yf_market.yf, "Ticker", lambda _: Ticker())
    symbol = "KOSPI"
    now = stamp("2026-11-25T07:00:00Z")
    daily = [candle(symbol, "2026-11-24", 100)]
    rows = yf_market.collect_recent_ohlcv(now, sessions(symbol, now), daily)
    assert [row["price_date"] for row in rows] == accepted
    assert calls == [("5d", "1d")]


@pytest.mark.parametrize(("symbol", "older", "previous", "latest", "latest_bar", "old_return", "new_return"), [
    ("KOSPI", 4708.54, 5006.0298, 4697.5098, "06:00", 6.3181, -6.1630),
    ("KOSDAQ", 635.45, 665.88, 650.64, "06:00", 4.7887, -2.2887),
    ("NIKKEI225", 56436.6484, 58644.6289, 57011.6211, "06:30", 3.9123, -2.7846),
    ("HANG_SENG", 22383.7402, 22219.6504, 21966.0098, "08:05", -0.7331, -1.1415),
    ("STOXX600", 636.97, 632.74, 626.03, "16:30", -0.6641, -1.0605),
])
def test_production_november_24_25_regression_and_audit(symbol, older, previous, latest, latest_bar,
                                                        old_return, new_return):
    older_day = "2026-11-20" if symbol == "NIKKEI225" else "2026-11-23"
    daily = [candle(symbol, older_day, older), candle(symbol, "2026-11-24", previous)]
    bar_at = f"2026-11-25T{latest_bar}:00Z"
    at = "2026-11-25T20:00:00Z"
    from_intraday = snapshots(symbol, at, [bar(symbol, bar_at, latest)], daily)["2026-11-25"]
    assert (from_intraday["price"], from_intraday["change_pct"], from_intraday["price_kind"]) == (
        latest, new_return, "intraday",
    )
    prior_day = snapshots(symbol, "2026-11-24T20:00:00Z", daily=daily)["2026-11-24"]
    assert (prior_day["price"], prior_day["change_pct"], prior_day["price_kind"]) == (
        previous, old_return, "daily_close",
    )
    daily.append(candle(symbol, "2026-11-25", latest))
    correct = snapshots(symbol, at, [], daily)["2026-11-25"]
    assert (correct["price"], correct["change_pct"], correct["price_kind"]) == (latest, new_return, "daily_close")
    before = dict(id=1, symbol=symbol, snapshot_date="2026-11-25", price=previous,
                  change_pct=old_return, source="yfinance")
    closes = {date.fromisoformat(row["price_date"]): row["close"] for row in daily}
    audit = review_symbol(symbol, [before], closes, stamp(at), lambda *_: [bar(symbol, bar_at, latest)])
    assert audit[0]["after"]["price"] == latest
    assert audit[0]["after"]["change_pct"] == new_return
    assert review_symbol(symbol, [before], closes, stamp(at), lambda *_: [])[0]["after"] is None
    assert review_symbol(symbol, [{**before, **audit[0]["after"]}], closes, stamp(at), lambda *_: [])[0]["after"] is None


def test_repair_approved_manifest_is_comparison_guarded_and_repeatable():
    before = dict(id=2, symbol="KOSPI", snapshot_date="2026-11-25", price=5006.0298, change_pct=6.3181)
    after = dict(price=4697.5098, change_pct=-6.163, price_as_of="2026-11-25T06:30:00Z", price_kind="daily_close")
    manifest = {"changes": [{"before": before, "after": after}]}

    class Client:
        count = 0

        def patch(self, path, *, json, headers, params):
            assert path == "/market_snapshots"
            assert params == dict(id="eq.2", symbol="eq.KOSPI", snapshot_date="eq.2026-11-25",
                                  source="eq.yfinance", price="eq.5006.0298", price_as_of="is.null",
                                  change_pct="eq.6.3181")
            assert json == after
            assert headers["Prefer"] == "return=representation"
            self.count += 1
            return self

        def raise_for_status(self):
            pass

        def json(self):
            return [after]

    client = Client()
    assert apply_reviewed(client, manifest, manifest) == {"applied": [2], "skipped": []}
    assert apply_reviewed(client, manifest, {"changes": []}) == {"applied": [], "skipped": [2]}
    assert client.count == 1


def test_ingest_reuses_charts_and_writes_snapshot_last(monkeypatch):
    now = stamp("2026-11-25T17:00:00Z")
    symbol = "KOSPI"
    schedule = sessions(symbol, now)
    daily = [candle(symbol, "2026-11-24", 100), candle(symbol, "2026-11-25", 110)]
    calls = []
    monkeypatch.setattr(market_ingest, "market_sessions", lambda _: schedule)
    monkeypatch.setattr(market_ingest, "_OHLCV_TARGET_HOURS_UTC", {"KRX": 14})
    monkeypatch.setattr(market_ingest, "has_successful_run_since", lambda *_: False)
    monkeypatch.setattr(market_ingest, "start_run", lambda name: calls.append(name) or 1)
    monkeypatch.setattr(market_ingest, "finish_run", lambda *_: None)
    monkeypatch.setattr(market_ingest, "yf_collect_intraday", lambda *_: [bar(symbol, "2026-11-25T06:00:00Z", 110)])
    monkeypatch.setattr(market_ingest, "yf_collect_ohlcv", lambda *_args, **_kwargs: daily)
    monkeypatch.setattr(market_ingest, "fetch_recent_daily", lambda *_: daily)
    monkeypatch.setattr(market_ingest, "fetch_recent_bars", lambda *_: [])
    monkeypatch.setattr(market_ingest, "upsert", lambda table, rows, **_: calls.append((table, len(rows))) or len(rows))
    monkeypatch.setattr(market_ingest, "upsert_market_snapshots", lambda rows: calls.extend(rows) or len(rows))
    market_ingest.run(now=now)
    assert calls[:5] == ["market_intraday", ("market_intraday", 1),
                         "market_ohlcv_KRX", ("market_ohlcv", 2), "market"]
    assert calls[-1]["price"] == 110
    assert calls[-1]["change_pct"] == 10


@pytest.mark.skipif(not os.getenv("MARKET_TEST_PG_DSN"), reason="requires migrated local PostgreSQL")
def test_postgres_keeps_latest_bar_promotes_close_and_is_idempotent():
    # The fixture database must be isolated. All test data is rolled back.
    base = dict(symbol="TEST_SNAPSHOT", snapshot_date="2026-11-25", price=110, change_pct=10, source="yfinance",
                price_as_of="2026-11-25T05:00:00+00:00", price_kind="intraday")

    def rpc(**override):
        return "SELECT public.upsert_market_snapshots('" + json.dumps([{**base, **override}]) + "');"

    sql = ["BEGIN;", "SET LOCAL ROLE service_role;",
           "INSERT INTO public.market_snapshots(symbol,snapshot_date,price,change_pct,source) "
           "VALUES ('TEST_SNAPSHOT','2026-11-25',99,-1,'yfinance');",
           rpc(change_pct=None), rpc(change_pct=None), rpc(price=109, price_as_of="2026-11-25T04:55:00Z"),
           rpc(), rpc(price=112, change_pct=12, price_as_of="2026-11-25T06:30:00Z", price_kind="daily_close"),
           rpc(price=113, change_pct=13, price_as_of="2026-11-25T06:35:00Z"),
           rpc(price=112, change_pct=12, price_as_of="2026-11-25T06:30:00Z", price_kind="daily_close"),
           "SELECT price,change_pct,price_kind FROM public.market_snapshots WHERE symbol='TEST_SNAPSHOT';",
           "RESET ROLE;",
           "SELECT has_function_privilege('anon','public.upsert_market_snapshots(jsonb)','EXECUTE');",
           "ROLLBACK;"]
    result = subprocess.run(
        ["psql", "-XAtq", os.environ["MARKET_TEST_PG_DSN"], "-v", "ON_ERROR_STOP=1"],
        input="\n".join(sql), check=True, text=True, capture_output=True, cwd=Path(__file__).resolve().parents[2],
    )
    assert result.stdout.splitlines() == ["1", "0", "0", "1", "1", "0", "0", "112|12|daily_close", "f"]
