# **Gestion des logs - ELK (Elasticsearch, Logstash, Kibana)**

**(12/09/2026)**

## **Ce qui tourne maintenant**

Trois services dans `docker-compose.yml` :

- **Elasticsearch** (`8.15.0`) — stocke et indexe les logs, mode single-node (pas de cluster), accessible uniquement depuis les autres conteneurs (pas de port publié), **authentification obligatoire** (voir section Sécurisation plus bas)
- **Logstash** (`8.15.0`) — lit les fichiers de logs dans un volume partagé et les transmet à Elasticsearch avec un compte dédié à droits limités
- **Kibana** (`8.15.0`) — visualise les logs stockés dans Elasticsearch, accessible sur `http://localhost:5601`, login requis

`backend`, `frontend` et `db` écrivent leurs logs dans un volume partagé `app_logs` (au lieu du driver `gelf` de Docker, testé puis abandonné : non supporté par Podman, seule alternative — `journald` — ne fonctionnait que par accident sous Podman/Fedora et pas sous Docker Engine). `frontend`/`backend` utilisent `tee` sur leur commande de démarrage, `db` utilise le `logging_collector` natif de Postgres.

## **Fichiers ajoutés/modifiés au repo**

| Fichier | Rôle |
| --- | --- |
| `logstash/logstash.conf` | dit à Logstash quoi lire (`input file`, `/var/log/app/*.log`) et où envoyer (Elasticsearch, index `docker-logs-%{+YYYY.MM.dd}`) |
| `docker-compose.yml` | volume `app_logs` partagé entre `frontend`/`backend`/`db`/`logstash` ; service jetable `logs-init` qui ouvre les droits d'écriture sur le volume (`chmod 1777`) ; `db` configuré avec `log_file_mode=0644` pour que Logstash puisse lire son log |

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

Le rôle `logstash_writer` et l'utilisateur associé ne sont **pas** définis dans un fichier du repo — ils sont créés une fois via l'API `_security` d'Elasticsearch (stockés dans l'index interne de sécurité, persistant tant que le volume `es_data` n'est pas supprimé). Si le volume est recréé, il faut relancer les deux appels API (voir historique de session ou refaire via `curl -u elastic:... -X POST http://elasticsearch:9200/_security/role/logstash_writer ...` puis `/_security/user/logstash_writer`).

### Validé

- Sans identifiants : `401` sur `http://elasticsearch:9200`
- Avec `elastic` : accès complet
- Kibana démarre (`Kibana is now available`) et se connecte à Elasticsearch via `kibana_system` sans erreur
- Logstash démarre (`Pipelines running {:count=>1}`) et écrit via `logstash_writer` sans erreur (après ajout de `manage_index_templates`, sinon `403` au moment d'installer le template `ecs-logstash`)

## **Prochaines étapes (ELK)**

- [ ]  Tester la stack sur une machine Docker Engine réelle (idéalement macOS), pour confirmer la portabilité — validé pour l'instant uniquement sur Linux/Podman
- [ ]  **Politique de rétention/archivage des logs** (exigence du sujet) — pas encore configurée, Elasticsearch garde tout indéfiniment pour l'instant
- [ ]  Filtrer/masquer les données sensibles (mots de passe, tokens) dans le pipeline Logstash avant indexation — aucun filtre en place actuellement, les logs bruts sont indexés tels quels
- [ ]  TLS interne complet (chiffrement, pas juste authentification) entre Elasticsearch/Kibana/Logstash — actuellement HTTP en clair sur le réseau Docker isolé
- [ ]  Revoir l'exposition de Kibana (`5601:5601` publié directement sur l'hôte) — à faire passer derrière le WAF ou restreindre l'accès réseau
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
- **Champ `log.file.path`** : indique quel fichier source a produit la ligne (`/var/log/app/frontend.log`, `backend.log`, `db.log`) — c'est le seul moyen de distinguer les 3 services, puisque l'input est de type `file` (pas de métadonnée `container_name` comme il y aurait eu avec `gelf`).
- **Champ `message`** : le contenu brut de la ligne de log.

### Syntaxe de recherche (KQL)

| Syntaxe | Effet |
| --- | --- |
| `error` | Cherche "error" dans **tous** les champs |
| `champ : "valeur"` | Cherche cette valeur dans un champ précis |
| `log.file.path : "*backend.log*"` | Filtre sur les logs du backend uniquement (le `*` est un joker) |
| `message : "error"` | Cherche "error" uniquement dans le contenu du message |
| `A and B` / `A or B` / `not A` | Combine plusieurs conditions |

Exemple combiné : `log.file.path : "*backend.log*" and message : "error"` → uniquement les erreurs du backend.

### Pour progresser

Le plus efficace : partir des vraies données déjà indexées plutôt que d'un tuto abstrait.
1. S'entraîner sur **Discover** avec des requêtes KQL de plus en plus précises.
2. Une fois à l'aise, construire un **Dashboard** (menu ☰ → Dashboard) : par exemple un graphe du nombre de logs par service dans le temps, ou le nombre d'erreurs par minute — c'est l'exercice le plus formateur (agrégations + visualisations).
3. Documentation officielle Elastic (section "Kibana Guide") pour aller plus loin sur une fonctionnalité précise, à jour pour la version 8.15 utilisée ici.
