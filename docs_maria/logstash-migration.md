# **Gestion des logs - ELK (Elasticsearch, Logstash, Kibana)**

**(12/09/2026)**

## **Ce qui tourne maintenant**

Trois services dans `docker-compose.yml` :

- **Elasticsearch** (`8.15.0`) — stocke et indexe les logs, mode single-node (pas de cluster), accessible uniquement depuis les autres conteneurs (pas de port publié)
- **Logstash** (`8.15.0`) — lit les fichiers de logs dans un volume partagé et les transmet à Elasticsearch
- **Kibana** (`8.15.0`) — visualise les logs stockés dans Elasticsearch, accessible sur `http://localhost:5601`

`backend`, `frontend` et `db` écrivent leurs logs dans un volume partagé `app_logs` (au lieu du driver `gelf` de Docker, testé puis abandonné : non supporté par Podman, seule alternative — `journald` — ne fonctionnait que par accident sous Podman/Fedora et pas sous Docker Engine). `frontend`/`backend` utilisent `tee` sur leur commande de démarrage, `db` utilise le `logging_collector` natif de Postgres.

## **Fichiers ajoutés/modifiés au repo**

| Fichier | Rôle |
| --- | --- |
| `logstash/logstash.conf` | dit à Logstash quoi lire (`input file`, `/var/log/app/*.log`) et où envoyer (Elasticsearch, index `docker-logs-%{+YYYY.MM.dd}`) |
| `docker-compose.yml` | volume `app_logs` partagé entre `frontend`/`backend`/`db`/`logstash` ; service jetable `logs-init` qui ouvre les droits d'écriture sur le volume (`chmod 1777`) ; `db` configuré avec `log_file_mode=0644` pour que Logstash puisse lire son log |

## **Ce que Kibana affiche aujourd'hui**

Confirmé fonctionnel de bout en bout : la Data View `docker-logs-*` est active dans Kibana, et de vrais logs des trois services (`frontend`, `backend`, `db` — distinguables via le champ `log.file.path`, mélangés dans le même flux **Discover**) apparaissent correctement.

Bug rencontré et corrigé au premier test réel : Postgres écrit `db.log` en `0600` par défaut, illisible par Logstash (utilisateur différent) malgré le sticky bit du volume. Réglé en forçant `log_file_mode=0644` sur `db`.

## **Prochaines étapes (ELK)**

- [ ]  Tester la stack sur une machine Docker Engine réelle (idéalement macOS), pour confirmer la portabilité — validé pour l'instant uniquement sur Linux/Podman
- [ ]  **Politique de rétention/archivage des logs** (exigence du sujet) — pas encore configurée, Elasticsearch garde tout indéfiniment pour l'instant
- [ ]  **Sécuriser l'accès à tous les composants** (exigence du sujet) — `xpack.security.enabled` est actuellement à `false` sur Elasticsearch, aucune authentification en place sur Elasticsearch/Kibana
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
