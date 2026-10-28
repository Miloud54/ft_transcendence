# Préparation de l'évaluation : WAF, Vault, ELK

Fiche de révision pour l'oral. Chaque partie suit le même plan : **ce que c'est**, **comment c'est branché**, **pourquoi ce choix**, **limites**.

---

## 0. Vue d'ensemble de la stack

```
 Navigateur
    │ HTTPS 8443 (seul port public)
    ▼
 ┌──────────────┐
 │  WAF (Nginx  │  filtre (ModSecurity + OWASP CRS), écrit waf.log
 │  + ModSec)   │
 └──┬───────┬───┘
    │ /     │ /api/, /socket.io/        /kibana/      /grafana/
    ▼       ▼                            ▼             ▼
 frontend  backend ──► db (Postgres)   kibana       grafana
           │  ▲                         ▲
           │  └── secrets ── vault     │
           │                           │
 Logs : frontend/backend/db/waf ──► volume app_logs ──► logstash ──► elasticsearch ──► kibana
```

Points à retenir :
- **Une seule porte d'entrée** : le WAF, sur `8443` (HTTPS) et `8080` (redirige vers 8443).
- Les autres services n'ont **pas de port publié** : ils ne sont joignables que sur le réseau Docker interne.
- Les outils de dev (Prometheus `9090`, Prisma Studio `5555`) ne sont accessibles qu'en `127.0.0.1`.
- Ports fermés depuis le 15/10/2026 : `3000` (frontend), `3001` (backend), `8200` (Vault), `9093` (Alertmanager).

---

## 1. WAF (Nginx + ModSecurity)

### Ce que c'est
- **WAF** = *Web Application Firewall* : un filtre placé devant le site qui analyse chaque requête HTTP avant de la transmettre.
- **Nginx** : serveur web et reverse proxy (il reçoit les requêtes et les envoie au bon service).
- **ModSecurity** : moteur qui applique des règles sur les requêtes.
- **OWASP CRS** (*Core Rule Set*) : jeu de règles standard qui détecte les attaques courantes (injection SQL, XSS, etc.).

### Comment c'est branché
Routage (bloc HTTPS de `waf/default.conf.template`) :

| Chemin | Destination | Remarque |
| --- | --- | --- |
| `/` | `frontend:3000` | |
| `/api/` | `backend:3000` | Nginx retire `/api` avant de transmettre |
| `/socket.io/` | `backend:3000` | WebSocket (présence, chat, jeu) |
| `/kibana/` | `kibana:5601` | adresse résolue à chaque requête |
| `/grafana/` | `grafana:3000` | adresse résolue à chaque requête |

### Pourquoi ces choix
- **Pourquoi un WAF ?** Filtrer les attaques avant qu'elles atteignent l'application, et centraliser l'accès (HTTPS, un seul point d'entrée).
- **Pourquoi `/kibana/` et `/grafana/` sont « résolus à chaque requête » ?** Nginx refuse de démarrer si un nom `upstream` est introuvable. Avec une variable, le WAF démarre même si Grafana ou Kibana ne sont pas encore prêts ; seule la page concernée répond `502` en attendant.
- **Pourquoi `PATCH`, `PUT`, `DELETE` sont autorisés ?** Le CRS n'autorise que `GET`, `HEAD`, `POST`, `OPTIONS` par défaut. La règle `1001` fixe la liste complète, à un seul endroit.

### Exceptions ModSecurity (faux positifs)
Principe : ne jamais désactiver ModSecurity ; retirer **une règle**, sur **une adresse précise**, si possible sur **un seul champ**. Toutes dans `waf/REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf` :

| id | Portée | Ce qui était bloqué à tort |
| --- | --- | --- |
| `1000` | `/_next/static/` | crochets dans les CSS Next.js pris pour du shell |
| `1001` | partout | méthodes `PATCH`/`PUT`/`DELETE` de l'API |
| `1002` | `/grafana/api/ds/query` | PromQL (`sum(up)`) pris pour du SQL |
| `1003` | `/socket.io/` | polling socket.io envoyé en `text/plain` |
| `1004` | `/kibana/` | « docker » dans `docker-logs-*`, un entier, « time » |
| `1005` | `/api/auth/google/callback` | `userinfo.profile` pris pour `~/.profile` |

