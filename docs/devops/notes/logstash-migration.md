# **Gestion des logs - ELK (Elasticsearch, Logstash, Kibana)**

**(12/09/2026)**

## **Ce qui tourne maintenant**

Trois services dans `docker-compose.yml` :

- **Elasticsearch** (`8.15.0`) — stocke et indexe les logs, mode single-node (pas de cluster), accessible uniquement depuis les autres conteneurs (pas de port publié), **authentification obligatoire** (voir section Sécurisation plus bas)
- **Logstash** (`8.15.0`) — lit les fichiers de logs dans un volume partagé et les transmet à Elasticsearch avec un compte dédié à droits limités
- **Kibana** (`8.15.0`) — visualise les logs stockés dans Elasticsearch, accessible uniquement via le WAF sur `https://localhost:8443/kibana/`, login requis (voir section Kibana derrière le WAF plus bas)

`backend`, `frontend` et `db` écrivent leurs logs dans un volume partagé `app_logs` (au lieu du driver `gelf` de Docker, testé puis abandonné : non supporté par Podman, seule alternative — `journald` — ne fonctionnait que par accident sous Podman/Fedora et pas sous Docker Engine). `frontend`/`backend` utilisent `tee` sur leur commande de démarrage, `db` utilise le `logging_collector` natif de Postgres.

## **Fichiers ajoutés/modifiés au repo**

| Fichier | Rôle |
| --- | --- |
| `logstash/logstash.conf` | dit à Logstash quoi lire (`input file`, `/var/log/app/*.log`), quoi transformer (`filter` : champ `service`, masquage des secrets — voir section dédiée) et où envoyer (Elasticsearch, index `docker-logs-%{+YYYY.MM.dd}`) |
| `docker-compose.yml` | volume `app_logs` partagé entre `frontend`/`backend`/`db`/`logstash` ; service jetable `volumes-init` (anciennement `logs-init`) qui règle les droits des volumes partagés (`chmod 1777` sur `app_logs`, `chown 1000:0` sur `es_snapshots`) ; `db` configuré avec `log_file_mode=0644` pour que Logstash puisse lire son log |

## **Ce que Kibana affiche aujourd'hui**

Confirmé fonctionnel de bout en bout : la Data View `docker-logs-*` est active dans Kibana, et de vrais logs des trois services (`frontend`, `backend`, `db` — distinguables via le champ `log.file.path`, mélangés dans le même flux **Discover**) apparaissent correctement.

Bug rencontré et corrigé au premier test réel : Postgres écrit `db.log` en `0600` par défaut, illisible par Logstash (utilisateur différent) malgré le sticky bit du volume. Réglé en forçant `log_file_mode=0644` sur `db`.

## **Sécurisation — authentification (21/09/2026)**

Doc de référence sur ce qui est en place. Le point bloquant du sujet ("sécuriser l'accès à tous les composants") est traité : avant ce changement, `xpack.security.enabled` était à `false` sur Elasticsearch, donc n'importe qui atteignant Kibana (port `5601` publié) avait un accès total et anonyme à toutes les données de logs, sans mot de passe.

### Ce qui a changé

