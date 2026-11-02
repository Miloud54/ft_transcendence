# Fiche commandes — éval (WAF · Vault · ELK)

> Prod = `docker compose -f docker-compose.prod.yml`. Conteneurs : `transcendence-prod-<service>-1`.

## Démarrer / vérifier
```bash
make prod                                              # lancer (attendre ~3 min)
docker compose -f docker-compose.prod.yml ps           # tout healthy / running
```

---

## WAF — tout dans le navigateur
- Site normal : `https://localhost:8443/`  → **200, la page s'affiche**
- Attaque (→ **page 403**), taper l'URL dans la barre d'adresse :
  - XSS : `https://localhost:8443/?x=<script>alert(1)</script>`
  - Traversée : `https://localhost:8443/?x=../../etc/passwd`
  - SQL : `https://localhost:8443/?id=1' OR '1'='1`

Preuve que c'est le WAF (si on demande) :
```bash
docker compose -f docker-compose.prod.yml logs --tail=20 waf | grep is_interrupted   # true
```

> **403** = bloqué PAR le WAF.  **401** = a traversé le WAF, refusé par le backend (pas de token).

---

## Vault — ligne de commande
```bash
docker compose -f docker-compose.prod.yml exec vault vault status   # Sealed false, inmem
docker exec -it transcendence-prod-vault-1 sh                       # entrer dans le conteneur
  vault login "$VAULT_DEV_ROOT_TOKEN_ID"                            # token EN ARGUMENT (pas le prompt)
  vault kv list secret/                                             # liste (noms only, sans risque)
  vault kv get secret/backend                                       # valeurs (⚠ écran partagé)
  exit
```
- Token perdu ? sur l'hôte : `grep VAULT_DEV_ROOT_TOKEN_ID .env`
- Pas d'interface web : port 8200 non exposé (voulu). `vault status` sans token = OK ; lire un secret = besoin du token.

---

## ELK — surtout Kibana (clics)
Ouvrir `https://localhost:8443/kibana/` (login `elastic`). Menu ☰ en haut à gauche.

| Montrer | Chemin dans Kibana |
|---|---|
| Les logs en direct | Analytics → **Discover** → data view `docker-logs-*` (filtrer par champ `service`) |
| Le dashboard | Analytics → **Dashboard** → « Transcendence - Log » |
| Rétention 30 j | Management → Stack Management → **Index Lifecycle Policies** → `docker-logs-retention` |
| Archivage | Management → Stack Management → **Snapshot and Restore** → Policies → `daily-logs-archive` → **Run now** → onglet Snapshots → **SUCCESS** |

Vérifs en commande (optionnel) :
```bash
docker compose -f docker-compose.prod.yml exec elasticsearch \
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9200                       # 401 (sans mot de passe)

docker compose -f docker-compose.prod.yml exec elasticsearch sh -c \
  'curl -s -u "elastic:$ELASTIC_PASSWORD" "localhost:9200/_cat/health?v"'              # green
```

---

## Les 3 mots de passe (si on demande)
| .env | compte | utilisé par |
|---|---|---|
| ELASTIC_PASSWORD | `elastic` (admin) | es-init (config) + healthchecks |
| KIBANA_PASSWORD | `kibana_system` | Kibana → ES |
| LOGSTASH_PASSWORD | `logstash_writer` (écriture seule) | Logstash → ES |

## Fil conducteur (à dire)
1. **WAF** : une seule porte d'entrée qui filtre les attaques (200 vs 403).
2. **ELK** : tous les logs centralisés dans Kibana, secrets masqués par Logstash.
3. **Cycle de vie** : rétention 30 jours + archivage quotidien gardé 1 an.
4. **Vault** : secrets centralisés, lus par token ; mode dev assumé (lancement en 1 commande).
