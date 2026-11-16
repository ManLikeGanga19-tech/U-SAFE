#!/usr/bin/env bash
# U-SAFE nightly backup: Postgres dump + uploaded media, kept for 14 days.
# Runs as `deploy` on the VPS. Install once:
#   chmod +x ~/usafe/infra/backup.sh
#   (crontab -l 2>/dev/null; echo "30 2 * * * ~/usafe/infra/backup.sh >> ~/usafe-backups/backup.log 2>&1") | crontab -
#
# These copies live on the SAME disk as the data — they protect against
# mistakes (bad migration, deleted product), not against losing the VPS.
# Copy ~/usafe-backups off the box regularly (e.g. rsync to your laptop).
set -euo pipefail

DEST="${BACKUP_DIR:-$HOME/usafe-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

echo "[$STAMP] database..."
docker exec usafe-prod-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$DEST/db-$STAMP.dump.tmp"
mv "$DEST/db-$STAMP.dump.tmp" "$DEST/db-$STAMP.dump"

echo "[$STAMP] media..."
docker run --rm -v usafe-prod-media:/media:ro -v "$DEST":/backup alpine:3.20 \
  tar czf "/backup/media-$STAMP.tgz" -C /media .

find "$DEST" -maxdepth 1 \( -name 'db-*.dump' -o -name 'media-*.tgz' \) -mtime +"$KEEP_DAYS" -delete
echo "[$STAMP] done: $(du -sh "$DEST" | cut -f1) in $DEST"
