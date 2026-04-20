"""공통 select 헬퍼."""
from typing import Any
from db.client import get_client


def fetch(
    table: str,
    columns: str = "*",
    filters: dict[str, str] | None = None,
    order: str | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """table에서 rows를 조회해 반환한다.

    filters 예시: {"symbol": "eq.WTI", "price_date": "gte.2024-01-01"}
    order 예시: "price_date.desc"
    """
    params: dict[str, Any] = {"select": columns}
    if filters:
        params.update(filters)
    if order:
        params["order"] = order
    if limit:
        params["limit"] = limit

    with get_client() as client:
        resp = client.get(f"/{table}", params=params)
        resp.raise_for_status()
    return resp.json()


def fetch_latest(table: str, order_col: str, columns: str = "*") -> dict[str, Any] | None:
    """table에서 order_col 기준 최신 1건을 반환한다."""
    rows = fetch(table, columns=columns, order=f"{order_col}.desc", limit=1)
    return rows[0] if rows else None
