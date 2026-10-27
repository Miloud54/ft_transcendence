# Disaster Recovery

## What is backed up

The `backup` service (`backup/backup.sh`, declared in `docker-compose.yml`) automatically backs up:

- **The PostgreSQL database** (`transcendence_db`): a full dump (`pg_dump`), compressed and timestamped as `transcendix_YYYYMMDD_HHMMSS.sql.gz`.
- **Uploaded files** (custom avatars, `uploads` volume): a compressed archive named `uploads_YYYYMMDD_HHMMSS.tar.gz`.

How it works:

- A first backup is taken as soon as the container starts, then at a regular interval (`BACKUP_INTERVAL_SECONDS`, 24 hours by default).
- Backups are stored in the `db_backups` Docker volume, mounted on `/backups` in the `transcendence-backup` container.
- Automatic rotation: only the 7 most recent database dumps and the 7 most recent upload archives are kept; older ones are deleted.

**Not** covered by this mechanism: Vault data. It does not need a backup, because `vault-init` writes the secrets again from `.env` at every start.

## Check the available backups

```bash
docker exec transcendence-backup ls -la /backups
```

## Restore procedure

The container names below are those of the development stack. In production, they are prefixed with the project name (for example `transcendence-prod-db-1`): check them with `docker compose -f docker-compose.prod.yml ps`.

**1. Make sure the database is running:**
```bash
docker compose up -d db
```

**2. Copy the chosen dump out of the container** (or use it directly through the shared volume):
```bash
docker cp transcendence-backup:/backups/transcendix_<timestamp>.sql.gz ./restore.sql.gz
gunzip restore.sql.gz
```

**3. Empty the current database** (⚠️ destructive, only do this when you deliberately restore over it):
```bash
docker exec -it transcendence-db psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

**4. Restore the dump:**
```bash
cat restore.sql | docker exec -i transcendence-db psql -U "$DB_USER" -d "$DB_NAME"
```

**5. Restore the avatars if needed:**
```bash
docker cp transcendence-backup:/backups/uploads_<timestamp>.tar.gz ./uploads.tar.gz
docker cp ./uploads.tar.gz transcendence-backend:/tmp/uploads.tar.gz
docker exec transcendence-backend tar xzf /tmp/uploads.tar.gz -C /app/uploads
```

**6. Check that the application works:**
```bash
curl -k https://localhost:8443/api/health
```
The response must contain `"database":{"status":"up"}`.

## Failure scenarios covered

- **Data corruption or bad migration**: restore the last healthy dump taken before the corruption (see above).
- **Loss of the `db_data` volume** (for example, accidental deletion): recreate the `db` container (`docker compose up -d db`), then restore the latest available dump.
- **Loss of the `uploads` volume**: restore the latest upload archive (step 5).
- **`backend` container failure**: `docker compose restart backend`. No stored data is lost; only the games in progress and the chat messages, which are kept in memory, are lost.
- **Complete failure of the environment**: `docker compose up -d` recreates every service; only the database and the avatars need to be restored from the latest backups if their volumes were lost.

## Known limitations

- Backups are stored in a Docker volume on the same machine as the database: if the whole machine is lost, the backups are lost too. Real fault tolerance would require exporting them to remote storage (S3, etc.), which is outside the scope of this school project.
- A restore replaces the whole `public` schema: there is no partial or selective restore.
