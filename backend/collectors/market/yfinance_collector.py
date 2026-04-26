"""yfinance에서 시장 지표 스냅샷·5분봉·일봉 OHLCV를 수집한다."""
from datetime import date, timedelta
import math
from typing import Any
import yfinance as yf

_SYMBOLS: list[dict[str, str]] = [
    {"symbol": "VIX",        "ticker": "^VIX"},
    {"symbol": "NASDAQ",     "ticker": "^IXIC"},
    {"symbol": "SP500",      "ticker": "^GSPC"},
    {"symbol": "KOSPI",      "ticker": "^KS11"},
    {"symbol": "KOSDAQ",     "ticker": "^KQ11"},
    {"symbol": "ES_FUTURES", "ticker": "ES=F"},
    {"symbol": "NQ_FUTURES", "ticker": "NQ=F"},
]


def _finite_float(value: Any) -> float | None:
    raw = value.iloc[0] if hasattr(value, "iloc") else value
    try:
        number = float(raw)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def collect_ohlcv(days: int = 35) -> list[dict[str, Any]]:
    """일봉 OHLCV 수집 (최근 N일)."""
    end = date.today()
    start = end - timedelta(days=days)
    records: list[dict[str, Any]] = []

    for s in _SYMBOLS:
        try:
            df = yf.download(s["ticker"], start=start.isoformat(), end=end.isoformat(),
                             progress=False, auto_adjust=True)
            if df.empty:
                continue
            for ts, row in df.iterrows():
                open_price = _finite_float(row["Open"])
                high = _finite_float(row["High"])
                low = _finite_float(row["Low"])
                close = _finite_float(row["Close"])
                if None in (open_price, high, low, close):
                    continue
                records.append({
                    "symbol":     s["symbol"],
                    "price_date": ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10],
                    "open":       round(open_price, 4),
                    "high":       round(high, 4),
                    "low":        round(low, 4),
                    "close":      round(close, 4),
                    "source":     "yfinance",
                })
        except Exception:
            continue
    return records


def collect_intraday() -> list[dict[str, Any]]:
    """5분봉 데이터 수집. 가능한 티커는 프리마켓/애프터마켓까지 포함한다."""
    records: list[dict[str, Any]] = []
    for s in _SYMBOLS:
        try:
            ticker = yf.Ticker(s["ticker"])
            hist = ticker.history(period="1d", interval="5m", prepost=True)
            if hist.empty:
                hist = ticker.history(period="5d", interval="5m", prepost=True)
            if hist.empty:
                continue
            for ts, row in hist.iterrows():
                close = _finite_float(row["Close"])
                if close is None:
                    continue
                records.append({
                    "symbol":      s["symbol"],
                    "recorded_at": ts.isoformat(),
                    "price":       round(close, 4),
                    "source":      "yfinance",
                })
        except Exception:
            continue
    return records


def collect_live() -> list[dict[str, Any]]:
    """현재 시장 실시간 가격을 수집한다 (장중/장후용)."""
    today = date.today().isoformat()
    records: list[dict[str, Any]] = []
    for s in _SYMBOLS:
        try:
            ticker = yf.Ticker(s["ticker"])
            hist = ticker.history(period="5d", interval="1d")
            if hist.empty:
                continue
            latest_price = _finite_float(hist["Close"].iloc[-1])
            if latest_price is None:
                continue
            chg = None
            if len(hist) >= 2:
                prev_close = _finite_float(hist["Close"].iloc[-2])
                if prev_close:
                    raw_chg = (latest_price - prev_close) / prev_close * 100
                    chg = round(raw_chg, 4) if math.isfinite(raw_chg) else None
            records.append({
                "symbol":        s["symbol"],
                "snapshot_date": today,
                "price":         round(latest_price, 4),
                "change_pct":    chg,
                "source":        "yfinance",
            })
        except Exception:
            continue
    return records


def collect(start: date, end: date) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for s in _SYMBOLS:
        df = yf.download(s["ticker"], start=start.isoformat(), end=end.isoformat(), progress=False, auto_adjust=True)
        if df.empty:
            continue
        df["pct_change"] = df["Close"].pct_change() * 100
        for ts, row in df.iterrows():
            close = _finite_float(row["Close"])
            if close is None:
                continue
            chg = _finite_float(row["pct_change"])
            records.append({
                "symbol":        s["symbol"],
                "snapshot_date": ts.date().isoformat(),
                "price":         round(close, 4),
                "change_pct":    None if chg is None else round(chg, 4),
                "source":        "yfinance",
            })
    return records
