"""Yahoo Finance futures prices used as a freshness fallback for oil series."""
from datetime import date, timedelta
import math
from typing import Any

import yfinance as yf

from utils.logger import get_logger

logger = get_logger(__name__)

_FUTURES: list[dict[str, str]] = [
    {"symbol": "WTI", "ticker": "CL=F", "unit": "USD/bbl"},
    {"symbol": "BRENT", "ticker": "BZ=F", "unit": "USD/bbl"},
]


def _finite_float(value: Any) -> float | None:
    raw = value.iloc[0] if hasattr(value, "iloc") else value
    try:
        number = float(raw)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def collect(start: date, end: date) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    yf_end = end + timedelta(days=1)

    for item in _FUTURES:
        try:
            df = yf.download(
                item["ticker"],
                start=start.isoformat(),
                end=yf_end.isoformat(),
                progress=False,
                auto_adjust=True,
            )
        except Exception as exc:
            logger.warning("Yahoo futures 수집 실패 (%s): %s", item["symbol"], exc)
            continue

        if df.empty:
            continue

        for ts, row in df.iterrows():
            close = _finite_float(row["Close"])
            if close is None:
                continue
            records.append({
                "symbol": item["symbol"],
                "price_date": ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10],
                "price_usd": round(close, 4),
                "unit": item["unit"],
                "source": "yfinance",
            })

    return records
