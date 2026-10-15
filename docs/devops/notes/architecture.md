# **Architecture Docker de ft_transcendence**

**(15/10/2026)** — état de `docker-compose.yml` (branche `fix_waf_ports`), et architecture cible pour le compose de production.

Ce document montre trois choses : par où passent les requêtes, dans quel ordre les conteneurs démarrent, et ce qui doit changer pour la prod.

---

## **1. Aujourd'hui (dev) : par où passent les requêtes**

```
                         NAVIGATEUR
                             │
          ┌──────────────────┼─────────────────────────────┐
          │ HTTPS :8443      │  accès directs (CONTOURNENT le WAF) ✗
          ▼                  │  :3000 front · :3001 back · :5555 Prisma
   ┌─────────────┐           │  :8200 Vault · :9090 Prometheus · :9093 Alertmanager
   │     WAF     │           └──────────────────────────────────────────►
   │ Nginx + Mod │
   │  Security   │
   └──────┬──────┘
          │
   ┌──────┼───────────────┬──────────────┬───────────────┐
   │ /    │ /api          │ /kibana      │ /grafana      │
   ▼      ▼               ▼              ▼               │
FRONTEND ─► BACKEND ──► DB (Postgres)  KIBANA        GRAFANA
  (dev)      │   │           ▲            │               │
             │   └► VAULT    │ backup     ▼               ▼
             │     (secrets) │      ELASTICSEARCH     PROMETHEUS ──► ALERTMANAGER
             │               │            ▲               │            │
             ▼               │            │               └─ lit les   └─► Discord
         Internet            │         LOGSTASH              métriques
   (Google, Discord,         │            ▲                  du backend
     Wikipédia)              │            │
                             │      fichiers de logs  ◄── front, back, db, WAF
```

Comment lire le schéma :
- tout ce qui passe par le **WAF** est filtré (ModSecurity) et chiffré (HTTPS) ;
- le WAF envoie chaque requête au bon service selon le début de l'adresse : `/` → frontend, `/api` et `/socket.io` → backend, `/kibana` → Kibana, `/grafana` → Grafana ;
- les **accès directs** (ports `3000`, `3001`, `5555`, `8200`, `9090`, `9093`) permettent d'atteindre ces services **sans passer par le WAF** : c'est ce qu'il faut fermer pour la prod.

### Ports ouverts aujourd'hui

| Port | Service | Problème |
| --- | --- | --- |
| `8443`, `8080` | WAF | aucun : c'est l'entrée prévue (`8080` redirige vers `8443`) |
| `3000` | frontend | contourne le WAF |
| `3001` | backend (API) | contourne le WAF : l'API sans aucun filtrage |
| `5555` | Prisma Studio | accès direct à la base de données, **à fermer en priorité** |
| `8200` | Vault | contourne le WAF : les secrets |
| `9090` | Prometheus | contourne le WAF |
| `9093` | Alertmanager | contourne le WAF |

Elasticsearch, Logstash, Kibana, Grafana et Postgres n'ont **aucun port ouvert**.

---

## **2. Ordre de démarrage**

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

## **3. Cible (prod)**

```
                           JOUEURS
                              │
                              │ HTTPS :443   ◄── le SEUL port ouvert
                              ▼
╔═══ public-net ═══════════════════════════════════════════════╗
║                      ┌─────────────┐                         ║
║                      │     WAF     │                         ║
║                      └──────┬──────┘                         ║
╚═════════════════════════════│════════════════════════════════╝
                              │
╔═══ private-net  (internal : coupé d'Internet) ═══════════════╗
║                             │                                ║
║     FRONTEND ◄──────────────┼──────────────► BACKEND         ║
║     (version build)         │                │    │          ║
║                             │                ▼    ▼          ║
║                     KIBANA ─┤             DB    VAULT        ║
║                       │     │                 (mode serveur) ║
║                       ▼     │                                ║
║               ELASTICSEARCH │                                ║
║                       ▲     └──► GRAFANA ──► PROMETHEUS      ║
║                    LOGSTASH                       │          ║
║                                              ALERTMANAGER    ║
╚═════════════════════════════════════════│════════│═══════════╝
                                           │        │
╔═══ egress-net (seulement ces deux-là sortent sur Internet) ══╗
║                                      BACKEND  ALERTMANAGER   ║
╚══════════════════════════════════════════╪════════╪══════════╝
                                           ▼        ▼
                       Internet (Google, Discord, Wikipédia, webhook)
```

Les trois réseaux :
- **`public-net`** : seulement le WAF, la seule porte d'entrée ;
- **`private-net`** (`internal: true`) : tous les autres services ; ils se parlent entre eux mais ne peuvent ni être joints de l'extérieur, ni sortir sur Internet ;
- **`egress-net`** : un réseau en plus, sur lequel on branche seulement les services qui **doivent** joindre Internet : le `backend` (connexion Google/Discord, Wikipédia pour Pedantix) et `alertmanager` (webhook Discord).

---

## **4. Ce qui change entre dev et prod**

| Sujet | Aujourd'hui (dev) | Prod | Qui |
| --- | --- | --- | --- |
| Ports ouverts | 8 (WAF + 6 contournements) | 1 seul : `443` sur le WAF (et `80` qui redirige) | DevOps |
| Réseau privé | ouvert sur Internet | `internal: true` + `egress-net` pour backend et alertmanager | DevOps |
| Appels du front écrits en dur vers `localhost:3001` | `account-menu.tsx` (avatar), `game-socket.ts` (temps réel du jeu) | passer par `/api` et l'adresse du site | équipe front (**avant** de fermer `3001`) |
| Frontend | `npm run dev`, code monté depuis la machine | `Dockerfile.prod` (existe déjà) : version build | DevOps |
| Backend | `npm ci` + mode dev à chaque démarrage, Prisma Studio | image compilée (`Dockerfile.prod` à créer), sans Prisma Studio | DevOps + équipe back |
| Fichiers compilés dans git | `prisma.config.js`, `seed.js` (+ `.d.ts`, `.map`) font planter le backend | supprimés de git, ajoutés au `.gitignore` | équipe back |
| Vault | mode dev : secrets en mémoire, token root pour le backend | mode serveur : secrets sur disque, déverrouillage, token en lecture seule | DevOps (après décision d'équipe) |
| WAF et Grafana | le WAF cherche l'adresse de Grafana au démarrage (bloc `upstream`) | adresse cherchée à chaque requête, comme Kibana | DevOps |
| Redémarrage automatique | seulement `db` | `restart: unless-stopped` sur tous les services qui tournent en continu | DevOps |
| Tests de santé (healthcheck) | absents pour frontend, kibana, logstash, grafana, WAF | un par service qui tourne en continu | DevOps |
| Volumes `node_modules` anonymes | un nouveau (~500 Mo) à chaque recréation : a rempli le disque | disparaissent avec les images compilées | réglé par le build prod |
| Limites de mémoire | seulement Elasticsearch (512 Mo) | une limite par service | DevOps |

### À décider en équipe avant d'écrire le compose de prod

- **Vault** : comment le déverrouiller à chaque démarrage (fichier de clés local, ou à la main).
- **Certificat HTTPS** : auto-signé (projet d'école) ou vrai certificat si un nom de domaine existe.
- **Forme du fichier** : un `docker-compose.prod.yml` qui **complète** `docker-compose.yml`, ou un fichier prod complet et autonome.
