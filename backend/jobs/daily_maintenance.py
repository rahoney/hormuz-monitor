"""하루 1회성 데이터 수집·정리 작업을 순차 실행한다."""
import sys
sys.path.insert(0, ".")

from jobs import data_cleanup, oil_ingest, portwatch_ingest
from utils.logger import get_logger

logger = get_logger(__name__)

_TASKS = [
    ("portwatch", portwatch_ingest.run),
    ("oil_ingest", oil_ingest.run),
    ("data_cleanup", data_cleanup.run),
]


def run() -> None:
    failures: list[str] = []
    logger.info("일일 유지보수 잡 시작")

    for name, task in _TASKS:
        try:
            logger.info("%s 실행 시작", name)
            task()
            logger.info("%s 실행 완료", name)
        except Exception as exc:
            failures.append(name)
            logger.error("%s 실행 실패: %s", name, exc)

    if failures:
        raise RuntimeError(f"일일 유지보수 일부 실패: {', '.join(failures)}")

    logger.info("일일 유지보수 잡 완료")


if __name__ == "__main__":
    run()
