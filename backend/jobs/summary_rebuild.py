"""chokepoint_transits 최신 1일 데이터로 strait_metrics summary를 재계산해 저장하는 잡."""
import sys
from datetime import datetime, timezone, timedelta
sys.path.insert(0, ".")

from db.select import fetch, fetch_latest
from db.upsert import upsert
from db.run_repo import start_run, finish_run
from db.error_repo import log_error
from utils.logger import get_logger

logger = get_logger(__name__)


def _compute_risk_score(
    vessels: int | None,
    brent: float | None,
    vix: float | None,
    geo_raw: int | None,
) -> dict:
    """가중치: 통행량 40% + 지정학 30% + 브렌트유 15% + VIX 15% (0~100)"""
    if vessels is not None:
        v_score = min(vessels / 70, 1.0) * 40
    else:
        v_score = 20.0  # fallback: 절반

    if brent is not None:
        b_score = 15.0 if brent <= 80 else (0.0 if brent >= 120 else ((120 - brent) / 40) * 15)
    else:
        b_score = 7.5

    if vix is not None:
        vix_score = 15.0 if vix <= 15 else (0.0 if vix >= 35 else ((35 - vix) / 20) * 15)
    else:
        vix_score = 7.5

    if geo_raw is not None:
        # geo_raw 1(안전)→30점 기여, geo_raw 30(위험)→0점 기여
        g_score = ((30 - geo_raw) / 29) * 30
    else:
        # geo_score 없으면 나머지 가중치를 70%로 올려 fallback
        total = round(min(vessels / 70, 1.0) * 70 + b_score + vix_score, 1) if vessels is not None else round(b_score + vix_score + 35, 1)
        return {
            "vessel_score": round(v_score, 1),
            "geo_score": None,
            "brent_score": round(b_score, 1),
            "vix_score": round(vix_score, 1),
            "total_score": round(total, 1),
            "geo_raw": None,
        }
        g_score = 15.0

    total = round(v_score + g_score + b_score + vix_score, 1)
    return {
        "vessel_score": round(v_score, 1),
        "geo_score": round(g_score, 1),
        "brent_score": round(b_score, 1),
        "vix_score": round(vix_score, 1),
        "total_score": min(total, 100.0),
        "geo_raw": geo_raw,
    }


def _save_risk_score_today() -> None:
    today = datetime.now(timezone.utc).date().isoformat()

    # 통행량
    latest_transit = fetch_latest("chokepoint_transits", "transit_date")
    vessels = latest_transit.get("n_total") if latest_transit else None

    # 브렌트유
    brent_rows = fetch("oil_price_series", columns="price_usd",
                       filters={"symbol": "eq.BRENT"}, order="price_date.desc", limit=1)
    brent = brent_rows[0].get("price_usd") if brent_rows else None

    # VIX
    vix_rows = fetch("market_snapshots", columns="price",
                     filters={"symbol": "eq.VIX"}, order="snapshot_date.desc", limit=1)
    vix = vix_rows[0].get("price") if vix_rows else None

    # 지정학 점수 (최신 situation_summaries)
    geo_rows = fetch("situation_summaries", columns="geo_score",
                     order="generated_at.desc", limit=1)
    geo_raw = geo_rows[0].get("geo_score") if geo_rows else None

    scores = _compute_risk_score(vessels, brent, vix, geo_raw)
    upsert("risk_score_history", [{
        "score_date": today,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **scores,
    }], on_conflict="score_date")
    logger.info("리스크 점수 저장 — %s total=%.1f geo_raw=%s", today, scores["total_score"], geo_raw)


def _status_level(total: int) -> str:
    if total == 0:
        return "restricted"
    if total < 5:
        return "high_risk"
    return "normal"


def run() -> None:
    run_id = start_run("summary_rebuild")

    try:
        latest = fetch_latest("chokepoint_transits", "transit_date")

        if not latest:
            logger.warning("chokepoint_transits 데이터 없음 — summary 건너뜀")
            finish_run(run_id, "success", 0, 0)
            return

        transit_date = latest["transit_date"]
        total = latest.get("n_total") or 0
        tanker = latest.get("n_tanker") or 0

        # strait_metrics는 period 기반이므로 transit_date를 하루 범위로 매핑
        period_start = f"{transit_date}T00:00:00+00:00"
        period_end   = f"{transit_date}T23:59:59+00:00"

        metric = {
            "period_start":        period_start,
            "period_end":          period_end,
            "total_vessels":       total,
            "lng_vessels":         0,
            "crude_vessels":       tanker,
            "inland_entry_count":  0,
            "offshore_exit_count": 0,
            "status_level":        _status_level(total),
        }

        upsert("strait_metrics", [metric], on_conflict="period_start,period_end")
        _save_risk_score_today()
        finish_run(run_id, "success", total, 1)
        logger.info("summary 저장 완료 — %s 총 %d척 (탱커:%d) status:%s",
                    transit_date, total, tanker, metric["status_level"])

    except Exception as exc:
        finish_run(run_id, "failed", 0, 0)
        log_error("summary_rebuild", "unknown", str(exc), run_id)
        logger.error("summary 실패: %s", exc)
        raise


if __name__ == "__main__":
    run()
