import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# 격리된 단위 테스트 환경을 위해 모듈 모킹
for mod in ("feedparser", "pandas_market_calendars"):
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

import pytest
from db.run_repo import has_run_since
from jobs import dispatcher
from jobs.dispatcher import _NON_FATAL_TASKS, _due_hourly_after_events


def test_has_run_since_has_no_status_filter() -> None:
    """has_run_since는 status 필터 없이 run_start gte 조건만 조회해야 한다."""
    dummy_resp = MagicMock()
    dummy_resp.json.return_value = [{"id": 123}]
    dummy_resp.raise_for_status.return_value = None

    mock_client = MagicMock()
    mock_client.get.return_value = dummy_resp
    mock_client_cm = MagicMock()
    mock_client_cm.__enter__.return_value = mock_client
    mock_client_cm.__exit__.return_value = None

    since = datetime(2026, 9, 29, 1, 0, 0, tzinfo=timezone.utc)
    with patch("db.run_repo.get_client", return_value=mock_client_cm):
        result = has_run_since("situation_summary", since)

    assert result is True
    mock_client.get.assert_called_once()
    _, kwargs = mock_client.get.call_args
    params = kwargs.get("params", {})
    assert "status" not in params
    assert params.get("source_name") == "eq.situation_summary"
    assert params.get("run_start") == "gte.2026-09-29T01:00:00+00:00"
    assert params.get("limit") == 1


def test_due_hourly_after_events_before_20_min() -> None:
    """1. now = xx:10 -> _due_hourly_after_events == False"""
    now = datetime(2026, 9, 29, 1, 10, 0, tzinfo=timezone.utc)
    with patch("jobs.dispatcher.has_run_since") as mock_has_run:
        assert _due_hourly_after_events(now, "situation_summary") is False
        mock_has_run.assert_not_called()


def test_due_hourly_after_events_at_or_after_20_min_no_previous_run() -> None:
    """2. now = xx:20 이상, has_run_since == False -> True"""
    now = datetime(2026, 9, 29, 1, 20, 0, tzinfo=timezone.utc)
    hour_start = datetime(2026, 9, 29, 1, 0, 0, tzinfo=timezone.utc)
    with patch("jobs.dispatcher.has_run_since", return_value=False) as mock_has_run:
        assert _due_hourly_after_events(now, "situation_summary") is True
        mock_has_run.assert_called_once_with("situation_summary", hour_start)


def test_due_hourly_after_events_failed_run_exists_skip_at_40_min() -> None:
    """3. xx:20에 실패한 run이 이미 존재(has_run_since==True)하면 xx:40에는 False."""
    now = datetime(2026, 9, 29, 1, 40, 0, tzinfo=timezone.utc)
    hour_start = datetime(2026, 9, 29, 1, 0, 0, tzinfo=timezone.utc)
    with patch("jobs.dispatcher.has_run_since", return_value=True) as mock_has_run:
        assert _due_hourly_after_events(now, "situation_summary") is False
        mock_has_run.assert_called_once_with("situation_summary", hour_start)


def test_due_hourly_after_events_next_hour_after_20_min() -> None:
    """4. 다음 시간 xx+1:20에 새 hour_start 이후 run 없음 -> True"""
    now = datetime(2026, 9, 29, 2, 20, 0, tzinfo=timezone.utc)
    hour_start = datetime(2026, 9, 29, 2, 0, 0, tzinfo=timezone.utc)
    with patch("jobs.dispatcher.has_run_since", return_value=False) as mock_has_run:
        assert _due_hourly_after_events(now, "situation_summary") is True
        mock_has_run.assert_called_once_with("situation_summary", hour_start)


def test_situation_summary_ingest_is_in_non_fatal_tasks() -> None:
    """situation_summary_ingest가 _NON_FATAL_TASKS에 포함되어 있어야 한다."""
    assert "situation_summary_ingest" in _NON_FATAL_TASKS


def test_dispatcher_run_situation_summary_only_fails_non_fatal() -> None:
    """5. situation_summary_ingest만 실패한 경우:

    - 최종 RuntimeError를 발생시키지 않아야 한다.
    - finish_run dispatcher status는 'partial'
    """
    fixed_now = datetime(2026, 9, 29, 1, 20, 0, tzinfo=timezone.utc)

    def fake_run_task(name: str, task: object, dispatcher_run_id: int) -> bool:
        return name != "situation_summary_ingest"

    with (
        patch("jobs.dispatcher.datetime") as mock_dt,
        patch("jobs.dispatcher.has_running_run_since", return_value=False),
        patch("jobs.dispatcher.start_run", return_value=999),
        patch("jobs.dispatcher.finish_run") as mock_finish_run,
        patch("jobs.dispatcher._run_task", side_effect=fake_run_task),
    ):
        mock_dt.now.return_value = fixed_now
        mock_dt.combine.side_effect = datetime.combine

        # RuntimeError가 발생하지 않고 정상 종료되어야 함
        dispatcher.run(force=True)

        mock_finish_run.assert_called_once()
        args, _ = mock_finish_run.call_args
        run_id, status, executed, succeeded = args
        assert run_id == 999
        assert status == "partial"
        assert succeeded == executed - 1


def test_dispatcher_run_fatal_task_fails() -> None:
    """6. market_ingest 같은 fatal task가 실패하면 기존처럼 RuntimeError 발생."""
    fixed_now = datetime(2026, 9, 29, 1, 20, 0, tzinfo=timezone.utc)

    def fake_run_task(name: str, task: object, dispatcher_run_id: int) -> bool:
        return name != "market_ingest"

    with (
        patch("jobs.dispatcher.datetime") as mock_dt,
        patch("jobs.dispatcher.has_running_run_since", return_value=False),
        patch("jobs.dispatcher.start_run", return_value=999),
        patch("jobs.dispatcher.finish_run") as mock_finish_run,
        patch("jobs.dispatcher._run_task", side_effect=fake_run_task),
    ):
        mock_dt.now.return_value = fixed_now
        mock_dt.combine.side_effect = datetime.combine

        with pytest.raises(RuntimeError, match="market_ingest"):
            dispatcher.run(force=True)

        mock_finish_run.assert_called_once()
        _, status, _, _ = mock_finish_run.call_args[0]
        assert status == "partial"


def test_dispatcher_run_both_situation_summary_and_fatal_task_fail() -> None:
    """7. situation_summary_ingest + fatal task가 함께 실패하면 RuntimeError 발생."""
    fixed_now = datetime(2026, 9, 29, 1, 20, 0, tzinfo=timezone.utc)

    def fake_run_task(name: str, task: object, dispatcher_run_id: int) -> bool:
        return name not in ("situation_summary_ingest", "market_ingest")

    with (
        patch("jobs.dispatcher.datetime") as mock_dt,
        patch("jobs.dispatcher.has_running_run_since", return_value=False),
        patch("jobs.dispatcher.start_run", return_value=999),
        patch("jobs.dispatcher.finish_run") as mock_finish_run,
        patch("jobs.dispatcher._run_task", side_effect=fake_run_task),
    ):
        mock_dt.now.return_value = fixed_now
        mock_dt.combine.side_effect = datetime.combine

        with pytest.raises(RuntimeError, match="market_ingest"):
            dispatcher.run(force=True)

        mock_finish_run.assert_called_once()
        _, status, _, _ = mock_finish_run.call_args[0]
        assert status == "partial"
