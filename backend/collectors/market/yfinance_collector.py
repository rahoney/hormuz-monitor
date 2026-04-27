"""yfinance에서 시장 지표 스냅샷·5분봉·일봉 OHLCV를 수집한다."""
from datetime import date, datetime, timedelta
import math
from typing import Any
import yfinance as yf
import pandas_market_calendars as mcal
import pytz
from utils.logger import get_logger

logger = get_logger(__name__)

_SYMBOLS: list[dict[str, str]] = [
    {"symbol": "VIX",        "ticker": "^VIX",  "exchange": "NYSE"},
    {"symbol": "NASDAQ",     "ticker": "^IXIC", "exchange": "NYSE"},
    {"symbol": "SP500",      "ticker": "^GSPC", "exchange": "NYSE"},
    {"symbol": "KOSPI",      "ticker": "^KS11", "exchange": "KRX"},
    {"symbol": "KOSDAQ",     "ticker": "^KQ11", "exchange": "KRX"},
    {"symbol": "ES_FUTURES", "ticker": "ES=F",  "exchange": "CME"},
    {"symbol": "NQ_FUTURES", "ticker": "NQ=F",  "exchange": "CME"},
    {"symbol": "GOLD_FUTURES", "ticker": "GC=F", "exchange": "CME"},
    {"symbol": "USD_INDEX",    "ticker": "DX-Y.NYB", "exchange": "ICE"},
    {"symbol": "GASOLINE_FUTURES", "ticker": "RB=F", "exchange": "CME"},
    {"symbol": "HEATING_OIL_FUTURES", "ticker": "HO=F", "exchange": "CME"},
]

# 캐시된 캘린더 인스턴스
_CALENDARS = {
    "NYSE": mcal.get_calendar('XNYS'),
    "KRX":  mcal.get_calendar('XKRX'),
    "CME":  mcal.get_calendar('CME_Equity'),
    "ICE":  mcal.get_calendar('ICEUS'),
}

def _is_trading_day(exchange: str) -> bool:
    try:
        cal = _CALENDARS.get(exchange)
        if not cal:
            return True # 모르는 거래소는 일단 수집 시도
        
        # 거래소의 로컬 타임존 기준으로 '오늘'이 개장일인지 확인
        tz = cal.tz.zone
        today_local = datetime.now(pytz.timezone(tz)).date()
        schedule = cal.schedule(start_date=today_local, end_date=today_local)
        return not schedule.empty
    except Exception as e:
        logger.warning(f"캘린더 확인 실패 ({exchange}): {e}")
        return True # 실패 시 폴백으로 수집 시도

def _finite_float(value: Any) -> float | None:
    raw = value.iloc[0] if hasattr(value, "iloc") else value
    try:
        number = float(raw)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None

def collect_ohlcv(exchange: str, days: int = 35) -> list[dict[str, Any]]:
    """특정 거래소의 일봉 OHLCV 수집 (최근 N일)."""
    end = date.today()
    start = end - timedelta(days=days)
    records: list[dict[str, Any]] = []

    symbols_to_fetch = [s for s in _SYMBOLS if s["exchange"] == exchange]
    
    for s in symbols_to_fetch:
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
        except Exception as e:
            logger.error(f"OHLCV 수집 에러 ({s['symbol']}): {e}")
            continue
    return records

def collect_intraday() -> list[dict[str, Any]]:
    """5분봉 데이터 수집. 개장일인 거래소의 티커만 수집한다."""
    records: list[dict[str, Any]] = []
    
    for s in _SYMBOLS:
        if not _is_trading_day(s["exchange"]):
            continue
            
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
        except Exception as e:
            logger.error(f"Intraday 수집 에러 ({s['symbol']}): {e}")
            continue
    return records

def collect_live() -> list[dict[str, Any]]:
    """현재 시장 실시간 가격을 수집한다. 개장일인 거래소만 수집."""
    today = date.today().isoformat()
    records: list[dict[str, Any]] = []
    
    for s in _SYMBOLS:
        if not _is_trading_day(s["exchange"]):
            continue
            
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
        except Exception as e:
            logger.error(f"Live 수집 에러 ({s['symbol']}): {e}")
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
