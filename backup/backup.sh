#!/bin/sh
set -e

RETENTION=7
INTERVAL=${BACKUP_INTERVAL_SECONDS:-86400}

while true; do
  timestamp=$(date +%Y%m%d_%H%M%S)
  filename="/backups/transcendix_${timestamp}.sql.gz"
  echo "[backup] Dumping database to $filename"
  PGPASSWORD="$DB_PASSWORD" pg_dump -h db -U "$DB_USER" -d "$DB_NAME" | gzip > "$filename"
  echo "[backup] Done."

  ls -1t /backups/transcendix_*.sql.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

  sleep "$INTERVAL"
done
