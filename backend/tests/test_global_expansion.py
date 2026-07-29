from __future__ import annotations

from typing import Any

import pytest

from collectors.market import yfinance_collector
from collectors.market.yfinance_collector import _SYMBOLS
from collectors.summary.situation_summarizer import (
    SECTION_TITLES_BY_LOCALE,
    _valid_translated_structure,
)
from jobs import market_ingest, situation_summary_ingest
from services import risk_score_service


def _translated_structure(locale: str) -> dict[str, Any]:
    titles = SECTION_TITLES_BY_LOCALE[locale]
    return {
        "version": 1,
        "sections": [
            {
                "title": title,
                "body": f"{title} translated body",
                "highlights": [{"text": title, "tone": "watch"}],
            }
            for title in titles
        ],
    }


def test_translated_summary_requires_exact_titles_and_valid_highlights() -> None:
    locale = "fr"
    titles = SECTION_TITLES_BY_LOCALE[locale]
    valid = _translated_structure(locale)
    assert _valid_translated_structure(valid, titles)

    wrong_title = _translated_structure(locale)
    wrong_title["sections"][0]["title"] = "Core situation"
    assert not _valid_translated_structure(wrong_title, titles)

    missing_highlight_text = _translated_structure(locale)
    missing_highlight_text["sections"][0]["highlights"][0]["text"] = "not in body"
    assert not _valid_translated_structure(missing_highlight_text, titles)


def test_every_market_exchange_has_an_ohlcv_schedule() -> None:
    symbol_exchanges = {item["exchange"] for item in _SYMBOLS}
    assert symbol_exchanges <= set(market_ingest._OHLCV_TARGET_HOURS_UTC)


def test_ohlcv_download_end_includes_current_day(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    class _EmptyFrame:
        empty = True

    def fake_download(*_args: Any, **kwargs: Any) -> _EmptyFrame:
        calls.append(kwargs)
        return _EmptyFrame()

    monkeypatch.setattr(yfinance_collector.yf, "download", fake_download)
    yfinance_collector.collect_ohlcv("TSE", days=100)

    assert calls
    from datetime import date, timedelta

    assert calls[0]["end"] == (date.today() + timedelta(days=1)).isoformat()


class _FakeResponse:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def raise_for_status(self) -> None:
        return None

    def json(self) -> list[dict[str, Any]]:
        return self._rows


class _FakeClient:
    def __init__(self) -> None:
        self.publish_calls: list[dict[str, Any]] = []

    def __enter__(self) -> _FakeClient:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def patch(self, path: str, **kwargs: Any) -> _FakeResponse:
        self.publish_calls.append({"path": path, **kwargs})
        return _FakeResponse([{"id": 99, "is_published": True}])


def _patch_summary_job(monkeypatch: pytest.MonkeyPatch, translation_count: int) -> _FakeClient:
    fake_client = _FakeClient()
    structured = {
        "version": 1,
        "sections": [
            {"title": str(index), "body": "body", "highlights": []}
            for index in range(4)
        ],
    }
    monkeypatch.setattr(
        situation_summary_ingest,
        "generate",
        lambda: ("한국어 요약", "English summary", 10, structured, structured),
    )
    monkeypatch.setattr(
        situation_summary_ingest,
        "insert_returning",
        lambda *_args, **_kwargs: [{"id": 99}],
    )
    monkeypatch.setattr(situation_summary_ingest, "get_client", lambda: fake_client)
    monkeypatch.setattr(situation_summary_ingest, "start_run", lambda *_args: 1)
    monkeypatch.setattr(situation_summary_ingest, "finish_run", lambda *_args: None)
    monkeypatch.setattr(situation_summary_ingest, "log_error", lambda *_args: None)
    monkeypatch.setattr(situation_summary_ingest, "translate_pending", lambda *_args: 0)

    from collectors.summary import situation_summarizer
    from db import upsert as upsert_module

    attempts = 0

    def fake_translate(*_args: Any, **_kwargs: Any) -> tuple[str, dict[str, Any], str] | None:
        nonlocal attempts
        attempts += 1
        if attempts > translation_count:
            return None
        return "translated", structured, "model"

    monkeypatch.setattr(situation_summarizer, "translate_summary_for_locale", fake_translate)
    monkeypatch.setattr(upsert_module, "upsert", lambda *_args, **_kwargs: translation_count)
    return fake_client


def test_summary_is_published_only_after_all_translations(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = _patch_summary_job(monkeypatch, translation_count=12)
    situation_summary_ingest.run()
    assert len(fake_client.publish_calls) == 1
    assert fake_client.publish_calls[0]["json"] == {"is_published": True}


def test_partial_summary_translation_is_not_published(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = _patch_summary_job(monkeypatch, translation_count=11)
    with pytest.raises(RuntimeError, match="상황 요약 통합 잡 일부 실패"):
        situation_summary_ingest.run()
    assert fake_client.publish_calls == []


def test_risk_history_persists_raw_inputs(monkeypatch: pytest.MonkeyPatch) -> None:
    saved: list[dict[str, Any]] = []

    monkeypatch.setattr(
        risk_score_service,
        "weekly_average_transit",
        lambda: {"n_total": 61, "inland_entry_count": 31, "offshore_exit_count": 30},
    )

    def fake_fetch(table: str, **kwargs: Any) -> list[dict[str, Any]]:
        if table == "oil_price_series":
            if kwargs.get("limit") == 1:
                return [{"price_usd": 91.5}]
            return [
                {"price_date": "2026-07-29", "price_usd": 91.5},
                {"price_date": "2026-07-22", "price_usd": 90.0},
            ]
        if table == "market_snapshots":
            return [{"price": 22.0}]
        if table == "situation_summaries":
            assert kwargs["filters"] == {"is_published": "eq.true"}
            return [{"geo_score": 18}]
        raise AssertionError(table)

    monkeypatch.setattr(risk_score_service, "fetch", fake_fetch)
    monkeypatch.setattr(
        risk_score_service,
        "upsert",
        lambda _table, records, **_kwargs: saved.extend(records),
    )

    risk_score_service.save_risk_score_today()

    assert saved[0]["vessels_raw"] == 61
    assert saved[0]["inland_entry_raw"] == 31
    assert saved[0]["offshore_exit_raw"] == 30
    assert saved[0]["brent_raw"] == 91.5
    assert saved[0]["vix_raw"] == 22.0
    assert saved[0]["geo_raw"] == 18
