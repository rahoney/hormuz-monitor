"""yfinance에서 VIX/Nasdaq/S&P500 일별 스냅샷을 수집한다."""
from datetime import date
from typing import Any
import yfinance as yf

_SYMBOLS: list[dict[str, str]] = [
    {"symbol": "VIX",    "ticker": "^VIX"},
    {"symbol": "NASDAQ", "ticker": "^IXIC"},
    {"symbol": "SP500",  "ticker": "^GSPC"},
    {"symbol": "KOSPI",  "ticker": "^KS11"},
    {"symbol": "KOSDAQ", "ticker": "^KQ11"},
]


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
            latest_price = float(hist["Close"].iloc[-1])
            chg = None
            if len(hist) >= 2:
                prev_close = float(hist["Close"].iloc[-2])
                if prev_close:
                    chg = round((latest_price - prev_close) / prev_close * 100, 4)
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
            close = float(row["Close"].iloc[0]) if hasattr(row["Close"], "iloc") else float(row["Close"])
            chg = float(row["pct_change"].iloc[0]) if hasattr(row["pct_change"], "iloc") else float(row["pct_change"])
            records.append({
                "symbol":        s["symbol"],
                "snapshot_date": ts.date().isoformat(),
                "price":         round(close, 4),
                "change_pct":    None if chg != chg else round(chg, 4),  # NaN → None
                "source":        "yfinance",
            })
    return records
