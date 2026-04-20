"""source_errors 테이블 CRUD."""
from datetime import datetime, timezone
from db.upsert import insert


def log_error(
    source_name: str,
    error_type: str,
    error_message: str,
    run_id: int | None = None,
) -> None:
    """수집 오류를 기록한다. 실패해도 조용히 넘긴다."""
    record: dict = {
        "source_name": source_name,
        "error_type": error_type,
        "error_message": str(error_message)[:2000],
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    if run_id is not None:
        record["run_id"] = run_id
    try:
        insert("source_errors", [record])
    except Exception:
        pass
