import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.event_article_summary_service import get_or_create_summary
from utils.gemini_client import GeminiError

app = FastAPI(title="Hormuz Monitor API")

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
        raise HTTPException(status_code=502, detail="article summary generation failed") from exc
