"""Risk score calculation and persistence."""
from datetime import datetime, timedelta, timezone

from db.select import fetch
from db.upsert import upsert
from services.transit_summary_service import weekly_average_transit
from utils.logger import get_logger

logger = get_logger(__name__)


def compute_risk_score(
    vessels: int | None,
    brent: float | None,
    brent_change_pct_7d: float | None,
    vix: float | None,
    geo_raw: int | None,
) -> dict:
    """가중치: 통행량 40% + 지정학 30% + 브렌트유 20% + VIX 10% (0~100 위험점수)."""
    if vessels is not None:
        v_score = (1.0 - min(vessels / 70, 1.0)) * 40
    else:
        v_score = 20.0

    if brent is not None:
        brent_price_score = 0.0 if brent <= 80 else (20.0 if brent >= 120 else ((brent - 80) / 40) * 20)
    else:
        brent_price_score = 10.0

    if brent_change_pct_7d is not None:
        brent_change_score = 0.0 if brent_change_pct_7d < 1 else min(int(brent_change_pct_7d), 20)
    else:
        brent_change_score = 0.0
    b_score = max(brent_price_score, brent_change_score)

    if vix is not None:
        vix_score = 0.0 if vix <= 15 else (10.0 if vix >= 35 else ((vix - 15) / 20) * 10)
    else:
        vix_score = 5.0

    if geo_raw is not None:
        g_score = ((geo_raw - 1) / 29) * 30
    else:
        total = round((1.0 - min(vessels / 70, 1.0)) * 70 + b_score + vix_score, 1) if vessels is not None else round(b_score + vix_score + 35, 1)
        return {
            "vessel_score": round(v_score, 1),
            "geo_score": None,
            "brent_score": round(b_score, 1),
            "vix_score": round(vix_score, 1),
            "total_score": round(total, 1),
            "geo_raw": None,
        }

    total = round(v_score + g_score + b_score + vix_score, 1)
    return {
        "vessel_score": round(v_score, 1),
        "geo_score": round(g_score, 1),
        "brent_score": round(b_score, 1),
        "vix_score": round(vix_score, 1),
        "total_score": min(total, 100.0),
        "geo_raw": geo_raw,
    }


def _brent_change_pct_7d(latest_price: float | None) -> float | None:
    if latest_price is None:
        return None

    rows = fetch("oil_price_series", columns="price_date,price_usd",
                 filters={"symbol": "eq.BRENT"}, order="price_date.desc", limit=15)
    if not rows:
        return None

    latest_date = datetime.fromisoformat(str(rows[0]["price_date"])).date()
    target_date = latest_date - timedelta(days=7)
    base_price = None
    for row in rows:
        price_date = datetime.fromisoformat(str(row["price_date"])).date()
        if price_date <= target_date:
            base_price = row.get("price_usd")
            break

    if base_price in (None, 0):
        return None
    return (float(latest_price) - float(base_price)) / float(base_price) * 100


def save_risk_score_today() -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    vessels = weekly_average_transit().get("n_total")

    brent_rows = fetch("oil_price_series", columns="price_usd",
                       filters={"symbol": "eq.BRENT"}, order="price_date.desc", limit=1)
    brent = brent_rows[0].get("price_usd") if brent_rows else None
    brent_change_pct_7d = _brent_change_pct_7d(brent)

    vix_rows = fetch("market_snapshots", columns="price",
                     filters={"symbol": "eq.VIX"}, order="snapshot_date.desc", limit=1)
    vix = vix_rows[0].get("price") if vix_rows else None

    geo_rows = fetch("situation_summaries", columns="geo_score",
                     order="generated_at.desc", limit=1)
    geo_raw = geo_rows[0].get("geo_score") if geo_rows else None

    scores = compute_risk_score(vessels, brent, brent_change_pct_7d, vix, geo_raw)
    upsert("risk_score_history", [{
        "score_date": today,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **scores,
    }], on_conflict="score_date")
    logger.info("리스크 점수 저장 — %s total=%.1f geo_raw=%s", today, scores["total_score"], geo_raw)
