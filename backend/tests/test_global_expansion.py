from __future__ import annotations

import json
from typing import Any

import pytest

from collectors.market import yfinance_collector
from collectors.market.yfinance_collector import _SYMBOLS
from collectors.social import trump_translator
from collectors.summary import situation_summarizer
from collectors.summary.situation_summarizer import (
    LOCALE_NAME_MAP,
    SECTION_TITLES_BY_LOCALE,
    _valid_translated_structure,
)
from jobs import market_ingest, situation_summary_ingest
from services import risk_score_service
from utils import gemini_client
from utils.gemini_client import GeminiResult


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


def test_summary_translation_batches_locales_in_groups_of_three(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_generate_text(*_args: Any, **kwargs: Any) -> GeminiResult:
        calls.append(kwargs)
        locales = kwargs["extra_generation_config"]["responseJsonSchema"]["properties"]["translations"]["items"]["properties"]["locale"]["enum"]
        translations = [
            {
                "locale": locale,
                "sections": [
                    {
                        "body": f"{locale} translated section {index}",
                        "highlights": [{"text": locale, "tone": "watch"}],
                    }
                    for index in range(4)
                ],
            }
            for locale in locales
        ]
        return GeminiResult(
            text=json.dumps({"translations": translations}, ensure_ascii=False),
            model="models/gemini-3.5-flash-lite",
            attempts=1,
        )

    monkeypatch.setattr(situation_summarizer, "generate_text", fake_generate_text)
    translated = situation_summarizer.translate_summary_for_locales(None, "English source")

    assert set(translated) == set(LOCALE_NAME_MAP)
    assert len(calls) == 4
    assert all(call["task"] == "situation_summary_translate_group" for call in calls)
    assert all(call["max_output_tokens"] == 16384 for call in calls)
    assert all(call["retries_per_model"] == 1 for call in calls)
    assert [
        call["extra_generation_config"]["responseJsonSchema"]["properties"]["translations"]["items"]["properties"]["locale"]["enum"]
        for call in calls
    ] == [["ar", "fa", "ja"], ["es", "tr", "de"], ["fr", "pt-BR", "it"], ["zh-CN", "zh-TW", "ru"]]


def test_trump_translation_pretranslates_all_locale_groups(monkeypatch: pytest.MonkeyPatch) -> None:
    selected_batches: list[tuple[list[dict[str, Any]], tuple[str, ...]]] = []

    class FakeClient:
        def get(self, path: str, *_args: Any, **_kwargs: Any) -> _FakeResponse:
            if path == "/trump_posts":
                return _FakeResponse([
                    {"id": 1, "content": "First post", "content_ko": None},
                    {"id": 2, "content": "Second post", "content_ko": None},
                ])
            assert path == "/trump_post_translations"
            return _FakeResponse([])

        def patch(self, *_args: Any, **_kwargs: Any) -> _FakeResponse:
            return _FakeResponse([])

        def post(self, *_args: Any, **_kwargs: Any) -> _FakeResponse:
            return _FakeResponse([])

    def fake_translate_batch(
        batch: list[dict[str, Any]], locales: tuple[str, ...]
    ) -> tuple[dict[tuple[int, str], str], str]:
        selected_batches.append((batch, locales))
        return {
            (post["post_id"], locale): f"번역 {post['post_id']} {locale}"
            for post in batch
            for locale in post["target_locales"]
        }, "models/gemini-3.5-flash-lite"

    monkeypatch.setattr(trump_translator, "_translate_batch", fake_translate_batch)
    progress = trump_translator.translate_pending(FakeClient())
    assert progress.requested == 26
    assert progress.saved == 26
    assert progress.failed_groups == 0
    assert len(selected_batches) == 5
    assert [locales for _batch, locales in selected_batches] == [
        ("ko", "ar", "fa"), ("ja", "es", "tr"), ("de", "fr", "pt-BR"),
        ("it", "zh-CN", "zh-TW"), ("ru",),
    ]


def test_gemini_request_gate_spaces_physical_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = [100.0]
    sleeps: list[float] = []

    monkeypatch.setenv("GEMINI_MIN_REQUEST_INTERVAL_SECONDS", "8")
    monkeypatch.setattr(gemini_client.time, "monotonic", lambda: clock[0])

    def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock[0] += seconds

    monkeypatch.setattr(gemini_client.time, "sleep", fake_sleep)
    monkeypatch.setattr(gemini_client, "_last_request_started_at", None)

    gemini_client._wait_for_request_slot()
    clock[0] = 102.0
    gemini_client._wait_for_request_slot()

    assert sleeps == [6.0]


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
        self.status_code = 204

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

    from collectors.summary import situation_summarizer
    from db import upsert as upsert_module

    calls = 0

    def fake_translate(*_args: Any, **_kwargs: Any) -> dict[str, tuple[str, dict[str, Any], str]]:
        nonlocal calls
        calls += 1
        return {
            locale: ("translated", structured, "model")
            for locale in list(LOCALE_NAME_MAP)[:translation_count]
        }

    monkeypatch.setattr(situation_summarizer, "translate_summary_for_locales", fake_translate)
    monkeypatch.setattr(upsert_module, "upsert", lambda *_args, **_kwargs: translation_count)
    fake_client.translation_calls = lambda: calls  # type: ignore[attr-defined]
    return fake_client


def test_summary_is_published_after_translation_batches(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = _patch_summary_job(monkeypatch, translation_count=12)
    situation_summary_ingest.run()
    assert len(fake_client.publish_calls) == 1
    assert fake_client.publish_calls[0]["json"] == {"is_published": True}
    assert fake_client.translation_calls() == 1  # type: ignore[attr-defined]


def test_partial_summary_translation_is_published_with_english_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = _patch_summary_job(monkeypatch, translation_count=11)
    situation_summary_ingest.run()
    assert len(fake_client.publish_calls) == 1


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