### Logs du WAF
Chaque requête est écrite dans `/var/log/app/waf.log` (format `timed` : `combined` + temps de réponse). Logstash les envoie dans ELK. Le token `Authorization` n'apparaît pas dans ces logs.

### Limites à reconnaître
- Un WAF ne remplace pas une application sécurisée : il filtre les attaques connues, il ne corrige pas un bug de logique.
- Les règles peuvent produire des faux positifs (voir tableau ci-dessus) ; certaines exceptions affaiblissent la protection sur des chemins précis.
- Le trafic WAF → services internes reste en HTTP (dans le réseau Docker isolé).

### Questions probables
- **« Pourquoi le WAF est-il le seul port public ? »** → réduire la surface d'attaque ; les services internes ne sont pas joignables depuis l'extérieur.
- **« Comment vérifier qu'il bloque ? »** → requête avec un payload classique (`' OR 1=1 --`) : `403` attendu ; voir `"is_interrupted":true` dans `docker logs transcendence-waf`.
- **« Comment modifier la config sans casser le site ? »** → `nginx -t` avant recréation : le WAF en place continue de tourner si la config est invalide.

---

## 2. Vault (gestion des secrets)

### Ce que c'est
Vault stocke les secrets (mots de passe, clés) à un seul endroit, et les services les lisent avec un token au lieu de les avoir dans leur `.env`.

### Mode dev (ce que fait le projet actuellement)

```
 .env ──► vault-init ──► Vault (mode dev)
                           secrets en RAM, token root fixe, HTTP, déjà déverrouillé
                           ▼
                   backend / grafana / alertmanager (token root)
```

- Démarrage automatique, aucune clé à saisir.
- Les secrets ne sont jamais écrits sur disque.
- Redémarrage : Vault repart vide, `vault-init` remet les secrets depuis `.env`.
- **Un seul token root partagé** : il peut tout lire.

### Mode serveur (prod, non fait)

```
 Premier lancement : vault operator init → 5 clés de déverrouillage + token root
 Chaque démarrage  : Vault SCELLÉ → vault operator unseal ×3 (intervention humaine)
 Ensuite           : chaque service a son token limité par une policy
                     backend → secret/backend ; grafana → secret/grafana
