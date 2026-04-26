"""Small Gemini REST client with retry and model fallback."""
from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass
from typing import Any, Iterable

import httpx
from dotenv import load_dotenv

from utils.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_PRIMARY_MODEL = "models/gemini-3.1-flash-lite-preview"
SUMMARY_MODELS = (
    "models/gemini-3.1-flash-lite-preview",
    "models/gemini-3-flash-preview",
    "models/gemini-2.5-flash",
    "models/gemma-3-27b-it",
)
TRANSLATION_MODELS = (
    "models/gemini-3.1-flash-lite-preview",
    "models/gemini-2.5-flash",
    "models/gemma-3-27b-it",
)
RETRY_STATUS_CODES = {429, 500, 503, 504}


class GeminiError(RuntimeError):
    """Raised when every retry and fallback model fails."""


@dataclass(frozen=True)
class GeminiResult:
    text: str
    model: str
    attempts: int


def _models_from_env(name: str, defaults: Iterable[str]) -> list[str]:
    raw = os.getenv(name, "")
    models = [m.strip() for m in raw.split(",") if m.strip()]
    if not models:
        models = list(defaults)
    return [_normalize_model(m) for m in models]


def _normalize_model(model: str) -> str:
    return model if model.startswith("models/") else f"models/{model}"


def _retry_after_seconds(resp: httpx.Response) -> float | None:
    raw = resp.headers.get("retry-after")
    if not raw:
        return None
    try:
        return max(0.0, min(float(raw), 30.0))
    except ValueError:
        return None


def _sleep_before_retry(attempt_index: int, resp: httpx.Response | None = None) -> None:
    retry_after = _retry_after_seconds(resp) if resp is not None else None
    if retry_after is not None:
        delay = retry_after
    else:
        delay = min(2.0 * (2 ** attempt_index), 20.0) + random.uniform(0.0, 0.7)
    time.sleep(delay)


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts).strip()


def generate_text(
    prompt: str,
    *,
    task: str,
    models: Iterable[str],
    max_output_tokens: int,
    temperature: float,
    timeout: float = 30.0,
    retries_per_model: int = 3,
    extra_generation_config: dict[str, Any] | None = None,
) -> GeminiResult:
    """Generate text, retrying transient failures before trying fallback models."""
    api_key = os.getenv("GOOGLE_GEMINI_API_KEY", "")
    if not api_key:
        raise GeminiError("GOOGLE_GEMINI_API_KEY is not set")

    generation_config: dict[str, Any] = {
        "maxOutputTokens": max_output_tokens,
        "temperature": temperature,
    }
    if extra_generation_config:
        generation_config.update(extra_generation_config)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": generation_config,
    }

    failures: list[str] = []
    total_attempts = 0
    with httpx.Client(timeout=timeout) as client:
        for model in [_normalize_model(m) for m in models]:
            for attempt_index in range(retries_per_model):
                total_attempts += 1
                try:
                    resp = client.post(
                        f"{BASE_URL}/{model}:generateContent",
                        params={"key": api_key},
                        json=payload,
                    )
                    if resp.status_code in RETRY_STATUS_CODES:
                        msg = f"{model} returned HTTP {resp.status_code}"
                        failures.append(msg)
                        logger.warning(
                            "Gemini %s attempt %d/%d failed: %s",
                            task,
                            attempt_index + 1,
                            retries_per_model,
                            msg,
                        )
                        if attempt_index < retries_per_model - 1:
                            _sleep_before_retry(attempt_index, resp)
                            continue
                        break

                    resp.raise_for_status()
                    text = _extract_text(resp.json())
                    if text:
                        if model != DEFAULT_PRIMARY_MODEL:
                            logger.warning("Gemini %s succeeded with fallback model %s", task, model)
                        return GeminiResult(text=text, model=model, attempts=total_attempts)

                    failures.append(f"{model} returned empty text")
                    break
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    failures.append(f"{model} {exc.__class__.__name__}: {exc}")
                    logger.warning(
                        "Gemini %s attempt %d/%d timed out or failed on transport: %s",
                        task,
                        attempt_index + 1,
                        retries_per_model,
                        exc,
                    )
                    if attempt_index < retries_per_model - 1:
                        _sleep_before_retry(attempt_index)
                        continue
                    break
                except httpx.HTTPStatusError as exc:
                    failures.append(f"{model} HTTP {exc.response.status_code}: {exc.response.text[:300]}")
                    break

    raise GeminiError(f"Gemini {task} failed after {total_attempts} attempts: {' | '.join(failures[-8:])}")


def summary_models() -> list[str]:
    return _models_from_env("GEMINI_SUMMARY_MODELS", SUMMARY_MODELS)


def translation_models() -> list[str]:
    return _models_from_env("GEMINI_TRANSLATION_MODELS", TRANSLATION_MODELS)
