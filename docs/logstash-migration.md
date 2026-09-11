# Logstash / ELK — passage de GELF à un volume partagé

## Contexte

Le module ELK (Devops, sujet ft_transcendence) demande Elasticsearch + Logstash + Kibana pour centraliser les logs. La config initiale utilisait le driver de logs `gelf` (`logging: driver: gelf` sur `frontend`/`backend`/`db`), qui envoie les logs directement à Logstash via UDP.

**Problème :** `gelf` est une fonctionnalité propre à Docker Engine. Podman ne le supporte pas du tout (`invalid log driver: invalid argument`) — aucune configuration ne peut le faire fonctionner sous Podman.

## Tentatives

1. **`gelf` (driver de logs)** — abandonné : non supporté par Podman, point bloquant.
2. **`journald` (plugin Logstash `logstash-input-journald`)** — a fonctionné sur Fedora/Podman, mais **abandonné aussi** : ne fonctionne que parce que Podman écrit ses logs dans journald par défaut. Docker Engine (config par défaut) écrit en `json-file`, pas journald — donc ça n'aurait pas marché chez un coéquipier sous Docker Engine, ni sur Mac/Windows. Contraire à l'objectif "ça doit marcher partout avec juste `docker compose up`".
3. **Volume partagé + fichiers de logs (solution actuelle)** — 100% portable Docker Engine / Podman / n'importe quel OS, car tout est défini dans `docker-compose.yml` (aucune dépendance au moteur de conteneurs ou à l'hôte).

## Principe de la solution actuelle

Un volume nommé `app_logs`, partagé entre `frontend`, `backend`, `db` et `logstash`. Chaque service écrit ses logs dans un fichier à l'intérieur de ce volume ; Logstash les lit avec son plugin `file` (natif, pas de plugin externe requis).

```
frontend  --tee-->  app_logs/frontend.log  --\
backend   --tee-->  app_logs/backend.log   ---+--> logstash (input file) --> elasticsearch --> kibana
db        --pg cfg->  app_logs/db.log      --/
```

## Ce qui a été fait (état actuel des fichiers)

**`docker-compose.yml`**
- `frontend` : `command: sh -c "npm run dev 2>&1 | tee /var/log/app/frontend.log"` + volume `app_logs:/var/log/app`
- `backend` : idem avec `npm run start:dev` → `backend.log`
- `db` : `command:` passe `-c logging_collector=on -c log_directory=/var/log/app -c log_filename=db.log` à postgres + volume `app_logs:/var/log/app` (⚠️ **sans** `:ro`, postgres doit pouvoir écrire)
- `logstash` : revenu à `image:` simple (plus besoin du plugin journald/Dockerfile custom) + volume `app_logs:/var/log/app:ro` (lecture seule, il ne fait que lire)
- `logs-init` : nouveau service jetable (s'exécute une fois puis s'arrête) qui fait `chmod 1777 /var/log/app` — nécessaire car `db` tourne avec un utilisateur non-root (`postgres`) qui n'a pas le droit d'écrire dans le volume par défaut (créé root:root). Le sticky bit (`1777` au lieu de `777`) limite le risque : tout le monde peut créer des fichiers, mais seul le propriétaire d'un fichier peut le supprimer/renommer.
- `logstash/Dockerfile` : supprimé (n'était utile que pour l'approche journald abandonnée).

**`logstash/logstash.conf`**
```
input {
  file {
    path           => "/var/log/app/*.log"
    start_position => "beginning"
  }
}

output {
  elasticsearch {
    hosts => ["http://elasticsearch:9200"]
    index => "docker-logs-%{+YYYY.MM.dd}"
  }
}
```

## Décision prise : pas d'isolation complète par service

On a envisagé d'isoler chaque service dans son propre sous-dossier du volume (via `subpath:` de Compose) pour empêcher un service compromis de lire/altérer les logs d'un autre. **Décision : ne pas le faire.** Le module ELK du sujet ne demande pas ce niveau de granularité ("secure access to all components" vise plutôt l'auth sur Kibana/Elasticsearch), et `subpath:` est une fonctionnalité Compose récente dont le support par `podman-compose` n'est pas garanti. Le sticky bit (`1777`) est jugé suffisant et proportionné.

## ⚠️ Ce qu'il reste à faire

1. **Corriger une erreur de placement dans `db:`** — `restart: on-failure` a été accidentellement collé sous `depends_on:` au lieu d'être une clé indépendante. À corriger :
   ```yaml
     db:
       image: docker.io/library/postgres:18-alpine
       container_name: transcendence-db
       restart: on-failure       # <-- doit être ici, seul, pas sous depends_on
       environment:
         ...
   ```
   (Il ne doit plus y avoir de `depends_on:` du tout sur `db` — voir point suivant pour le pourquoi.)

2. **Pourquoi `restart: on-failure` et pas `depends_on: logs-init: condition: service_completed_successfully`** : cette syntaxe Compose standard aurait dû garantir que `logs-init` termine avant que `db` démarre, mais **`podman-compose` ne la supporte pas correctement** sur cette machine (erreur : `no container with ID or name "ft_transcendence_logs-init_1" found`). À la place, `db` redémarre automatiquement s'il crashe (le temps que `logs-init` finisse son `chmod`, qui prend une fraction de seconde).

3. **Tester la stack complète** une fois le point 1 corrigé :
   ```
   podman compose up --build
   podman ps -a --filter name=transcendence   # vérifier que db ne reste pas en "Exited"
   podman logs transcendence-db               # vérifier l'absence d'erreur "Permission denied"
   ```

4. **Vérifier que les logs arrivent dans Elasticsearch/Kibana** :
   ```
   podman exec transcendence-logstash curl -s "http://elasticsearch:9200/_cat/indices/docker-logs-*?v"
   ```
   Puis dans Kibana (`localhost:5601`), créer/consulter un index pattern `docker-logs-*` et vérifier que des entrées de `frontend`/`backend`/`db` apparaissent.

5. **Pour le README du projet** (section Modules, module ELK) : documenter ce choix d'architecture (volume partagé + sticky bit) et la justification du "pourquoi pas gelf/journald" — utile pour l'évaluation, ça montre une vraie compréhension du problème de portabilité Docker Engine / Podman.
