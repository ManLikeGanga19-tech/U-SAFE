"""Block until Postgres accepts connections (used by the entrypoint)."""
from __future__ import annotations

import sys
import time

from sqlalchemy import text

from app.core.database import engine


def main(retries: int = 30, delay: float = 2.0) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[wait_for_db] database ready (attempt {attempt})")
            return
        except Exception as exc:  # noqa: BLE001
            print(f"[wait_for_db] not ready ({attempt}/{retries}): {exc}")
            time.sleep(delay)
    print("[wait_for_db] database never became ready", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
