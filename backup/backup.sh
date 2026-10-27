#!/bin/sh
set -e

trap 'exit 0' INT TERM

RETENTION=7
INTERVAL=${BACKUP_INTERVAL_SECONDS:-86400}

while true; do
  timestamp=$(date +%Y%m%d_%H%M%S)
  filename="/backups/transcendix_${timestamp}.sql.gz"
  echo "[backup] Dumping database to $filename"
  PGPASSWORD="$DB_PASSWORD" pg_dump -h db -U "$DB_USER" -d "$DB_NAME" | gzip > "$filename"
  echo "[backup] Done."

  ls -1t /backups/transcendix_*.sql.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

  # Archive of avatars
  tar czf "/backups/uploads_${timestamp}.tar.gz" -C /uploads .
  echo "[backup] Uploads archived."

  ls -1t /backups/uploads_*.tar.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

  sleep "$INTERVAL" &
  wait $!
done
