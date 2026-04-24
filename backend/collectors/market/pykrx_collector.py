"""pykrx에서 KOSPI/KOSDAQ/VKOSPI 일별 스냅샷을 수집한다."""
import os
from datetime import date, timedelta
from typing import Any
from dotenv import load_dotenv

# .env 로드 후 pykrx가 요구하는 KRX_ID / KRX_PW 환경변수 매핑
load_dotenv()
if not os.getenv("KRX_ID"):
    os.environ["KRX_ID"] = os.getenv("KRX_WEB_ID", "")
if not os.getenv("KRX_PW"):
    os.environ["KRX_PW"] = os.getenv("KRX_WEB_PASSWORD", "")

import contextlib, io
from utils.logger import get_logger

_logger = get_logger(__name__)

with contextlib.redirect_stdout(io.StringIO()):
    from pykrx import stock

_logger.info("pykrx 준비 완료")

_INDICES: list[dict[str, str]] = [
    {"symbol": "KOSPI",   "ticker": "1001"},
    {"symbol": "KOSDAQ",  "ticker": "2001"},
    {"symbol": "VKOSPI",  "ticker": "1003"},
]


def collect_ohlcv(days: int = 35) -> list[dict[str, Any]]:
    """일봉 OHLCV 수집 (최근 N일)."""
    today = date.today()
    start_str = (today - timedelta(days=days)).strftime("%Y%m%d")
    end_str = today.strftime("%Y%m%d")
    records: list[dict[str, Any]] = []
    for idx in _INDICES:
        try:
            df = stock.get_index_ohlcv(start_str, end_str, idx["ticker"])
            if df is None or df.empty:
                continue
            for ts, row in df.iterrows():
                dt = ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10]
                records.append({
                    "symbol":     idx["symbol"],
                    "price_date": dt,
                    "open":       round(float(row["시가"]),  2),
                    "high":       round(float(row["고가"]),  2),
                    "low":        round(float(row["저가"]),  2),
                    "close":      round(float(row["종가"]), 2),
                    "source":     "pykrx",
                })
        except Exception:
            continue
    return records


def collect_live() -> list[dict[str, Any]]:
    """최근 7일 내 최신 종가를 반환한다 (한국장 마감 후 사용)."""
    today = date.today()
    start_str = (today - timedelta(days=7)).strftime("%Y%m%d")
    end_str = today.strftime("%Y%m%d")
    records: list[dict[str, Any]] = []
    for idx in _INDICES:
        try:
            df = stock.get_index_ohlcv(start_str, end_str, idx["ticker"])
            if df is None or df.empty:
                continue
            price = round(float(df["종가"].iloc[-1]), 2)
            chg = None
            if len(df) >= 2:
                prev = float(df["종가"].iloc[-2])
                if prev:
                    chg = round((price - prev) / prev * 100, 4)
            records.append({
                "symbol":        idx["symbol"],
                "snapshot_date": today.isoformat(),
                "price":         price,
                "change_pct":    chg,
                "source":        "pykrx",
            })
        except Exception:
            continue
    return records


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
