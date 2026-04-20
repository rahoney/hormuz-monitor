"""pykrx에서 KOSPI/KOSDAQ 일별 스냅샷을 수집한다."""
from datetime import date
from typing import Any
from pykrx import stock

_INDICES: list[dict[str, str]] = [
    {"symbol": "KOSPI",  "ticker": "1001"},
    {"symbol": "KOSDAQ", "ticker": "2001"},
]


def collect(start: date, end: date) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    start_str = start.strftime("%Y%m%d")
    end_str = end.strftime("%Y%m%d")

    for idx in _INDICES:
        df = stock.get_index_ohlcv(start_str, end_str, idx["ticker"])
        if df is None or df.empty:
            continue
        df["pct_change"] = df["종가"].pct_change() * 100
        for ts, row in df.iterrows():
            chg = float(row["pct_change"])
            records.append({
                "symbol":        idx["symbol"],
                "snapshot_date": ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10],
                "price":         round(float(row["종가"]), 2),
                "change_pct":    None if chg != chg else round(chg, 4),
                "source":        "pykrx",
            })
    return records
