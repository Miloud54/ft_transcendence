# Gestion du trafic public - WAF (Nginx + ModSecurity)

**(15/09/2026)**

## Mise à jour (21/10/2026) : état actuel

Cette section décrit le WAF tel qu'il fonctionne aujourd'hui. Les sections plus bas sont l'historique (septembre).

### Le WAF est le seul point d'entrée

Ports publiés sur la machine :

| Port | Service | Accès |
| --- | --- | --- |
| `8443` | WAF (HTTPS) | public : **la seule porte d'entrée** du site |
| `8080` | WAF (HTTP) | redirige vers `8443` |
| `127.0.0.1:9090` | Prometheus | local seulement (outil de dev de l'équipe monitoring) |
| `127.0.0.1:5555` | Prisma Studio | local seulement (outil de dev de l'équipe back) |

Fermés depuis le 15/10/2026 (PR #115, #118) : `3000` (frontend), `3001` (backend), `8200` (Vault), `9093` (Alertmanager). Les appels du frontend et du backend qui visaient `localhost:3001` (avatar, socket du jeu, callbacks Google/Discord, adresse des avatars) passent désormais par `https://localhost:8443`.

### Routage (bloc HTTPS de `waf/default.conf.template`)

| Chemin | Destination | Particularité |
| --- | --- | --- |
| `/` | `frontend:3000` | — |
| `/api/` | `backend:3000` | Nginx retire `/api` avant de transmettre (`proxy_pass …/;` avec `/` final) |
| `/socket.io/` | `backend:3000` | WebSocket (en-têtes `Upgrade` / `Connection`) : présence, chat des rooms, jeu |
| `/kibana/` | `kibana:5601` | adresse résolue à chaque requête, `proxy_buffering off` |
| `/grafana/` | `grafana:3000` | adresse résolue à chaque requête |

**Pourquoi Kibana et Grafana sont « résolus à chaque requête »** (`set $grafana_backend http://grafana:3000;` puis `proxy_pass $grafana_backend;`, au lieu d'un bloc `upstream`) : Nginx cherche l'adresse de **tous** les blocs `upstream` **au démarrage**, et refuse de démarrer si un nom est introuvable. Si Grafana ou Kibana n'était pas encore lancé, le WAF ne démarrait pas, et **tout le site tombait**. Avec une variable, l'adresse est cherchée à chaque requête (via le `resolver` DNS, écrit automatiquement au démarrage par l'image) : le WAF démarre toujours, et seule la page de l'outil concerné répond `502` le temps qu'il arrive. C'était aussi la cause d'un démarrage aléatoire sous podman. Le frontend et le backend gardent leur bloc `upstream` : ils sont indispensables au site, et le WAF les attend (`depends_on`).

### Méthodes HTTP autorisées : un seul endroit

OWASP CRS n'autorise par défaut que `GET HEAD POST OPTIONS`. L'API utilise aussi `PATCH`, `PUT` et `DELETE`. La liste est réglée **uniquement** par la règle `1001` (`tx.allowed_methods`) dans `REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf`.

La variable `ALLOWED_METHODS` du `docker-compose.yml` a été **supprimée** (19/10/2026) : elle indiquait une autre liste (sans `PUT` ni `DELETE`), mais la règle `1001`, chargée après, l'écrasait. Le compose affichait donc une valeur fausse. Vérifié : `DELETE` via le WAF répond `401` (la requête atteint le backend), pas `403`.

### Exceptions ModSecurity (`waf/REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf`)

Principe : ne jamais désactiver ModSecurity ; retirer **une règle**, sur **une adresse précise**, et si possible sur **un seul champ**.

| id | Portée | Règle retirée | Faux positif corrigé |
| --- | --- | --- | --- |
| `1000` | `/_next/static/` | `932130`, sur le nom de fichier seulement | les fichiers CSS de Next.js contiennent des crochets (`[root-of-the-server]`), pris pour une expression shell |
| `1001` | partout | — (fixe la liste des méthodes autorisées) | `PATCH` / `PUT` / `DELETE` de l'API refusés en `403` |
| `1002` | `/grafana/api/ds/query` | `942100` | les expressions PromQL (`sum(up)`) prises pour du SQL |
| `1003` | `/socket.io/` | `920420` | le polling de socket.io est envoyé en `text/plain` |
| `1004` | `/kibana/` | `932260`, `942220`, `932235` | « docker » dans `docker-logs-*` pris pour une commande Unix ; l'entier `2147483647` pris pour un débordement ; « time » dans `waf.request_time` (qui bloquait la sauvegarde du dashboard) |
| `1005` | `/api/auth/google/callback` | `930120`, sur `ARGS:scope` seulement | `userinfo.profile` dans le retour de connexion Google pris pour le fichier Linux `~/.profile` |

Trouver un nouveau faux positif :

```
docker logs --since 10m transcendence-waf 2>&1 | grep '"is_interrupted":true'
```

Dans chaque ligne : `"uri"` (requête bloquée), `"ruleId"` (règle en cause), `"data"` (texte qui l'a déclenchée). Ignorer `949110` et `980170` (elles signalent seulement que le score total a dépassé le seuil).

Pièges connus :
- chaque règle doit avoir un `id` **unique** : un doublon empêche ModSecurity de charger la configuration, et le WAF ne démarre plus ;
- le WAF utilise **libmodsecurity v3** : certaines actions de la v2 n'existent pas (par exemple `ctl:responseBodyAccess`), et font aussi échouer le démarrage.

### Logs du WAF

Chaque requête est écrite dans `/var/log/app/waf.log` (volume `app_logs`), au format `timed` : format `combined` de Nginx + `rt=` (temps total) et `urt=` (temps de réponse du service). Logstash l'envoie dans ELK, découpé en champs (code de réponse, URL, méthode, temps) ; détails dans `docs/devops/notes/logstash-migration.md`. Le format `combined` ne contient aucun en-tête : le token `Authorization` n'y apparaît pas (contrairement au log d'audit ModSecurity, qui reste dans la sortie du conteneur).

### Modifier le WAF sans casser le site

```
docker compose run --rm --no-deps waf nginx -t      # teste la config AVANT ; le WAF en place continue de tourner
docker compose up -d --force-recreate waf
docker compose ps                                   # waf doit être "healthy"
```

Une config invalide empêche le WAF de démarrer, et comme c'est la seule porte d'entrée, tout le site devient inaccessible.

---

## Mise à jour (30/09/2026)

Modification du fichier `waf/default.conf.template` :

**1. Redirection HTTP → HTTPS forcée**
Avant, les blocs HTTP (`${PORT}`) et HTTPS (`${SSL_PORT}`) fonctionnaient de façon indépendante — on pouvait encore naviguer en HTTP simple, non chiffré. Le bloc HTTP ne fait maintenant plus qu'une seule chose : rediriger (`301`) toute requête vers HTTPS, avant même d'atteindre le frontend ou le backend.

**2. Headers de sécurité** (bloc HTTPS)
```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
server_tokens off;
```
- `HSTS` renforce la redirection HTTPS (le navigateur ne retente plus jamais en HTTP)
- `X-Content-Type-Options` empêche le navigateur de deviner un type de fichier dangereux
- `X-Frame-Options` empêche que le site soit affiché caché dans un iframe (clickjacking)
- `server_tokens off` cache la version de Nginx dans les réponses, pour ne pas donner d'indice gratuit à un attaquant

**3. `proxy_read_timeout 3600s`** (les deux `location` du bloc HTTPS)
Prépare le terrain pour les futurs WebSockets : par défaut, Nginx coupe une connexion silencieuse au bout de 60s — trop court pour une connexion temps réel qui reste ouverte sans rien envoyer un moment. Pas utilisé aujourd'hui (aucun WebSocket dans le projet pour l'instant), mais prêt pour quand ce sera le cas.

**Testé** : redirection `301` confirmée (`curl -I http://localhost:8080`), headers de sécurité présents dans les réponses HTTPS (`curl -I -k https://localhost:8443/`), routage frontend/backend toujours fonctionnel après les changements.

---

## Ce qui tourne maintenant

Un nouveau service dans `docker-compose.yml` :

- **WAF** (`owasp/modsecurity-crs:4.25-nginx-lts`) — Nginx avec le module ModSecurity et les règles OWASP CRS embarqués, accessible sur `http://localhost` (port 80) et `https://localhost` (port 443)

Le WAF est la nouvelle porte d'entrée publique du projet. Il fait deux choses :
1. **Filtre** le trafic entrant avec ModSecurity/CRS (détecte les patterns d'attaque connus : XSS, injection SQL, etc.)
2. **Route** ensuite la requête vers le bon service selon l'URL : tout ce qui commence par `/api/` part vers `backend`, tout le reste part vers `frontend`

---

## Fichiers ajoutés au repo

| Fichier | Rôle |
| --- | --- |
| `waf/default.conf.template` | dit à Nginx comment router le trafic (frontend vs backend), en HTTP et en HTTPS |
| `docker-compose.yml` (service `waf`) | ajoute le conteneur, expose les ports 80/443, monte la config ci-dessus, connecté à `public-net` (pour être joignable de l'extérieur) et `private-net` (pour atteindre `backend`) |

---

## Ce que le WAF fait aujourd'hui

- Termine le **HTTPS** avec un certificat auto-signé, généré automatiquement par le conteneur au démarrage (normal d'avoir un avertissement navigateur en local, pas de vraie autorité derrière ce certificat)
- **Routage testé et validé** : `https://localhost/` → frontend, `https://localhost/api/health` → backend (répond `{"status":"ok",...}`, confirmé par le `HealthController` NestJS)
- ModSecurity est chargé et actif (848 règles CRS), réglé en **`MODSEC_RULE_ENGINE: "On"`** — **blocage actif**, plus en `DetectionOnly`
- **Détection + blocage testés et validés** : une injection SQL (`?id=1' OR '1'='1`) est détectée par `libinjection` (règle `942100`), atteint le seuil d'anomalie (`5`), et est bloquée avec un `403 Forbidden` avant d'atteindre le backend (`is_interrupted: true` dans les logs d'audit)
- ~~Les ports directs `frontend:3000` et `backend:3001` restent ouverts en parallèle pour l'instant (phase transitoire, le temps de tout valider) — donc le WAF n'est **pas encore** le seul point d'entrée possible~~ → fermés le 15/10/2026, voir la section du 21/10/2026 en haut

---

---

## Comprendre le WAF — les bases

### À quoi sert chaque brique

| Brique | Rôle | Analogie |
| --- | --- | --- |
| **Nginx** | Reçoit toutes les requêtes publiques et les redirige vers le bon service interne | Un(e) réceptionniste qui aiguille les visiteurs vers le bon bureau |
| **ModSecurity** | Module greffé dans Nginx qui inspecte chaque requête avant qu'elle soit routée | Le contrôle de sécurité à l'entrée, avant d'aiguiller |
| **OWASP CRS** | Le jeu de règles que ModSecurity applique pour reconnaître une attaque | La liste de "profils suspects" que le contrôle de sécurité vérifie |

Sans WAF, `frontend` et `backend` seraient exposés directement sur Internet, chacun avec son propre port, sans aucun filtrage de contenu malveillant en amont.

### Pourquoi HTTP *et* HTTPS dans le même fichier

Un bloc `server { }` = une porte d'entrée indépendante (un port). HTTP (port 80) et HTTPS (port 443) sont deux portes différentes, donc les mêmes règles de routage (`/api/` → backend, `/` → frontend) sont répétées dans les deux blocs. Seul le bloc HTTPS a en plus les lignes propres au chiffrement (`ssl_certificate`, `ssl_protocols`, etc.).

### Pourquoi `/api/` va vers le backend

C'est une convention choisie, pas une règle automatique : toute URL commençant par `/api/` est considérée comme un appel de données (JSON) et part vers `backend`, le reste (pages, JS, CSS) part vers `frontend`. Ça permet de servir les deux depuis un seul nom de domaine, sans sous-domaine séparé pour l'API.

### Piège rencontré : `On` sans guillemets dans le YAML

En YAML, les mots `on`, `off`, `yes`, `no`, `true`, `false` **sans guillemets** sont interprétés comme des booléens, pas comme du texte. Écrire `MODSEC_RULE_ENGINE: On` risque de passer un booléen au conteneur au lieu de la chaîne `"On"` que ModSecurity attend précisément — le blocage pourrait silencieusement ne pas s'activer. Toujours mettre `MODSEC_RULE_ENGINE: "On"` entre guillemets pour ce genre de valeur.

### Pour progresser

- Documentation officielle Nginx (organisée par module — `ngx_http_core_module`, `ngx_http_proxy_module`, etc.) : [nginx.org/en/docs](https://nginx.org/en/docs/)
- Guide débutant officiel : [nginx.org/en/docs/beginners_guide.html](https://nginx.org/en/docs/beginners_guide.html)
- Image utilisée ici : [github.com/coreruleset/modsecurity-crs-docker](https://github.com/coreruleset/modsecurity-crs-docker)
