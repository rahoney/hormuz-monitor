"""테이블별 upsert 헬퍼. Supabase REST API의 POST + Prefer: resolution=merge-duplicates 사용."""
from typing import Any
import httpx
from db.client import get_client


def upsert(table: str, records: list[dict[str, Any]], on_conflict: str = "") -> int:
    """records를 table에 upsert하고 저장된 행 수를 반환한다."""
    if not records:
        return 0

    headers = {"Prefer": "resolution=merge-duplicates,return=minimal"}
    if on_conflict:
        headers["Prefer"] += f",on_conflict={on_conflict}"

    with get_client() as client:
        resp = client.post(f"/{table}", json=records, headers=headers)
        resp.raise_for_status()
    return len(records)


def insert(table: str, records: list[dict[str, Any]]) -> int:
    """records를 table에 단순 insert하고 저장된 행 수를 반환한다."""
    if not records:
        return 0

    with get_client() as client:
        resp = client.post(f"/{table}", json=records, headers={"Prefer": "return=minimal"})
        resp.raise_for_status()
    return len(records)
