"""Render cron 비용 절감을 위한 통합 스케줄러."""
import sys
from collections.abc import Callable
from datetime import datetime, time, timedelta, timezone

sys.path.insert(0, ".")

from db.error_repo import log_error
from db.run_repo import finish_run, has_running_run_since, has_successful_run_since, start_run
from jobs import (
    daily_maintenance,
    events_ingest,
    market_ingest,
    shipping_ingest,
    situation_summary_ingest,
    trump_ingest,
)
from utils.logger import get_logger

logger = get_logger(__name__)

_DISPATCHER_SOURCE = "cron_dispatcher"


def _hour_start(now: datetime) -> datetime:
    return now.replace(minute=0, second=0, microsecond=0)


def _two_hour_window_start(now: datetime) -> datetime:
    return now.replace(hour=now.hour - (now.hour % 2), minute=0, second=0, microsecond=0)


def _daily_window_start(now: datetime) -> datetime:
    today_target = datetime.combine(now.date(), time(6, 0), tzinfo=timezone.utc)
    if now >= today_target:
        return today_target
    return today_target - timedelta(days=1)


def _all_successful_since(source_names: list[str], since: datetime) -> bool:
    return all(has_successful_run_since(source_name, since) for source_name in source_names)


def _due_hourly_after_events(now: datetime, source_name: str) -> bool:
    if now.minute < 20:
        return False
    return not has_successful_run_since(source_name, _hour_start(now))


def _due_daily_maintenance(now: datetime) -> bool:
    window_start = _daily_window_start(now)
    return not _all_successful_since(
        ["portwatch", "eia_oil", "eia_gasoline", "data_cleanup"],
        window_start,
    )


def _run_task(name: str, task: Callable[[], None], dispatcher_run_id: int) -> bool:
    logger.info("%s 실행 시작", name)
    try:
        task()
    except Exception as exc:
        log_error(_DISPATCHER_SOURCE, name, str(exc), dispatcher_run_id)
        logger.exception("%s 실행 실패", name)
        return False

    logger.info("%s 실행 완료", name)
    return True


def run(force: bool = False) -> None:
    now = datetime.now(timezone.utc)
    if not force and has_running_run_since(_DISPATCHER_SOURCE, now - timedelta(minutes=30)):
        logger.warning("최근 실행 중인 cron dispatcher가 있어 이번 실행을 건너뜀")
        return

    run_id = start_run(_DISPATCHER_SOURCE)
    logger.info("통합 cron dispatcher 시작 (now=%s, force=%s)", now.isoformat(), force)

    tasks: list[tuple[str, Callable[[], None], bool]] = [
        ("market_ingest", market_ingest.run, True),
        ("shipping_ingest", shipping_ingest.run, True),
        ("events_ingest", events_ingest.run, force or not has_successful_run_since("rss_events", _hour_start(now))),
        (
            "situation_summary_ingest",
            situation_summary_ingest.run,
            force or _due_hourly_after_events(now, "situation_summary"),
        ),
        (
            "trump_ingest",
            trump_ingest.run,
            force or not has_successful_run_since("trump_social", _two_hour_window_start(now)),
        ),
        ("daily_maintenance", daily_maintenance.run, force or _due_daily_maintenance(now)),
    ]

    failures: list[str] = []
    executed = 0
    for name, task, due in tasks:
        if not due:
            logger.info("%s 실행 조건 미충족 - 건너뜀", name)
            continue
        executed += 1
        if not _run_task(name, task, run_id):
            failures.append(name)

    status = "partial" if failures else "success"
    finish_run(run_id, status, executed, executed - len(failures))
    logger.info(
        "통합 cron dispatcher 완료: executed=%d success=%d failures=%s",
        executed,
        executed - len(failures),
        ",".join(failures) if failures else "none",
    )

    if failures:
        raise RuntimeError(f"통합 cron 일부 실패: {', '.join(failures)}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="조건을 무시하고 모든 하위 잡을 실행")
    args = parser.parse_args()
    run(force=args.force)
