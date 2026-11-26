from datetime import date, datetime, timezone

import pandas as pd

from jobs import repair_market_charts as repair


class _Response:
    def __init__(self, rows):
        self.rows = rows

    def raise_for_status(self):
        pass

    def json(self):
        return self.rows


class _ChartDB:
    def __init__(self):
        self.daily = {"id": 1, "symbol": "ES_FUTURES", "price_date": "2026-11-24",
                      "open": 7212.5, "high": 7224, "low": 7181.5, "close": 7199.75, "source": "yfinance"}
        self.intraday = {"id": 1, "symbol": "VIX", "recorded_at": "2026-11-19T17:20:00+00:00",
                         "price": 26.66, "source": "yfinance"}
        self.writes = 0

    def get(self, path, *, params):
        row = self.daily if path == "/market_ohlcv" else self.intraday
        for field in ("symbol", "source", "price_date", "recorded_at"):
            if field in params and params[field] != f"eq.{row.get(field)}":
                return _Response([])
        return _Response([dict(row)])

    def patch(self, path, *, params, json, headers):
        assert headers == {"Prefer": "return=representation"}
        row = self.daily if path == "/market_ohlcv" else self.intraday
        assert params == {key: f"eq.{value}" for key, value in row.items()}
        row.update(json)
        self.writes += 1
        return _Response([dict(row)])


class _Yahoo:
    same_daily = True

    def history(self, *, start, end, interval, **kwargs):
        if interval == "1d":
            assert end == "2026-11-25"
            close = 7217.5 if self.same_daily or start == "2026-11-24" else 7210
            return pd.DataFrame({"Open": [7272], "High": [7298.25], "Low": [7144.75], "Close": [close]},
                                index=pd.DatetimeIndex(["2026-11-24"], tz="America/New_York"))
        if interval == "5m":
            return pd.DataFrame({"Close": [26.34]}, index=pd.DatetimeIndex([start]))
        return pd.DataFrame({"Close": [27.58, 27.25, 26.95, 26.66, 26.34]},
                            index=pd.date_range(start, end, freq="min", inclusive="left"))


def test_chart_repair_has_read_only_preview_and_guarded_idempotent_apply(monkeypatch):
    monkeypatch.setattr(repair.yf, "Ticker", lambda _: _Yahoo())
    db = _ChartDB()
    days = [date(2026, 11, 24)]
    bars = [repair._parse_bar("VIX@2026-11-19T11:20:00-06:00")]
    now = datetime(2026, 11, 26, tzinfo=timezone.utc)
    report = repair.audit(db, days, bars, now)
    assert db.writes == 0
    assert [r["table"] for r in report["changes"]] == ["market_ohlcv", "market_intraday"]
    assert report["changes"][0]["after"]["close"] == 7217.5
    assert report["changes"][1]["after"]["price"] == 26.34
    assert repair.apply_reviewed(db, report, repair.audit(db, days, bars, now)) == {
        "applied": [("market_ohlcv", 1), ("market_intraday", 1)], "skipped": [],
    }
    assert repair.apply_reviewed(db, report, repair.audit(db, days, bars, now)) == {
        "applied": [], "skipped": [("market_ohlcv", 1), ("market_intraday", 1)],
    }
    assert db.writes == 2


def test_chart_repair_skips_disagreeing_reference_and_unconfirmed_previous_value(monkeypatch):
    ticker = _Yahoo()
    ticker.same_daily = False
    monkeypatch.setattr(repair.yf, "Ticker", lambda _: ticker)
    db = _ChartDB()
    db.intraday["price"] = 27.15
    now = datetime(2026, 11, 26, tzinfo=timezone.utc)
    report = repair.audit(db, [date(2026, 11, 24)],
                          [repair._parse_bar("VIX@2026-11-19T17:20:00Z")], now)
    assert not report["changes"]
    assert db.writes == 0
