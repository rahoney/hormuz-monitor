"""source_runs 테이블 CRUD."""
from datetime import datetime, timezone
from typing import Any
from db.client import get_client


def start_run(source_name: str) -> int:
    """수집 시작을 기록하고 run_id를 반환한다."""
    record = {
        "source_name": source_name,
        "run_start": datetime.now(timezone.utc).isoformat(),
        "status": "running",
        "records_fetched": 0,
        "records_saved": 0,
    }
    with get_client() as client:
        resp = client.post("/source_runs", json=record, headers={"Prefer": "return=representation"})
        resp.raise_for_status()
    return resp.json()[0]["id"]


def finish_run(run_id: int, status: str, records_fetched: int, records_saved: int) -> None:
    """수집 완료 상태를 기록한다."""
    patch = {
        "run_end": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "records_fetched": records_fetched,
        "records_saved": records_saved,
    }
    with get_client() as client:
        resp = client.patch(f"/source_runs?id=eq.{run_id}", json=patch)
        resp.raise_for_status()


def has_successful_run_since(source_name: str, since: datetime) -> bool:
    """since 이후 성공한 수집 실행이 있는지 확인한다."""
    params: dict[str, Any] = {
        "select": "id",
        "source_name": f"eq.{source_name}",
        "status": "eq.success",
        "run_start": f"gte.{since.astimezone(timezone.utc).isoformat()}",
        "limit": 1,
    }
    with get_client() as client:
        resp = client.get("/source_runs", params=params)
        resp.raise_for_status()
    return bool(resp.json())
