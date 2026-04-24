"""EIA API v2에서 WTI/Brent/천연가스 일별 가격을 수집한다."""
import os
from datetime import date
from typing import Any
import httpx
from dotenv import load_dotenv

load_dotenv()

_EIA_BASE = "https://api.eia.gov/v2"
_API_KEY = os.getenv("EIA_API_KEY", "")

# EIA petroleum/natural gas spot price series definitions.
_SERIES: list[dict[str, str]] = [
    {"symbol": "WTI",         "route": "petroleum/pri/spt/data",    "series": "RWTC",    "unit": "USD/bbl"},
    {"symbol": "BRENT",       "route": "petroleum/pri/spt/data",    "series": "RBRTE",   "unit": "USD/bbl"},
    {"symbol": "NATURAL_GAS", "route": "natural-gas/pri/fut/data",  "series": "RNGWHHD", "unit": "USD/MMBtu"},
]


def fetch_series(route: str, series_id: str, start: date, end: date) -> list[dict[str, Any]]:
    """단일 EIA 시리즈의 일별 데이터를 반환한다."""
    params = {
        "api_key": _API_KEY,
        "frequency": "daily",
        "data[0]": "value",
        "facets[series][]": series_id,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "offset": 0,
        "length": 5000,
    }
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(f"{_EIA_BASE}/{route}/", params=params)
        resp.raise_for_status()
    return resp.json().get("response", {}).get("data", [])


def collect(start: date, end: date) -> list[dict[str, Any]]:
    """WTI/Brent/천연가스 가격 레코드 목록을 반환한다."""
    records: list[dict[str, Any]] = []
    for series in _SERIES:
        rows = fetch_series(series["route"], series["series"], start, end)
        for row in rows:
            val = row.get("value")
            if val is None:
                continue
            records.append({
                "symbol":     series["symbol"],
                "price_date": row["period"],
                "price_usd":  float(val),
                "unit":       series["unit"],
                "source":     "eia",
            })
    return records
