"""Session dates and observable trading windows for the market feed."""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from zoneinfo import ZoneInfo

import pandas as pd
import pandas_market_calendars as mcal
from pandas.tseries.holiday import AbstractHolidayCalendar, EasterMonday, GoodFriday, Holiday

FIVE_MINUTES = timedelta(minutes=5)
# The limit covers Yahoo's delayed bars and the observed 15:00 KST label of the KRX close.
MAX_DELAY = timedelta(minutes=35)

_CALENDAR_NAMES = {
    "NYSE": "NYSE",
    "VIX": "CBOE_Index_Options",
    "KRX": "XKRX",
    "CME_EQUITY": "CME_Equity",
    "CME_METALS": "CMEGlobex_Gold",
    "CME_ENERGY": "CMEGlobex_Energy",
    "ICE": "ICEUS",
    "TSE": "JPX",
    "HKEX": "HKEX",
    "SSE": "SSE",
    "US10Y": "SIFMA_US",
}
OVERNIGHT = frozenset({"CME_EQUITY", "CME_METALS", "CME_ENERGY", "ICE"})
_CME = OVERNIGHT - {"ICE"}


class StoxxEuropeHolidays(AbstractHolidayCalendar):
    rules = [Holiday("New Year", month=1, day=1), GoodFriday, EasterMonday,
             Holiday("Christmas", month=12, day=25), Holiday("Boxing Day", month=12, day=26)]


@dataclass(frozen=True)
class Session:
    day: date
    windows: tuple[tuple[datetime, datetime], ...]

    @property
    def opens(self) -> datetime:
        return self.windows[0][0]

    @property
    def closes(self) -> datetime:
        return self.windows[-1][1]

    def window_for(self, timestamp: datetime) -> tuple[datetime, datetime] | None:
        return next((window for window in self.windows if window[0] <= timestamp <= window[1]), None)

    def last_trading_time(self, now: datetime) -> datetime:
        return max(min(now, end) for start, end in self.windows if start <= now)


@lru_cache
def _calendar(name: str):
    return mcal.get_calendar(_CALENDAR_NAMES[name])


def _local(day: date, tz: str, hours: int, minutes: int = 0) -> datetime:
    return datetime.combine(day, time(hours, minutes), ZoneInfo(tz))


def _windows(name: str, day: date, row: dict) -> tuple[tuple[datetime, datetime], ...]:
    opens = row["market_open"].to_pydatetime()
    closes = row["market_close"].to_pydatetime()
    if name == "HKEX":
        closes += timedelta(minutes=10)  # closing auction, including half days
    elif name == "VIX":
        return ((_local(day, "America/Chicago", 2, 15), _local(day, "America/Chicago", 8, 25)),
                (opens, closes))
    elif name == "US10Y":
        opens = max(opens, _local(day, "America/Chicago", 7, 20))
        closes = min(closes, _local(day, "America/Chicago", 14))
    elif name == "ICE":
        # Yahoo's cash USD index publishes into the 18:00 ET close and starts on Sunday at 17:00 ET.
        prior = day - timedelta(days=1)
        opens = _local(prior, "America/New_York", 17 if day.weekday() == 0 else 18, 0 if day.weekday() == 0 else 5)

    pauses = []
    for key, value in row.items():
        # XKRX's legacy lunch break was abolished in 2000.
        if key == "break_start" and name != "KRX":
            end = row["break_end"]
        elif key.startswith("interruption_start_"):
            end = row[key.replace("start", "end")]
        else:
            continue
        if pd.notna(value) and pd.notna(end) and opens < value < end <= closes:
            pauses.append((value.to_pydatetime(), end.to_pydatetime()))

    windows = []
    for start, end in sorted(pauses):
        if opens < start:
            windows.append((opens, start))
        opens = max(opens, end)
    if opens < closes:
        windows.append((opens, closes))
    return tuple(windows)


def _thanksgiving(day: date) -> bool:
    return day.month == 11 and day.weekday() == 3 and 22 <= day.day <= 28


@lru_cache(maxsize=128)
def sessions_for(name: str, start: date, end: date) -> tuple[Session, ...]:
    if name == "STOXX":
        holidays = set(StoxxEuropeHolidays().holidays(start, end).date)
        return tuple(
            Session(day, ((_local(day, "Europe/Zurich", 9), _local(day, "Europe/Zurich", 18)),))
            for day in pd.date_range(start, end, freq="B").date if day not in holidays
        )

    calendar = _calendar(name)
    # XKRX's modern sessions are continuous. Use regular-session columns for every market.
    times = ["market_open", "market_close"]
    if name != "KRX" and "break_start" in calendar.market_times:
        times[1:1] = ["break_start", "break_end"]
    schedule = calendar.schedule(start - timedelta(days=1), end, market_times=times, interruptions=True)
    sessions = []
    thanksgiving_windows = ()
    for ts, row in schedule.iterrows():
        day = ts.date()
        windows = _windows(name, day, row.to_dict())
        if name in _CME and _thanksgiving(day):
            # CME assigns the Wednesday-evening/Thursday segment to Friday's trade date.
            thanksgiving_windows = windows
            continue
        if day >= start and windows:
            sessions.append(Session(day, thanksgiving_windows + windows))
        thanksgiving_windows = ()
    return tuple(sessions)
