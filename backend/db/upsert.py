"""테이블별 upsert 헬퍼. Supabase REST API의 POST + Prefer: resolution=merge-duplicates 사용."""
from typing import Any
import httpx
from db.client import get_client
from utils.logger import get_logger

logger = get_logger(__name__)


def upsert(table: str, records: list[dict[str, Any]], on_conflict: str = "") -> int:
    """records를 table에 upsert하고 저장된 행 수를 반환한다."""
    if not records:
        return 0

    headers = {"Prefer": "resolution=merge-duplicates,return=minimal"}
    params = {}
    if on_conflict:
        params["on_conflict"] = on_conflict

    with get_client() as client:
        resp = client.post(f"/{table}", json=records, headers=headers, params=params)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error("Supabase upsert failed (%s): %s", table, resp.text[:1000])
            raise
    return len(records)


def insert(table: str, records: list[dict[str, Any]]) -> int:
    """records를 table에 단순 insert하고 저장된 행 수를 반환한다."""
    if not records:
        return 0

    with get_client() as client:
        resp = client.post(f"/{table}", json=records, headers={"Prefer": "return=minimal"})
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error("Supabase insert failed (%s): %s", table, resp.text[:1000])
            raise
    return len(records)


def insert_returning(table: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """records를 insert하고 DB가 생성한 id/default 값을 포함한 행을 반환한다."""
    if not records:
        return []

    with get_client() as client:
        resp = client.post(
            f"/{table}",
            json=records,
            headers={"Prefer": "return=representation"},
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError:
            logger.error("Supabase insert returning failed (%s): %s", table, resp.text[:1000])
            raise
    rows = resp.json()
    if not isinstance(rows, list):
        raise TypeError(f"Supabase insert returning expected list for {table}")
    return rows
