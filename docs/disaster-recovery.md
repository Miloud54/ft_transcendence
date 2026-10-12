# Disaster Recovery

## Ce qui est sauvegardé

La base de données PostgreSQL (`transcendence_db`) est sauvegardée automatiquement par le service `backup` (`docker-compose.yml`) :

- Un dump complet (`pg_dump`) est pris immédiatement au démarrage du conteneur, puis à intervalle régulier (`BACKUP_INTERVAL_SECONDS`, 24h par défaut).
- Chaque dump est compressé (`.sql.gz`) et horodaté : `transcendix_YYYYMMDD_HHMMSS.sql.gz`.
- Les dumps sont stockés dans le volume Docker `db_backups`, monté sur `/backups` dans le conteneur `transcendence-backup`.
- Rotation automatique : seuls les 7 derniers dumps sont conservés, les plus anciens sont supprimés.

Ce qui n'est **pas** couvert par ce mécanisme : les fichiers uploadés (`backend/uploads/`, avatars perso) et les données Vault (secrets re-générés à chaque démarrage via `vault-init`, pas besoin de backup).

## Vérifier les backups disponibles

```bash
docker exec transcendence-backup ls -la /backups
```

## Procédure de restauration

**1. S'assurer que la base de données tourne :**
```bash
docker compose up -d db
```

**2. Copier le dump souhaité hors du conteneur** (ou l'utiliser directement via le volume partagé) :
```bash
docker cp transcendence-backup:/backups/transcendix_<timestamp>.sql.gz ./restore.sql.gz
gunzip restore.sql.gz
```

**3. Vider la base actuelle** (⚠️ destructif, à faire uniquement si on restaure volontairement par-dessus) :
```bash
docker exec -it transcendence-db psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

**4. Restaurer le dump :**
```bash
cat restore.sql | docker exec -i transcendence-db psql -U "$DB_USER" -d "$DB_NAME"
```

**5. Vérifier que l'application fonctionne :**
```bash
curl http://localhost:3001/health
```
La réponse doit indiquer `"database":{"status":"up"}`.

## Scénarios de panne couverts

| Scénario | Procédure |
|---|---|
| Corruption de données / mauvaise migration | Restaurer le dernier dump sain (voir ci-dessus) avant la corruption |
| Perte du volume `db_data` (ex: suppression accidentelle) | Recréer le conteneur `db` (`docker compose up -d db`), puis restaurer le dernier dump disponible |
| Panne du conteneur `backend` | `docker compose restart backend` — aucune perte de données, le backend est sans état (stateless) |
| Panne complète de l'environnement | `docker compose up -d` recrée tous les services ; seule la base de données doit être restaurée depuis le dernier dump si le volume `db_data` a été perdu |

## Limites connues

- Les backups sont stockés localement dans un volume Docker sur la même machine que la base — en cas de perte totale de la machine, les backups sont perdus aussi. Pour une vraie tolérance aux pannes, il faudrait exporter les dumps vers un stockage distant (S3, etc.), hors du périmètre de ce projet scolaire.
- La restauration remplace l'intégralité du schéma `public` — il n'y a pas de restauration partielle/sélective.
