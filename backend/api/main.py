import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.event_article_summary_service import get_or_create_summary
from utils.gemini_client import GeminiError
from utils.logger import get_logger

app = FastAPI(title="Hormuz Monitor API")
logger = get_logger(__name__)

_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class EventArticleSummaryResponse(BaseModel):
    event_id: int
    source_url: str | None
    locale: str
    summary: str
    model: str | None
    created_at: str | None = None
    cached: bool


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/events/{event_id}/summary", response_model=EventArticleSummaryResponse)
def event_article_summary(
    event_id: int,
    locale: Literal["ko", "en"] = Query("en"),
) -> dict:
    try:
        return get_or_create_summary(event_id, locale)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeminiError as exc:
        logger.error("기사 요약 생성 실패(event_id=%s, locale=%s): %s", event_id, locale, exc)
        raise HTTPException(status_code=502, detail="article summary generation failed") from exc
