"""EIA API v2에서 미국 전국·지역·주별 휘발유 소매가격(주간)을 수집한다."""
import os
from datetime import date
from typing import Any
import httpx
from dotenv import load_dotenv
from utils.logger import get_logger

load_dotenv()

_EIA_BASE = "https://api.eia.gov/v2"
_API_KEY = os.getenv("EIA_API_KEY", "")
logger = get_logger(__name__)

# EIA 주간 휘발유 가격 시리즈 (정규 휘발유 소매가, $/gallon)
_SERIES: list[dict[str, str]] = [
    {"area_code": "NUS", "area_name": "U.S.",           "area_type": "national", "series_id": "PET.EMM_EPMR_PTE_NUS_DPG.W"},
    {"area_code": "R1X", "area_name": "East Coast",     "area_type": "region",   "series_id": "PET.EMM_EPMR_PTE_R1X_DPG.W"},
    {"area_code": "R20", "area_name": "Midwest",        "area_type": "region",   "series_id": "PET.EMM_EPMR_PTE_R20_DPG.W"},
    {"area_code": "R30", "area_name": "Gulf Coast",     "area_type": "region",   "series_id": "PET.EMM_EPMR_PTE_R30_DPG.W"},
    {"area_code": "R40", "area_name": "Rocky Mountain", "area_type": "region",   "series_id": "PET.EMM_EPMR_PTE_R40_DPG.W"},
    {"area_code": "R50", "area_name": "West Coast",     "area_type": "region",   "series_id": "PET.EMM_EPMR_PTE_R50_DPG.W"},
    {"area_code": "SCA", "area_name": "California",     "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SCA_DPG.W"},
    {"area_code": "SFL", "area_name": "Florida",        "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SFL_DPG.W"},
    {"area_code": "SNY", "area_name": "New York",       "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SNY_DPG.W"},
    {"area_code": "STX", "area_name": "Texas",          "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_STX_DPG.W"},
    {"area_code": "SWA", "area_name": "Washington",     "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SWA_DPG.W"},
    {"area_code": "SCO", "area_name": "Colorado",       "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SCO_DPG.W"},
    {"area_code": "SMA", "area_name": "Massachusetts",  "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SMA_DPG.W"},
    {"area_code": "SMN", "area_name": "Minnesota",      "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SMN_DPG.W"},
    {"area_code": "SOH", "area_name": "Ohio",           "area_type": "state",    "series_id": "PET.EMM_EPMR_PTE_SOH_DPG.W"},
]


def _fetch_series(series_id: str, start: date, end: date) -> list[dict[str, Any]]:
    params = {
        "api_key": _API_KEY,
        "frequency": "weekly",
        "data[0]": "value",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "offset": 0,
        "length": 500,
    }
    last_error: httpx.RequestError | None = None
    for _ in range(2):
        try:
            with httpx.Client(timeout=20.0) as client:
                resp = client.get(f"{_EIA_BASE}/seriesid/{series_id}", params=params)
                resp.raise_for_status()
            return resp.json().get("response", {}).get("data", [])
        except httpx.RequestError as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    return []


def collect(start: date, end: date) -> list[dict[str, Any]]:
    """전국·지역·주별 주간 휘발유 가격을 수집한다. 데이터 없는 시리즈는 건너뛴다."""
    records: list[dict[str, Any]] = []
    start_iso = start.isoformat()
    end_iso = end.isoformat()

    for s in _SERIES:
        try:
            rows = _fetch_series(s["series_id"], start, end)
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "EIA 휘발유 시리즈 수집 실패 (%s): HTTP %s",
                s["area_code"],
                exc.response.status_code,
            )
            continue
        except Exception as exc:
            logger.warning("EIA 휘발유 시리즈 수집 실패 (%s): %s", s["area_code"], type(exc).__name__)
            continue
        for row in rows:
            period = row.get("period")
            if not period or not (start_iso <= period <= end_iso):
                continue
            val = row.get("value")
            if val is None:
                continue
            records.append({
                "area_code":  s["area_code"],
                "area_name":  s["area_name"],
                "area_type":  s["area_type"],
                "price_date": period,
                "price_usd":  float(val),
                "source":     "eia",
            })
    return records
