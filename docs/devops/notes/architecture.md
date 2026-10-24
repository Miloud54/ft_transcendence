# **Architecture Docker de ft_transcendence**

**(15/10/2026, mis à jour le 24/10/2026)** — état de `docker-compose.yml` (dev) et de `docker-compose.prod.yml` (prod, fusionné dans `main` le 22/10/2026), et architecture cible.

Ce document montre trois choses : par où passent les requêtes (dev, prod, cible), dans quel ordre les conteneurs démarrent, et ce qui reste à faire pour la prod.

---

## **1. Dev : par où passent les requêtes**

Lancement : `docker compose up -d`

```
                         TOI (navigateur, sur ta machine)
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
    :8443 (HTTPS)             127.0.0.1:5555              127.0.0.1:9090
    :8080 (redirige)          Prisma Studio ⚠             Prometheus ⚠
          │                   accès direct à la base      sans passer par le WAF
          ▼
╔═ public-net ════════════════╗
║  WAF  (Nginx + ModSecurity) ║
║  FRONTEND (branché ici aussi)║
╚═════════╤═══════════════════╝
          │
╔═ private-net ═══ accès Internet : OUI (npm ci à chaque démarrage) ═════════╗
║         │                                                                 ║
║         ├─ /           ──► FRONTEND   npm run dev, code ./frontend monté   ║
║         ├─ /api        ──► BACKEND    start:dev,   code ./backend monté    ║
║         ├─ /socket.io  ──► BACKEND    (+ Prisma Studio sur :5555)          ║
║         ├─ /kibana     ──► KIBANA                                          ║
║         └─ /grafana    ──► GRAFANA                                         ║
║                                                                            ║
║   BACKEND ──► DB (Postgres) ◄── backup (1 fois par jour)                   ║
║   BACKEND ──► VAULT (mode dev, secrets en mémoire) ◄── vault-init          ║
║   GRAFANA ──► PROMETHEUS ──► ALERTMANAGER ──► Discord                      ║
║   KIBANA  ──► ELASTICSEARCH ◄── LOGSTASH ◄── fichiers de logs              ║
║                                             (front, back, db, waf)         ║
╚════════════════════════════════════════════════════════════════════════════╝
   Le frontend et le backend recompilent tout seuls à chaque fichier modifié.
```

Comment lire le schéma :
- tout ce qui passe par le **WAF** est filtré (ModSecurity) et chiffré (HTTPS) ;
- le WAF envoie chaque requête au bon service selon le début de l'adresse : `/` → frontend, `/api` et `/socket.io` → backend, `/kibana` → Kibana, `/grafana` → Grafana ;
- les deux ports `127.0.0.1` ne sont joignables **que depuis ta machine** (pas depuis le réseau), mais ils contournent le WAF : acceptable en dev, retirés en prod.

### Ports ouverts en dev

| Port | Service | Remarque |
| --- | --- | --- |
| `8443`, `8080` | WAF | l'entrée prévue (`8080` redirige vers `8443`) |
| `127.0.0.1:5555` | Prisma Studio (dans le backend) | outil de dev : voir et modifier la base à la main |
| `127.0.0.1:9090` | Prometheus | pratique pour tester les requêtes de métriques |

Les ports `3000` (frontend), `3001` (backend), `8200` (Vault) et `9093` (Alertmanager), ouverts au début du projet, ont été **fermés** (branche `fix_waf_ports`, 10/2026).

---

## **2. Prod : par où passent les requêtes**

Lancement : `docker compose -f docker-compose.prod.yml up -d --build` (détails : `docs/devops/notes/docker-compose-prod.md`)

