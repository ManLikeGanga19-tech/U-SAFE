#!/usr/bin/env bash
# U-SAFE KE API entrypoint.
# Waits for Postgres, then (when RUN_MIGRATIONS=1) applies migrations + seed
# before handing off to the container command (uvicorn or arq worker).
set -e

echo "[entrypoint] waiting for database..."
python -m app.wait_for_db

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] applying migrations..."
  alembic upgrade head
  echo "[entrypoint] seeding baseline data..."
  python -m app.seed
fi

echo "[entrypoint] starting: $*"
exec "$@"