- **Elasticsearch** : `xpack.security.enabled: "true"` — authentification obligatoire sur toute requête. `xpack.security.http.ssl.enabled: "false"` assumé délibérément : le trafic reste en HTTP (non chiffré) mais authentifié, car il ne sort jamais du réseau Docker `private-net` déjà isolé ; le chiffrement TLS complet reste une amélioration possible mais pas prioritaire ici.
- **Comptes dédiés, principe du moindre privilège** — aucun service autre que l'admin humain n'utilise le compte superadmin `elastic` :
  - `elastic` — superadmin, usage humain (connexion Kibana, administration)
  - `kibana_system` — compte intégré fourni par Elastic, utilisé uniquement par Kibana pour parler à Elasticsearch (ne peut pas se connecter à l'UI Kibana lui-même)
  - `logstash_writer` — compte créé manuellement, rôle custom limité à l'écriture/création sur les index `docker-logs-*` (`create_index`, `write`, `manage`) + `manage_index_templates` côté cluster (nécessaire pour que Logstash installe son template `ecs-logstash` au démarrage) ; pas de droit de lecture ni d'administration
- **Secrets** : `ELASTIC_PASSWORD`, `KIBANA_PASSWORD`, `LOGSTASH_PASSWORD` ajoutés dans `.env`/`.env.example`, même pattern que `DB_PASSWORD`/`JWT_SECRET`

### Fichiers modifiés

| Fichier | Changement |
| --- | --- |
| `docker-compose.yml` (service `elasticsearch`) | `xpack.security.enabled: "true"`, `xpack.security.http.ssl.enabled: "false"`, `ELASTIC_PASSWORD: ${ELASTIC_PASSWORD}` |
| `docker-compose.yml` (service `kibana`) | ajout `environment.ELASTICSEARCH_USERNAME: kibana_system` / `ELASTICSEARCH_PASSWORD: ${KIBANA_PASSWORD}` |
| `docker-compose.yml` (service `logstash`) | ajout bloc `environment.LOGSTASH_PASSWORD: ${LOGSTASH_PASSWORD}` (pour que `${LOGSTASH_PASSWORD}` soit résolu dans `logstash.conf`) |
| `logstash/logstash.conf` | bloc `output.elasticsearch` : ajout `user => "logstash_writer"` / `password => "${LOGSTASH_PASSWORD}"` |
| `.env` / `.env.example` | ajout `ELASTIC_PASSWORD`, `KIBANA_PASSWORD`, `LOGSTASH_PASSWORD` |

**(22/09/2026) Automatisé** — un service jetable `es-init` (même principe que `vault-init`) configure `kibana_system` et `logstash_writer` à chaque `docker compose up`, avec les mots de passe définis dans `.env` (pas de génération aléatoire à copier-coller). Fichiers : `elasticsearch/init.sh` (les 3 appels API), service `es-init` dans `docker-compose.yml` (`kibana`/`logstash` en dépendent via `service_completed_successfully`). Donc même si le volume `es_data` est recréé (nouveau poste, `docker compose down -v`), un simple `docker compose up -d` suffit — plus d'étape manuelle.

### Validé

- Sans identifiants : `401` sur `http://elasticsearch:9200`
- Avec `elastic` : accès complet
- Kibana démarre (`Kibana is now available`) et se connecte à Elasticsearch via `kibana_system` sans erreur
- Logstash démarre (`Pipelines running {:count=>1}`) et écrit via `logstash_writer` sans erreur (après ajout de `manage_index_templates`, sinon `403` au moment d'installer le template `ecs-logstash`)

## **Kibana derrière le WAF, en HTTPS (10/10/2026)**

Point bloquant du sujet : avant ce changement, Kibana était publié directement sur l'hôte (`5601:5601`), en HTTP, sans passer par le WAF. N'importe qui sur le réseau pouvait atteindre la page de connexion sans chiffrement ni filtrage ModSecurity. Désormais, le seul chemin vers Kibana est `https://localhost:8443/kibana/`, comme pour le site et l'API.

### Ce qui a changé

- **Kibana servi sous `/kibana`** : Kibana ne tourne plus à la racine, ce qui permet au WAF de l'aiguiller par préfixe d'URL sans entrer en conflit avec le frontend (`/`) ni l'API (`/api/`).
- **Port `5601` retiré** : Kibana n'est plus joignable que depuis le réseau Docker `private-net`, donc uniquement via le WAF.
- **WAF** : nouvel `upstream` vers `kibana:5601` et nouvelle règle d'aiguillage `/kibana/`.
- **Deux faux positifs ModSecurity** corrigés pour `/kibana/` uniquement (détail plus bas).

### Fichiers modifiés

| Fichier | Changement |
| --- | --- |
| `docker-compose.yml` (service `kibana`) | ajout `SERVER_BASEPATH: /kibana`, `SERVER_REWRITEBASEPATH: "true"`, `SERVER_PUBLICBASEURL: https://localhost:8443/kibana` ; suppression du bloc `ports: 5601:5601` |
| `docker-compose.yml` (service `waf`) | ajout de `kibana` (`condition: service_started`) dans `depends_on` |
| `waf/default.conf.template` | ajout `upstream kibana_upstream { server kibana:5601; }` et d'un bloc `location /kibana/` dans le serveur HTTPS |
| `waf/REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf` | règle `id:1004` : retire les règles CRS `932260` et `942220` pour les URL commençant par `/kibana/` |

### Rôle des trois variables Kibana

| Variable | Rôle |
| --- | --- |
| `SERVER_BASEPATH: /kibana` | Kibana génère ses liens sous `/kibana/...` au lieu de `/...` ; sans ça, ses liens (`/app/...`) partiraient vers le frontend Next.js |
| `SERVER_REWRITEBASEPATH: "true"` | Kibana accepte les requêtes qui arrivent **avec** le préfixe `/kibana` et le retire lui-même |
| `SERVER_PUBLICBASEURL` | adresse publique complète, utilisée par Kibana pour ses redirections et liens absolus (sinon avertissement au démarrage) |

### Pièges rencontrés

- **`/` final dans `proxy_pass`** : pour `/api/`, `proxy_pass http://backend_upstream/;` (avec `/`) fait retirer `/api` par Nginx, ce que le backend attend. Pour Kibana, il faut `proxy_pass http://kibana_upstream;` **sans** `/` : Nginx garde `/kibana` dans le chemin, ce que Kibana attend avec `SERVER_REWRITEBASEPATH`. Avec un `/`, on obtient des 404 ou des boucles de redirection.
- **`depends_on` du WAF** : Nginx vérifie au démarrage que les noms des `upstream` existent ; si le conteneur `kibana` n'existe pas encore, le WAF plante. `service_started` et non `service_healthy`, car Kibana n'a pas de healthcheck dans le compose (le WAF attendrait indéfiniment).
- **Faux positifs ModSecurity** : une fois Kibana atteint, Discover restait en chargement infini avec une erreur `BfetchRequestError ... Code 403`. Les logs du WAF ont montré deux règles qui se déclenchaient sur des requêtes normales de Kibana :

  | Règle CRS | Ce qu'elle croyait voir | Ce que c'était réellement |
  | --- | --- | --- |
  | `932260` (exécution de commande Unix) | le mot `docker` | le nom de l'index `docker-logs-*` |
  | `942220` (débordement d'entier) | le nombre `2147483647` | valeur envoyée par Kibana dans ses recherches (entier maximal, pour dire « pas de limite ») |

  Les deux règles sont retirées **uniquement** pour `/kibana/` (règle `1004`) : le site et l'API restent protégés par elles, et Kibana exige une connexion. On les retire en entier plutôt que champ par champ, car le champ concerné change d'une requête à l'autre (`ARGS:pattern`, `ARGS:json.batch.array_0...`).
- **Identifiants de règles uniques** : chaque règle ModSecurity doit avoir un `id` unique. Un doublon (`1001` déjà pris par la règle des méthodes autorisées) empêche ModSecurity de charger la configuration, et le WAF entier ne démarre plus. Les exclusions maison utilisent `1000` à `1004`.

### Validé

- `http://localhost:5601` : connexion refusée (port fermé, plus de contournement du WAF)
- `https://localhost:8443/kibana/` : `302` vers la page de connexion Kibana
- `http://localhost:8080/kibana/` : `301` vers `https://localhost:8443/kibana/`
- Connexion avec `elastic` puis **Discover** sur `docker-logs-*` : champs et logs affichés, toutes les requêtes `/kibana/internal/...` en `200`, aucun blocage dans les logs du WAF

### Diagnostiquer un futur blocage du WAF sur Kibana

Le navigateur n'affiche qu'un `403`, sans la raison. La raison est dans les logs du WAF :

```
docker logs -f transcendence-waf 2>&1 | grep '"is_interrupted":true'
```

Dans chaque ligne : `"uri"` (requête bloquée), `"ruleId"` (règle en cause) et `"data"` (texte exact qui l'a déclenchée). Ignorer `949110` et `980170`, qui signalent seulement que le score total a dépassé le seuil.

## **Filtre Logstash : champ `service` et masquage des secrets (10/10/2026)**

Avant ce changement, `logstash.conf` n'avait que deux blocs (`input`, `output`) : chaque ligne de log était envoyée telle quelle à Elasticsearch, sans aucune transformation. Deux problèmes en découlaient.

### Problème 1 : des secrets lisibles dans Kibana

Une recherche `accessToken` dans les index `docker-logs-*` a remonté une vraie ligne de `frontend.log` :

```
GET /auth/callback?accessToken=eyJhbGci…&refreshToken=eyJhbGci… 200 in 263ms
```

Après une connexion Google/Discord, le backend redirige vers le frontend avec les deux tokens **dans l'URL** (`auth.controller.ts`, méthode `redirectWithTokens`). Next.js écrit cette URL dans son log, Logstash l'indexait, et le token devenait consultable par toute personne ayant accès à Kibana. Le `refreshToken` permet d'obtenir de nouveaux tokens pendant plusieurs jours : le copier suffit à usurper la session de l'utilisateur. Et la rétention garde les logs longtemps.

Une recherche `password` a remonté 56 lignes, mais uniquement des messages Postgres du type `password authentication failed for user "transcendence"`, sans mot de passe. Le masquage des mots de passe est donc une protection préventive.

### Problème 2 : pas de champ simple pour distinguer les services

Le seul moyen de savoir d'où venait une ligne était `log.file.path` (`/var/log/app/backend.log`…). Filtrer demandait `log.file.path : "*backend.log*"`, et un graphique « logs par service » était difficile à construire sur un chemin de fichier.

### Ce qui a changé

Un bloc `filter` entre `input` et `output`, qui transforme chaque ligne avant indexation. Il utilise uniquement le plugin `mutate` (« modifier la fiche d'un log »), avec trois actions :

| Action `mutate` | Effet |
| --- | --- |
| `add_field` | **ajoute** une case : `service` |
| `gsub` | **remplace** du texte dans une case : les secrets de `message` deviennent `[REDACTED]` |
| `remove_field` | **supprime** une case : `event.original` (voir piège plus bas) |

**1. Champ `service`**, déduit du fichier d'origine :

```
if [log][file][path] =~ /frontend\.log$/ {
  mutate { add_field => { "service" => "frontend" } }
} else if [log][file][path] =~ /backend\.log$/ { ... "backend" ... }
  else if [log][file][path] =~ /db\.log$/      { ... "db" ... }
```

`[log][file][path]` est la syntaxe Logstash pour le champ `log.file.path` ; `=~ /frontend\.log$/` signifie « finit par `frontend.log` » (`$` = fin, `\.` = un vrai point). Pour ajouter un futur service (ex. `game.log`), il suffit d'ajouter un `else if` sur le même modèle.

**2. Masquage des secrets** dans `message` (`gsub` : chaque ligne = champ, modèle à chercher, remplacement) :

| Ce qui est masqué | Exemple avant → après |
| --- | --- |
| `accessToken=` / `refreshToken=` dans une URL | `accessToken=eyJ…&x=1` → `accessToken=[REDACTED]&x=1` |
| en-tête `Bearer` | `Bearer eyJ…` → `Bearer [REDACTED]` |
| `password=` (URL) ou `"password":"…"` (JSON) | `"password":"abc",` → `"password":"[REDACTED]",` |

Mémo des symboles regex utilisés (expressions régulières, comprises par le moteur Ruby de Logstash, et par `grep`, Nginx, ModSecurity…) :

| Symbole | Sens |
| --- | --- |
| `[^X]+` | tout jusqu'au prochain `X` (ex. `[^&\s]+` = jusqu'au prochain `&` ou espace : la valeur entière d'un paramètre d'URL) |
| `A\|B` | A ou B |
| `?` | ce qui précède est optionnel (0 ou 1 fois) |
| `*` | 0 ou plusieurs fois |
| `\s` | un espace |
| `( )` | mémorise ce morceau |
| `\1` | réutilise le morceau mémorisé dans le remplacement (on garde `accessToken=`, on remplace seulement la valeur) |
| `\"` | un guillemet (le `\` est obligatoire pour ne pas fermer la chaîne du `.conf`) |

**3. Suppression de `event.original`** :

```
mutate { remove_field => ["[event][original]"] }
```

### Piège rencontré : la copie brute `event.original`

Premier test : `message` était bien masqué, mais les faux secrets restaient **en clair** dans un autre champ, `event.original`. Logstash 8 suit la norme de nommage **ECS** (`pipeline.ecs_compatibility: v8`, visible au démarrage), qui garde une copie exacte de la ligne reçue, **avant** tout filtre. Utile en général (revenir au texte brut, retraiter plus tard avec de nouveaux filtres, audit), mais ici elle conservait les secrets. Masquer seulement `message` ne servait donc à rien tant que la copie existait.

Choix : supprimer `event.original` plutôt que lui appliquer aussi le `gsub` (une fois masqué, il serait identique à `message`, donc inutile, et on gagne de la place).

### Piège secondaire : coloration rouge dans VS Code

VS Code ne connaît pas la syntaxe Logstash : il affiche en rouge les crochets du bloc `gsub`, parce qu'il compte aussi ceux **à l'intérieur des chaînes** (`[^&\s]`, `[:=]`, `[REDACTED]`, un `}` seul). Ce n'est pas une erreur. La seule vérification fiable est le test de configuration de Logstash :

```
docker run --rm -v "$PWD/logstash/logstash.conf:/tmp/test.conf:ro" -e LOGSTASH_PASSWORD=x docker.elastic.co/logstash/logstash:8.15.0 bin/logstash -f /tmp/test.conf --config.test_and_exit
```

`Configuration OK` = syntaxe valide. Ce test ne vérifie **pas** que les regex attrapent bien les secrets : seul un test réel le montre.

### Fichier modifié

| Fichier | Changement |
| --- | --- |
| `logstash/logstash.conf` | ajout d'un bloc `filter` (commentaire d'en-tête + champ `service` + `gsub` de masquage + `remove_field` de `event.original`) |

### Validé

1. `--config.test_and_exit` : `Configuration OK`
2. Relance : `docker compose up -d --force-recreate logstash`, puis `Pipelines running {:count=>1}` dans ses logs
3. Ligne piège avec de **faux** secrets, écrite directement dans le log du frontend :

   ```
   docker exec transcendence-frontend sh -c 'echo "TEST-FILTRE GET /auth/callback?accessToken=FAUX111&refreshToken=FAUX222 Bearer FAUX333 password=FAUX444" >> /var/log/app/frontend.log'
   ```

4. Dans Kibana (Discover, recherche `TEST-FILTRE`) : `message` = `accessToken=[REDACTED]&refreshToken=[REDACTED] Bearer [REDACTED] password=[REDACTED]`, champ `service` = `frontend`, plus de champ `event.original`

Les champs commençant par `_` (`_id`, `_index`, `_score`, `_ignored`) sont ajoutés par Elasticsearch lui-même (identifiant du document, index de rangement…) et ne contiennent rien du log.

### Limites connues

- **Le filtre ne nettoie que les nouveaux logs.** Les lignes indexées avant le 10/10/2026 contiennent encore les vrais tokens (dans `message` et `event.original`). À supprimer avant une démo (suppression des anciens index `docker-logs-*`) ou à laisser expirer avec la rétention.
- **Doublons à chaque recréation du conteneur Logstash** : sans volume pour mémoriser sa position de lecture, Logstash relit tous les fichiers depuis le début (`start_position => "beginning"`). Les copies relues passent par le filtre (propres), mais s'ajoutent aux anciennes. Voir Prochaines étapes.
- **Le vrai problème est en amont** : des tokens ne devraient pas transiter dans une URL (ils restent aussi dans l'historique du navigateur). Le filtre empêche leur stockage dans les logs (défense en profondeur), mais la redirection OAuth du backend devrait être revue (cookie `HttpOnly` ou fragment `#` non envoyé au serveur). Signalé à l'équipe backend.
- **Logs du WAF non couverts** : ModSecurity écrit l'en-tête `Authorization` complet dans son log d'audit, sur la sortie du conteneur. Ces logs ne passent pas par Logstash, donc pas par ce filtre.

## **Prochaines étapes (ELK)**

- [ ]  Tester la stack sur une machine Docker Engine réelle (idéalement macOS), pour confirmer la portabilité — validé pour l'instant uniquement sur Linux/Podman
- [ ]  **Politique de rétention/archivage des logs** (exigence du sujet) — pas encore configurée, Elasticsearch garde tout indéfiniment pour l'instant
- [x]  Filtrer/masquer les données sensibles (mots de passe, tokens) dans le pipeline Logstash avant indexation — fait le 10/10/2026 (filtre `mutate/gsub` + suppression de `event.original`), plus champ `service`
- [ ]  Supprimer les anciens index contenant encore des tokens en clair (indexés avant le filtre)
- [ ]  Volume pour la position de lecture de Logstash (`/usr/share/logstash/data`), sinon chaque recréation du conteneur réindexe tous les logs en double
- [ ]  Masquer l'en-tête `Authorization` dans le log d'audit ModSecurity du WAF (hors pipeline Logstash)
- [ ]  TLS interne complet (chiffrement, pas juste authentification) entre Elasticsearch/Kibana/Logstash — actuellement HTTP en clair sur le réseau Docker isolé
- [x]  Revoir l'exposition de Kibana (`5601:5601` publié directement sur l'hôte) — fait le 10/10/2026 : Kibana passe derrière le WAF en HTTPS sur `/kibana/`, port `5601` retiré
- [ ]  Un premier dashboard Kibana pour visualiser les logs par service / niveau d'erreur
- [ ]  Documenter ce choix d'architecture dans le `README.md` du projet (section Modules, module ELK)

## **Comprendre ELK — les bases**

### À quoi sert chaque brique

| Brique | Rôle | Analogie |
| --- | --- | --- |
| **Elasticsearch** | Stocke les logs et les indexe pour qu'ils soient cherchables rapidement | Un moteur de recherche, pas une base SQL classique |
| **Logstash** | Va chercher les logs à la source (ici, les fichiers du volume `app_logs`) et les envoie vers Elasticsearch | Un tuyau/convoyeur |
| **Kibana** | Interface web pour chercher, filtrer et visualiser ce qu'il y a dans Elasticsearch | La vitrine, ce qu'on regarde vraiment |

Sans ELK, déboguer un problème demanderait de faire `podman logs` sur chaque conteneur un par un. Avec ELK, tout est centralisé et cherchable au même endroit.

### Utiliser Kibana — Discover

Onglet **Discover** (menu ☰) : équivalent d'un `grep` avec une interface graphique, sur les données envoyées par Logstash.

- **Data View** : le "sur quels index chercher" — ici `docker-logs-*` (matche `docker-logs-2026.09.12`, etc.). À créer une fois via Stack Management → Data Views (persiste tant que le volume `es_data` n'est pas supprimé — ex: `podman compose down -v` l'efface).
- **Champ `service`** (depuis le 10/10/2026) : `frontend`, `backend` ou `db`, ajouté par le filtre Logstash — le plus simple pour filtrer (`service : backend`) et pour les graphiques par service.
- **Champ `log.file.path`** : indique quel fichier source a produit la ligne (`/var/log/app/frontend.log`, `backend.log`, `db.log`) — c'est de lui que le filtre déduit `service`, puisque l'input est de type `file` (pas de métadonnée `container_name` comme il y aurait eu avec `gelf`).
- **Champ `message`** : le contenu brut de la ligne de log.

### Syntaxe de recherche (KQL)

| Syntaxe | Effet |
| --- | --- |
| `error` | Cherche "error" dans **tous** les champs |
| `champ : "valeur"` | Cherche cette valeur dans un champ précis |
| `service : backend` | Filtre sur les logs du backend uniquement (champ ajouté par le filtre Logstash) |
| `log.file.path : "*backend.log*"` | Même chose via le chemin du fichier (le `*` est un joker) — utile pour les logs indexés avant le 10/10/2026, qui n'ont pas de champ `service` |
| `message : "error"` | Cherche "error" uniquement dans le contenu du message |
| `A and B` / `A or B` / `not A` | Combine plusieurs conditions |

Exemple combiné : `service : backend and message : "error"` → uniquement les erreurs du backend.

### Pour progresser

Le plus efficace : partir des vraies données déjà indexées plutôt que d'un tuto abstrait.
1. S'entraîner sur **Discover** avec des requêtes KQL de plus en plus précises.
2. Une fois à l'aise, construire un **Dashboard** (menu ☰ → Dashboard) : par exemple un graphe du nombre de logs par service dans le temps, ou le nombre d'erreurs par minute — c'est l'exercice le plus formateur (agrégations + visualisations).
3. Documentation officielle Elastic (section "Kibana Guide") pour aller plus loin sur une fonctionnalité précise, à jour pour la version 8.15 utilisée ici.