```
                     JOUEURS / ÉVALUATEUR (navigateur)
                                    │
                     :8443 (HTTPS) · :8080 (redirige)   ◄── les SEULS ports ouverts
                                    ▼
╔═ public-net ════════════════╗
║  WAF  (Nginx + ModSecurity) ║   ◄── seul service ici
╚═════════╤═══════════════════╝
          │
╔═ private-net ═══ accès Internet : OUI pour l'instant (à couper : étape e) ═╗
║         │                                                                 ║
║         ├─ /           ──► FRONTEND   image compilée, node server.js, user node
║         ├─ /api        ──► BACKEND    image compilée, node dist/main, user node
║         ├─ /socket.io  ──► BACKEND    (plus de Prisma Studio)              ║
║         ├─ /kibana     ──► KIBANA                                          ║
║         └─ /grafana    ──► GRAFANA                                         ║
║                                                                            ║
║   BACKEND ──► DB (Postgres) ◄── backup (1 fois par jour)                   ║
║   BACKEND ──► VAULT (mode dev, secrets en mémoire) ◄── vault-init          ║
║   GRAFANA ──► PROMETHEUS ──► ALERTMANAGER ──► Discord                      ║
║   KIBANA  ──► ELASTICSEARCH ◄── LOGSTASH ◄── fichiers de logs              ║
║                                                                            ║
║   + restart: unless-stopped sur tous les services en continu               ║
╚════════════════════════════════════════════════════════════════════════════╝
   Aucun code monté depuis la machine : tout est dans les images.
```

### Ce qui change entre dev et prod

| | Dev | Prod |
| --- | --- | --- |
| Ports ouverts | WAF + `5555` (Prisma Studio) + `9090` (Prometheus) | WAF seulement |
| `public-net` | WAF + frontend | WAF seul |
| Frontend / backend | code monté depuis la machine, recompile à chaud | images compilées, figées |
| Utilisateur du backend | root | `node` |
| Redémarrage automatique | `db` seulement | tous les services en continu |

---

## **3. Ordre de démarrage**

Certains conteneurs **attendent** qu'un autre soit prêt avant de démarrer (`depends_on` dans le compose). Il y a trois sortes d'attente :

| Attente | Sens |
| --- | --- |
| « est en bonne santé » | l'autre conteneur a réussi son test de santé (`service_healthy`) |
| « est lancé » | l'autre conteneur est simplement démarré (`service_started`) |
| « a fini son travail » | l'autre est un conteneur **jetable** : il a fait sa tâche et s'est arrêté sans erreur (`service_completed_successfully`) |

### Qui démarre tout de suite (n'attend personne)

`vault`, `db`, `elasticsearch`, `frontend`, `prometheus`, `volumes-init`

### Qui attend qui

| Conteneur | Attend… | Pourquoi |
| --- | --- | --- |
| `vault-init` | que **`vault`** soit en bonne santé | il range les secrets dans Vault |
| `backend` | que **`db`** soit en bonne santé | il a besoin de la base de données |
| `backend` | que **`vault-init`** ait fini son travail | il lit ses secrets dans Vault |
| `backup` | que **`db`** soit en bonne santé | il sauvegarde la base |
| `WAF` | que **`backend`** soit en bonne santé | il transmet les requêtes `/api` au backend |
| `WAF` | que **`frontend`** soit lancé | il transmet les pages au frontend |
| `es-init` | qu'**`elasticsearch`** soit en bonne santé | il y crée les comptes et les règles de rétention |
| `logstash` | qu'**`elasticsearch`** soit en bonne santé | il y envoie les logs |
| `kibana` | qu'**`elasticsearch`** soit en bonne santé | il y lit les logs |
| `kibana-init` | que **`kibana`** soit lancé | il y importe le dashboard |
| `grafana-init` | que **`vault-init`** ait fini son travail | il lit le mot de passe de Grafana dans Vault |
| `grafana` | que **`grafana-init`** ait fini son travail, et que **`prometheus`** soit lancé | mot de passe prêt, source de métriques disponible |
| `alertmanager-init` | que **`vault-init`** ait fini son travail | il lit l'adresse du webhook Discord dans Vault |
| `alertmanager` | que **`alertmanager-init`** ait fini son travail | sa configuration est prête |

### En résumé, dans l'ordre

1. Démarrent tout de suite : `vault`, `db`, `elasticsearch`, `frontend`, `prometheus`.
2. Dès que Vault est prêt : `vault-init` range les secrets.
3. Dès que les secrets sont rangés et la base prête : `backend` démarre ; `grafana-init` et `alertmanager-init` préparent leur configuration.
4. Dès que le backend est en bonne santé : le **WAF** démarre. Le site est alors accessible.
5. En parallèle, côté logs : dès qu'Elasticsearch est prêt, `es-init`, `logstash` et `kibana` démarrent, puis `kibana-init` importe le dashboard.

**Note podman (15/10/2026)** : sous podman, un conteneur ne peut pas attendre un conteneur jetable **déjà terminé** (le démarrage bloque au hasard). Kibana, Logstash et le WAF ont été corrigés pour ne plus en dépendre. Le même risque existe encore pour `backend` (attend `vault-init`), `grafana` et `alertmanager` (attendent leur `-init`).