```

- Données chiffrées sur disque (stockage `file` ou `raft`).
- TLS recommandé.
- Déverrouillage manuel à chaque redémarrage.

### Différences clés

| | Dev | Serveur |
| --- | --- | --- |
| Stockage | RAM (perdu au redémarrage) | disque, chiffré |
| Démarrage | automatique, déjà ouvert | scellé, à déverrouiller |
| Accès | token root partagé | un token par service, par policy |
| TLS | non | recommandé |
| Mise en œuvre | simple | plusieurs étapes, gestion des clés |

### Pourquoi on reste en mode dev
- Le sujet exige un **lancement en une seule commande** : le déverrouillage manuel le casse.
- Coût élevé pour un projet d'école (clés, policies, tokens, adaptation de 3 scripts et du healthcheck).
- Gain réel limité tant que le backend lit toujours `.env` et que le token root est partagé.
- La décision est documentée dans `docs/devops/notes/architecture.md`, section 5.

### Limites à reconnaître
- Token root partagé : un service compromis peut lire tous les secrets.
- Secrets aussi présents dans l'environnement des conteneurs (`.env` → `docker-compose`) : un conteneur compromis peut lire ses propres variables.
- Pas de rotation automatique des secrets.

### Questions probables
- **« Où sont les secrets ? »** → `.env`, injectés dans Vault par `vault-init` au démarrage, stockés en RAM dans Vault.
- **« Pourquoi pas le mode prod ? »** → le déverrouillage manuel casse le lancement en une commande ; décision documentée.
- **« Que feriez-vous en prod ? »** → mode serveur avec stockage disque, un token par service avec une policy, secrets séparés par service (`secret/backend`, `secret/grafana`, `secret/alertmanager`), révocation du token root.
- **« Séparer les secrets par service, ça sert à quoi ? »** → si Grafana est compromis, l'attaquant n'obtient que son propre secret ; seule une policy par token rend cela effectif.

---

## 3. Stack ELK (Elasticsearch, Logstash, Kibana)

### Ce que c'est
- **Elasticsearch** : moteur de stockage et de recherche des logs (index).
- **Logstash** : lit les fichiers de logs, les transforme (champs, masquage des secrets) et les envoie à Elasticsearch.
- **Kibana** : interface web pour explorer les logs et les dashboards.

### Flux

```
 frontend / backend / db / waf
          │ écrivent dans le volume partagé app_logs (/var/log/app/*.log)
          ▼
 logstash   lit les fichiers, filtre (champ service, masquage des secrets)
          │ envoie avec le compte logstash_writer
          ▼
 elasticsearch   index docker-logs-AAAA.MM.JJ   (pas de port publié)
          ▲
          │ compte kibana_system
 kibana   (port 5601 interne, servi sous /kibana)
          ▲
          │ HTTPS 8443/kibana/ via le WAF
 navigateur (login elastic)
```

Pourquoi des fichiers et pas le driver `gelf` de Docker ? Le driver `gelf` n'est pas supporté par Podman ; on a donc choisi des fichiers dans un volume partagé, lisibles avec Docker comme avec Podman.

### Comptes et sécurité (principe du moindre privilège)

| Compte | Rôle | Qui l'utilise |
| --- | --- | --- |
| `elastic` | superadmin | humain, administration et connexion Kibana |
| `kibana_system` | compte intégré | Kibana → Elasticsearch seulement |
| `logstash_writer` | écriture sur `docker-logs-*` | Logstash seulement |

- `xpack.security.enabled: "true"` : authentification obligatoire sur toute requête.
- TLS désactivé sur Elasticsearch **assumé** : le trafic reste dans le réseau Docker `private-net`, isolé. Le chiffrement complet est une amélioration possible.
- Les mots de passe viennent de `.env` ; le service `es-init` configure les comptes à chaque `up`.
- Kibana n'est plus publié sur l'hôte : seul le WAF y mène (`https://localhost:8443/kibana/`).

### Pourquoi `es-init` existe
Il crée `kibana_system` et `logstash_writer` avec les mots de passe de `.env`. Ainsi, un `docker compose up` suffit, même après recréation du volume.

### Points de vigilance (pour ne pas être surpris)
- **Mot de passe stocké dans le volume** : `ELASTIC_PASSWORD` n'est lu qu'à la **première** création de `es_data`. Changer `.env` ensuite ne change pas le mot de passe enregistré : `es-init` et `kibana-init` tournent en boucle (`401`). Solution : changer le mot de passe via l'API, ou recréer `es_data`.
- **Incohérence à corriger** : la doc indique que `logstash_writer` a le droit `manage`, mais `elasticsearch/init.sh` ne donne que `create_index` et `write`. À vérifier avant l'oral.
- `docker compose down -v` supprime les volumes (Postgres, avatars, Elasticsearch, Grafana) : à éviter pendant la démo.

### Questions probables
- **« Pourquoi Logstash entre Docker et Elasticsearch ? »** → il sépare la lecture et la transformation des logs de leur stockage ; on peut changer l'un sans toucher à l'autre.
- **« Pourquoi des comptes différents ? »** → si Logstash est compromis, il ne peut pas lire ni administrer les données.
- **« Comment vérifier qu'Elasticsearch fonctionne ? »** → dans le conteneur : `curl -u elastic:... http://localhost:9200/_security/_authenticate` (200 attendu) ; sans mot de passe : `401`.
- **« Où voir les logs ? »** → Kibana, `https://localhost:8443/kibana/`, Data View `docker-logs-*`, Discover.

---

## 4. Points de contrôle avant l'oral

- [ ] Lancer la stack et vérifier : `docker compose ps` (tout `healthy` / `running`).
- [ ] Ouvrir `https://localhost:8443` (accepter le certificat auto-signé).
- [ ] Ouvrir `https://localhost:8443/kibana/` et montrer Discover avec `docker-logs-*`.
- [ ] Montrer un blocage WAF : requête avec payload suspect, puis `docker logs transcendence-waf | grep is_interrupted`.
- [ ] Corriger ou expliquer l'incohérence `manage` avant l'oral.
- [ ] Savoir expliquer le schéma du flux de logs de mémoire.
