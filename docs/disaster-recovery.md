# Disaster Recovery

## What is backed up

The `backup` service (`backup/backup.sh`, declared in `docker-compose.yml`) automatically backs up:

- **The PostgreSQL database** (`transcendence_db`): a full dump (`pg_dump`), compressed and timestamped as `transcendix_YYYYMMDD_HHMMSS.sql.gz`.
- **Uploaded files** (custom avatars, `uploads` volume): a compressed archive named `uploads_YYYYMMDD_HHMMSS.tar.gz`.

How it works:

- A first backup is taken as soon as the container starts, then at a regular interval (`BACKUP_INTERVAL_SECONDS`, 24 hours by default).
- Backups are stored in the `db_backups` Docker volume, mounted on `/backups` in the `backup` container.
- Automatic rotation: only the 7 most recent database dumps and the 7 most recent upload archives are kept; older ones are deleted.

**Not** covered by this mechanism: Vault data. It does not need a backup, because `vault-init` writes the secrets again from `.env` at every start.

## Check the available backups

The commands below target the production stack (`make up`), which is the reference. They use compose service names (`db`, `backup`, `backend`), so they work whatever the container names are. For the development stack, replace `docker compose -f docker-compose.prod.yml` with `docker compose`. Podman users can write `podman compose` instead of `docker compose`.

```bash
docker compose -f docker-compose.prod.yml exec backup ls -la /backups
```

## Restore procedure

**1. Make sure the stack is running:**
```bash
make up
```

**2. Copy the chosen dump out of the backup container:**
```bash
docker compose -f docker-compose.prod.yml exec -T backup cat /backups/transcendix_<timestamp>.sql.gz > restore.sql.gz
```

**3. Empty the current database** (⚠️ destructive, only do this when you deliberately restore over it):
```bash
docker compose -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
```

**4. Restore the dump:**
```bash
gunzip -c restore.sql.gz | docker compose -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

**5. Restore the avatars if needed:**
```bash
docker compose -f docker-compose.prod.yml exec -T backup cat /backups/uploads_<timestamp>.tar.gz \
  | docker compose -f docker-compose.prod.yml exec -T backend tar xzf - -C /app/uploads
```

**6. Check that the application works:**
```bash
curl -k https://localhost:8443/api/health
```
The response must contain `"database":{"status":"up"}`.

## Failure scenarios covered

- **Data corruption or bad migration**: restore the last healthy dump taken before the corruption (see above).
- **Loss of the `db_data` volume** (for example, accidental deletion): run `make up` to recreate the database, then restore the latest available dump.
- **Loss of the `uploads` volume**: restore the latest upload archive (step 5).
- **`backend` container failure**: `docker compose -f docker-compose.prod.yml restart backend`. No stored data is lost; only the games in progress and the chat messages, which are kept in memory, are lost.
- **Complete failure of the environment**: `make up` recreates every service; only the database and the avatars need to be restored from the latest backups if their volumes were lost.

## Known limitations

- Backups are stored in a Docker volume on the same machine as the database: if the whole machine is lost, the backups are lost too. Real fault tolerance would require exporting them to remote storage (S3, etc.), which is outside the scope of this school project.
- A restore replaces the whole `public` schema: there is no partial or selective restore.