---

## **4. Cible (prod, après l'étape e)**

```
                                 :8443 / :8080
                                       ▼
╔═ public-net ════════╗
║  WAF                ║
╚═════════╤═══════════╝
╔═ private-net ═══ internal: true → AUCUN accès à Internet ══════════════════╗
║   frontend · backend · db · vault · elasticsearch · logstash · kibana      ║
║   prometheus · grafana · alertmanager · backup                              ║
╚═══════════════════════════════╤═════════════════════╤══════════════════════╝
╔═ egress-net ══════════════════╧═════════════════════╧══════════════════════╗
║          BACKEND                              ALERTMANAGER                  ║
║   (connexion Google/Discord, Wikipédia)       (webhook Discord)             ║
╚════════════════════════════════╤═════════════════════╤══════════════════════╝
                                 ▼                     ▼
                              Internet              Internet
```

Les trois réseaux :
- **`public-net`** : seulement le WAF, la seule porte d'entrée ;
- **`private-net`** (`internal: true`) : tous les autres services ; ils se parlent entre eux mais ne peuvent ni être joints de l'extérieur, ni sortir sur Internet ;
- **`egress-net`** : un réseau en plus, sur lequel on branche seulement les services qui **doivent** joindre Internet : le `backend` (connexion Google/Discord, Wikipédia pour Pedantix) et `alertmanager` (webhook Discord).

Intérêt : chaque service n'est branché qu'aux réseaux **dont il a besoin**. Un attaquant qui prendrait le contrôle de Logstash, par exemple, ne pourrait pas envoyer les données vers Internet.

---

## **5. Ce qui reste à faire pour la prod**

| Sujet | Dev | Prod | Qui |
| --- | --- | --- | --- |
| Ports ouverts | WAF + `5555` + `9090` (en `127.0.0.1`) | ✅ fait le 22/10/2026 : WAF seulement | DevOps |
| Réseau privé | ouvert sur Internet | `internal: true` + `egress-net` pour backend et alertmanager (étape e) | DevOps |
| Appels du front écrits en dur vers `localhost:3001` | — | ✅ plus aucun dans le code du front | équipe front |
| Frontend | `npm run dev`, code monté depuis la machine | ✅ image compilée (`Dockerfile.prod`) | DevOps |
| Backend | `npm ci` + mode dev à chaque démarrage, Prisma Studio | ✅ image compilée (`Dockerfile.prod`, 22/10/2026), sans Prisma Studio, user `node` | DevOps + équipe back |
| Fichiers compilés dans git | `prisma.config.js` supprimé ; `seed.js` et `seed.js.map` encore suivis | à supprimer de git et ajouter au `.gitignore` | équipe back |
| Vault | mode dev : secrets en mémoire, token root partagé par tous | au minimum un token en lecture seule par service ; idéalement mode serveur (secrets sur disque, déverrouillage) | DevOps (après décision d'équipe) |
| Adresses `https://localhost:8443` écrites en dur | backend, Grafana, Kibana | des variables (étape h) | équipe back + DevOps |
| WAF et Grafana | — | ✅ fait le 19/10/2026 : adresse cherchée à chaque requête, comme Kibana | DevOps |
| Redémarrage automatique | seulement `db` | ✅ fait le 22/10/2026 : tous les services en continu | DevOps |
| Tests de santé (healthcheck) | absents pour frontend, kibana, logstash, grafana, WAF | ✅ frontend et WAF ; reste Kibana, Grafana, Prometheus, Logstash, Alertmanager (option) | DevOps |
| Volumes `node_modules` anonymes | un nouveau (~500 Mo) à chaque recréation : a rempli le disque | ✅ disparus avec les images compilées | — |
| Limites de mémoire | seulement Elasticsearch (512 Mo) | une limite par service (option) | DevOps |
| Commande de lancement pour l'évaluateur | — | à écrire dans le README (ou un `Makefile`) | DevOps |

### À décider en équipe

- **Vault** : token limité par service, mode serveur, et comment le déverrouiller à chaque démarrage (fichier de clés local, ou à la main).
- **Certificat HTTPS** : auto-signé (projet d'école) ou vrai certificat si un nom de domaine existe.
