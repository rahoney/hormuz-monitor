"""source_errors 테이블 CRUD."""
import re
from datetime import datetime, timezone
from db.upsert import insert

_MASK_PATTERNS = [
    (re.compile(r"(?i)(api[_-]?key|key|token|access_token|refresh_token)=([^&\s]+)"), r"\1=[REDACTED]"),
    (re.compile(r"(?i)(apikey|authorization)\s*:\s*bearer\s+[A-Za-z0-9._\-]+"), r"\1: Bearer [REDACTED]"),
    (re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+"), "Bearer [REDACTED]"),
]


def _mask_sensitive(value: str) -> str:
    masked = value
    for pattern, replacement in _MASK_PATTERNS:
        masked = pattern.sub(replacement, masked)
    return masked


def log_error(
    source_name: str,
    error_type: str,
    error_message: str,
    run_id: int | None = None,
) -> None:
    """수집 오류를 기록한다. 실패해도 조용히 넘긴다."""
    safe_message = _mask_sensitive(str(error_message))
    record: dict = {
        "source_name": source_name,
        "error_type": error_type,
        "error_message": safe_message[:2000],
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    if run_id is not None:
        record["run_id"] = run_id
    try:
        insert("source_errors", [record])
    except Exception:
        pass
