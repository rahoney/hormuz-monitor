from websockets.exceptions import ConnectionClosedError

from jobs import shipping_ingest


def test_run_continues_after_live_ais_failure(monkeypatch):
    calls = []
    disconnect = ConnectionClosedError(None, None)

    def fail_collect():
        raise disconnect

    monkeypatch.setattr(shipping_ingest, "start_run", lambda source: 17)
    monkeypatch.setattr(shipping_ingest, "collect", fail_collect)
    monkeypatch.setattr(
        shipping_ingest,
        "log_error",
        lambda source, error_type, message, run_id: calls.append(
            ("error", source, error_type, message, run_id)
        ),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "insert",
        lambda table, records: calls.append(("insert", table, records)),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "estimate_recent_transits",
        lambda: calls.append(("estimate",)) or 3,
    )
    monkeypatch.setattr(
        shipping_ingest,
        "rebuild_summary",
        lambda: calls.append(("summary",)),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "finish_run",
        lambda run_id, status, fetched, saved: calls.append(
            ("finish", run_id, status, fetched, saved)
        ),
    )

    shipping_ingest.run()

    assert calls == [
        ("error", "aisstream", "live_collection", str(disconnect), 17),
        ("estimate",),
        ("summary",),
        ("finish", 17, "success", 0, 0),
    ]


def test_run_still_fails_when_followup_processing_fails(monkeypatch):
    calls = []

    monkeypatch.setattr(shipping_ingest, "start_run", lambda source: 23)
    monkeypatch.setattr(shipping_ingest, "collect", lambda: [])
    monkeypatch.setattr(
        shipping_ingest,
        "estimate_recent_transits",
        lambda: (_ for _ in ()).throw(RuntimeError("database unavailable")),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "finish_run",
        lambda run_id, status, fetched, saved: calls.append(
            ("finish", run_id, status, fetched, saved)
        ),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "log_error",
        lambda source, error_type, message, run_id: calls.append(
            ("error", source, error_type, message, run_id)
        ),
    )

    try:
        shipping_ingest.run()
    except RuntimeError as exc:
        assert str(exc) == "database unavailable"
    else:
        raise AssertionError("follow-up processing failure must propagate")

    assert calls == [
        ("finish", 23, "failed", 0, 0),
        ("error", "aisstream", "unknown", "database unavailable", 23),
    ]


def test_run_does_not_hide_configuration_errors(monkeypatch):
    calls = []

    monkeypatch.setattr(shipping_ingest, "start_run", lambda source: 31)
    monkeypatch.setattr(
        shipping_ingest,
        "collect",
        lambda: (_ for _ in ()).throw(RuntimeError("환경변수 누락: AISSTREAM_API_KEY")),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "finish_run",
        lambda run_id, status, fetched, saved: calls.append(
            ("finish", run_id, status, fetched, saved)
        ),
    )
    monkeypatch.setattr(
        shipping_ingest,
        "log_error",
        lambda source, error_type, message, run_id: calls.append(
            ("error", source, error_type, message, run_id)
        ),
    )

    try:
        shipping_ingest.run()
    except RuntimeError as exc:
        assert str(exc) == "환경변수 누락: AISSTREAM_API_KEY"
    else:
        raise AssertionError("configuration failure must propagate")

    assert calls == [
        ("finish", 31, "failed", 0, 0),
        ("error", "aisstream", "unknown", "환경변수 누락: AISSTREAM_API_KEY", 31),
    ]
