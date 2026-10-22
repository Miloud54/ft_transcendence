# **Docker Compose de production**

**(21/10/2026)** — branche `dockercompose_prod`, travail en cours

Ce document suit le passage de `docker-compose.yml` (développement) à `docker-compose.prod.yml` (production) : les choix, les changements service par service, et comment tester. Vue d'ensemble de l'architecture cible : `docs/devops/notes/architecture.md`.

---

## **1. Le choix : un fichier de prod complet et autonome**

`docker-compose.prod.yml` est une **copie complète** de `docker-compose.yml`, modifiée service par service. On le lance **seul** :

```
docker compose -f docker-compose.prod.yml up -d --build
```

### Pourquoi pas un fichier qui « complète » celui de dev

Docker Compose sait combiner deux fichiers (`-f docker-compose.yml -f docker-compose.prod.yml`), mais en les **fusionnant** : il peut **ajouter ou remplacer** un réglage, pas en **retirer**. Or la prod consiste surtout à **retirer** ce qui est propre au dev : le code monté depuis la machine, le `npm ci` à chaque démarrage, les volumes `node_modules`, les ports de debug.

Docker Compose récent propose des balises pour retirer un réglage (`!reset`, `!override`), mais **`podman-compose` les gère mal**. Les postes de l'école utilisent podman (la commande `docker compose` y appelle en réalité `podman-compose`), et l'évaluation se fera très probablement sur un de ces postes.

| | Fichier qui complète | Fichier autonome (choisi) |
| --- | --- | --- |
| Compatible podman | non fiable (`!reset`) | oui |
| Lisibilité | il faut combiner deux fichiers mentalement | on lit exactement ce qui tourne |
| Maintenance | une seule source pour le commun | le commun est dupliqué : reporter les changements dans les deux fichiers |

---

## **2. Plan de travail**

Une étape = un test. On ne lance la stack de prod complète (`up`) qu'une fois le backend prêt.

| # | Étape | État |
| --- | --- | --- |
| a | Copier `docker-compose.yml` en `docker-compose.prod.yml` | ✅ fait |
| b | **Frontend** en version build (`Dockerfile.prod`) | ✅ fait le 21/10/2026 (image de 1,91 Go → 216 Mo) |
| c | **Backend** : `backend/Dockerfile.prod` (compilation, migrations au démarrage, `NODE_ENV=production`) | 🟡 Dockerfile écrit et testé (22/10/2026) ; bloc du compose à adapter ; relecture équipe back (voir section 4) |
| d | `restart: unless-stopped` et healthcheck sur tous les services qui tournent en continu | à faire |
| e | **Réseaux** : `private-net` en `internal: true` + `egress-net` pour le backend et Alertmanager | à faire, à tester avec soin |
| f | **Vault** en mode serveur (stockage sur disque, déverrouillage, token en lecture seule pour le backend) | après décision d'équipe |
| g | Ports : seul le WAF publié ; retirer `127.0.0.1:5555` (Prisma Studio) et `127.0.0.1:9090` (Prometheus) | à faire |
| h | Adresses écrites en dur (`https://localhost:8443` dans les callbacks OAuth et les avatars) → variables | à faire, avec l'équipe back |

---

## **3. Frontend**

### Bloc cible

```yaml
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod      # version build de Next.js (et non le mode dev)
    image: transcendence-frontend:prod  # nom distinct de l'image de dev (sinon elles s'ecrasent)

    container_name: transcendence-frontend

    restart: unless-stopped            # redemarre tout seul s'il plante

    # le site compile est dans l'image : on garde seulement l'ecriture des logs pour ELK
    command: sh -c "node server.js 2>&1 | tee /var/log/app/frontend.log"

    volumes:
      - app_logs:/var/log/app

    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

    networks:
      - private-net
```

### Changements par rapport au dev

| Dev | Prod | Pourquoi |
| --- | --- | --- |
| `build: context: ./frontend` | + `dockerfile: Dockerfile.prod` | le Dockerfile de prod **compile** le site une seule fois, dans l'image (`npm run build`), et ne garde que le résultat dans une image légère |
| `user: "0:0"` | supprimé | en dev, il forçait `root` (pour les postes de l'école) ; `Dockerfile.prod` lance déjà en utilisateur `node` (non-root), ce qui est plus sûr |
| `working_dir: /app` | supprimé | déjà défini dans `Dockerfile.prod` |
| `command: npm ci && npm run dev …` | `node server.js 2>&1 \| tee …` | plus d'installation ni de mode dev à chaque démarrage : on lance directement le site compilé (`server.js`, produit par `output: "standalone"` dans `next.config.ts`). Le `tee` garde l'écriture dans `frontend.log`, pour qu'ELK continue de recevoir les logs du frontend |
| `./frontend:/app:Z` et `/app/node_modules` | supprimés | le code est **dans l'image** : on ne le monte plus depuis la machine. Ça supprime aussi les volumes `node_modules` anonymes (~500 Mo à chaque recréation), cause du disque plein des 13/10 et 21/10 |
| `stdin_open`, `tty`, `init` | supprimés | utiles pour un terminal en dev, inutiles en prod |
| — | `restart: unless-stopped` | si le frontend plante, Docker le relance |
| — | `healthcheck` | Docker vérifie toutes les 10 s que le site répond ; le WAF pourra attendre un frontend réellement prêt (`wget` est disponible dans l'image `node:alpine`) |
| `networks: public-net` | `private-net` | seul le WAF doit être sur le réseau public ; le frontend n'a besoin que du WAF, qui est aussi sur `private-net` |

### La commande de lancement

```
sh -c "node server.js 2>&1 | tee /var/log/app/frontend.log"
```

| Morceau | Sens |
| --- | --- |
| `node server.js` | lance le site compilé ; `server.js` est produit par `npm run build` grâce à `output: "standalone"` (l'équivalent prod de `npm run dev`, sans compilation à la volée) |
| `2>&1` | un programme écrit dans deux sorties : messages normaux (n°1) et erreurs (n°2). On envoie aussi les erreurs vers la sortie normale, sinon elles n'arriveraient pas dans le fichier de log |
| `\|` | « pipe » : branche la sortie de la commande de gauche sur l'entrée de celle de droite |
| `tee /var/log/app/frontend.log` | fait deux copies : une à l'écran (`docker logs transcendence-frontend`), une dans le fichier lu par Logstash (ELK) |
| `sh -c "…"` | fait interpréter la ligne par le shell ; `\|` et `2>&1` sont des fonctions du shell, sans lui Docker chercherait un programme nommé littéralement `node server.js 2>&1 \| tee…` |

### Pourquoi un healthcheck en prod (et pas en dev)

En dev, personne n'attendait le frontend « en bonne santé » (le WAF attend seulement qu'il soit **lancé**), et le démarrage est lent (`npm ci`, puis compilation de chaque page à la première visite) : un healthcheck aurait souvent signalé un faux problème. En prod, le démarrage est rapide et fiable (`server.js` répond en quelques secondes) : le healthcheck indique si le site **répond réellement** (`healthy` / `unhealthy` dans `docker compose ps`), et permet au WAF d'attendre un frontend prêt (`condition: service_healthy`).

Limite : un healthcheck **constate** l'état, il ne **répare** pas. Docker Compose ne redémarre pas un conteneur `unhealthy` ; `restart: unless-stopped` ne relance que si le conteneur **s'arrête** (plantage).

### Pas de `user: "0:0"` en prod (et les postes de l'école)

En dev, le compose force `root` sur les postes de l'école : podman y tourne sans droits administrateur (*rootless*), les identités sont décalées, et l'utilisateur `node` du conteneur ne peut pas écrire dans le code **monté depuis la machine** (`./frontend:/app`). En prod, il n'y a plus de code monté : `node` n'écrit que dans le volume `app_logs` (rendu accessible par `volumes-init`) et éventuellement dans le cache d'images de Next.js (un échec y produit seulement un avertissement). Le frontend de prod tourne donc en `node`, ce qui est plus sûr.

⚠️ **À tester sur un poste de l'école** (podman) dès que possible : `build`, puis `up -d frontend`, puis vérifier dans `docker logs transcendence-frontend` l'absence d'erreur `EACCES` / `permission denied`. Remettre `user: "0:0"` ne serait qu'un dernier recours, à documenter comme compromis.

### `Dockerfile.prod` du frontend (existant)

Construction en 3 étapes (*multi-stage*) : `deps` installe les dépendances, `builder` compile le site, `runner` ne garde que le résultat (`.next/standalone`, `.next/static`, `public`). Les outils lourds (npm, code source) ne sont pas dans l'image finale. Lancement en `USER node`, `HOSTNAME=0.0.0.0` pour que le WAF puisse joindre le serveur.

### Pourquoi l'image de dev fait 1,91 Go et celle de prod 216 Mo

Les deux Dockerfiles n'ont pas le même but : celui de dev est un **atelier** (tous les outils, pour modifier le code), celui de prod le **produit fini** (seulement ce qu'il faut pour faire tourner le site).

| | Dev (`frontend/Dockerfile`) | Prod (`frontend/Dockerfile.prod`) |
| --- | --- | --- |
| Image de base | `node:24.18.0` : Linux complet (Debian) avec compilateurs, `git`, `curl`… (~1 Go à elle seule) | `node:24.18.0-alpine` : Linux minimal fait pour les conteneurs (~150 Mo) |
| Dépendances | `npm ci` installe **tout**, y compris les outils de développement (TypeScript, ESLint, compilateur à la volée de Next.js) | `output: "standalone"` ne garde que les morceaux de dépendances **réellement utilisés** par le site |
| Code | code source gardé et compilé **à chaque visite** (`npm run dev`) | compilé **une seule fois** au build (`npm run build`), seul le résultat est gardé (`server.js`, fichiers statiques) |
| Étapes | une seule : tout reste dans l'image | trois (*multi-stage*) : `deps` et `builder` font le travail lourd avec tous les outils, seule `runner` devient l'image finale et n'y copie que le résultat |
| Code modifiable en direct | oui (monté depuis la machine, rechargement automatique) | non : toute modification demande de reconstruire l'image |
| Utilisateur | `node` dans le Dockerfile, mais `root` imposé par le compose sur les postes de l'école | `node` |
| Taille | 1,91 Go | 216 Mo |

Image comme un chantier : les étapes `deps` et `builder` sont les grues et échafaudages, l'étape `runner` est la maison livrée ; le Dockerfile de dev livre la maison avec tout le chantier autour.

**Pourquoi garder les deux** : en dev, on modifie le code en permanence ; avec le Dockerfile de dev, le site se recompile tout seul en une seconde. Avec celui de prod, il faudrait reconstruire l'image (plusieurs minutes) à chaque changement.

**Intérêt sécurité** : moins il y a d'outils dans l'image, moins un attaquant qui y entrerait aurait de quoi agir (pas de compilateur, pas de `git`, pas de code source). Une image minimale réduit la **surface d'attaque**, en plus de la taille.

### Points d'attention

- **Logs moins bavards** : en prod, Next.js ne logge plus chaque page visitée (contrairement au mode dev) ; il logge le démarrage et les erreurs. L'activité du site reste visible dans ELK via les logs du WAF (`service : waf`).
- **Droits sur `frontend.log`** : le frontend tourne maintenant en utilisateur `node`. Sur une installation neuve, pas de problème (`volumes-init` rend `app_logs` accessible en écriture). Sur une machine qui a déjà fait tourner la version dev, `frontend.log` existe et appartient à `root` : le `tee` ne pourra pas y écrire. Solution : supprimer le volume `app_logs`, ou l'ancien fichier.
- **Nom d'image distinct obligatoire** : sans `image:`, Docker nomme l'image d'après le dossier du projet et le service (`ft_transcendence-frontend:latest`), **le même nom en dev et en prod**. Construire la prod écrase alors l'image de dev, et le frontend de dev plante au prochain redémarrage (il lance `npm ci && npm run dev` dans une image qui ne contient plus le code source). D'où `image: transcendence-frontend:prod`. Si c'est déjà arrivé : `docker compose build frontend` reconstruit l'image de dev. Faire de même pour le backend (`transcendence-backend:prod`).
- **Build plus strict** : `npm run build` vérifie le TypeScript et le lint, ce que le mode dev ne fait pas. Un build qui échoue révèle des erreurs qui existaient déjà dans le code.

### État au 21/10/2026

✅ Frontend de prod terminé : `docker compose -f docker-compose.prod.yml build frontend` réussi, image de **216 Mo** (contre 1,91 Go en dev).

Reste :
- [ ] test sur un poste de l'école (podman), voir plus haut
- [ ] le WAF de prod pourra attendre le frontend avec `condition: service_healthy` (au lieu de `service_started`)

---

## **4. Backend**

### Ce qu'il faut savoir avant de construire l'image

Pour écrire un Dockerfile de prod, pas besoin de savoir comment le code fonctionne à l'intérieur : il faut savoir **de quoi l'application a besoin**. Quatre questions, et où trouver la réponse :

| Question | Réponse pour le backend | Où la trouver |
| --- | --- | --- |
| Comment le construire ? | `npm ci`, puis `prisma generate`, puis `npm run build` | scripts de `backend/package.json` (`"build": "nest build"`) |
| Comment le lancer ? | `node dist/main` | `backend/package.json` (`"start:prod": "node dist/main"`) |
| De quels fichiers a-t-il besoin pour tourner ? | `dist/`, `node_modules/`, `generated/`, `prisma/`, `data/`, `curated-articles.json`, et un dossier `uploads/` où écrire | lectures de fichiers dans le code (`readFile`, `uploads`), sortie de Prisma (`output` dans `prisma/schema.prisma`) |
| De quoi a-t-il besoin autour de lui ? | Postgres (`DATABASE_URL`), Vault (ses secrets), la bibliothèque `openssl` | variables du compose de dev, documentation de Prisma |

Ce qui ne se devine pas, les **erreurs de build** l'apprennent (méthode : construire, lancer, lire l'erreur, corriger). Ce que seule l'équipe back sait (seed en prod, autres fichiers lus à l'exécution) se demande : le Dockerfile du backend est à faire **relire** par l'équipe back.

**Prisma, le minimum pour Docker** : c'est l'outil qui fait parler le backend à Postgres.
- `prisma/schema.prisma` décrit les tables ;
- `prisma generate` fabrique, à partir du schéma, le code utilisé par le backend pour interroger la base (dossier `generated/prisma`) : à faire **avant** de compiler ;
- `prisma/migrations/` contient les modifications successives de la structure de la base ; `prisma migrate deploy` les applique au démarrage (ne fait rien si la base est à jour).

### `backend/Dockerfile.prod`

```dockerfile
# ---------- Stage 1: install dependencies and compile ----------
FROM node:24.18.0-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate && npm run build

# ---------- Stage 2: final image ----------
FROM node:24.18.0-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/generated ./generated
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./
COPY --from=builder --chown=node:node /app/data ./data
COPY --from=builder --chown=node:node /app/src/pedantix-engine/article/curated/curated-articles.json ./src/pedantix-engine/article/curated/curated-articles.json
RUN mkdir -p uploads/avatars && chown -R node:node /app/uploads
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

(Le fichier du dépôt contient en plus des commentaires en anglais.)

### Chaque ligne

**Étape 1, `builder`** (installer et compiler, avec tous les outils)

| Ligne | Rôle |
| --- | --- |
| `FROM node:24.18.0-slim AS builder` | point de départ : Debian allégé + Node.js 24.18.0 ; `AS builder` nomme l'étape pour y reprendre des fichiers plus tard (`--from=builder`) |
| `RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*` | installe `openssl` (nécessaire à Prisma). `apt-get update` télécharge la liste des logiciels, `-y` répond « oui » automatiquement, `--no-install-recommends` évite les paquets « bonus », `rm -rf …` supprime la liste téléchargée. Tout sur **un seul `RUN`** : chaque `RUN` crée une couche qui garde tout, une suppression dans un `RUN` séparé ne ferait pas maigrir l'image |
| `WORKDIR /app` | dossier de travail dans l'image ; `./` désigne ensuite `/app` |
| `COPY package*.json ./` | copie **seulement** `package.json` et `package-lock.json` (de `backend/` sur la machine vers `/app/` dans l'image). Astuce de cache : tant que la liste des dépendances ne change pas, Docker réutilise le `npm ci` déjà fait |
| `RUN npm ci` | installe **toutes** les dépendances, aux versions exactes du `package-lock.json` |
| `COPY . .` | copie tout le dossier `backend/` dans `/app`, sauf ce que liste `backend/.dockerignore` (`node_modules`, `dist`, `.git`) |
| `RUN DATABASE_URL="…" npx prisma generate && npm run build` | `prisma.config.ts` exige `DATABASE_URL` même pour `generate`, qui ne se connecte pas : adresse **factice**, valable pour cette seule commande. `prisma generate` crée le client Prisma (`generated/prisma`), `npm run build` compile le TypeScript dans `dist/` |

**Étape 2, `runner`** (l'image livrée, qui ne reçoit que le nécessaire)

| Ligne | Rôle |
| --- | --- |
| `FROM node:24.18.0-slim AS runner` | nouvel ordinateur **vide** : rien de l'étape 1 n'y est, sauf ce qu'on copie explicitement |
| `RUN apt-get … openssl …` | Prisma a aussi besoin d'`openssl` au démarrage |
| `ENV NODE_ENV=production` | mode production : bibliothèques optimisées, **mode cheat impossible** |
| `COPY --from=builder --chown=node:node …` | prend **un élément précis** de l'étape 1 (`--from=builder`) et le donne à l'utilisateur `node` (`--chown`). Éléments copiés : `package*.json`, `node_modules` (bibliothèques), `dist` (backend compilé), `generated` (client Prisma, rangé hors de `node_modules`), `prisma` + `prisma.config.ts` (migrations), `data` (vecteurs de mots de Pedantix, 20 Mo), `curated-articles.json` (recopié au chemin exact où le code le lit : `src/pedantix-engine/article/curated/`) |
| `RUN mkdir -p uploads/avatars && chown -R node:node /app/uploads` | crée le dossier des photos de profil et le donne à `node`, qui doit pouvoir y écrire |
| `USER node` | tout tourne en utilisateur `node`, pas en root (moindre privilège) |
| `EXPOSE 3000` | documentation : le backend écoute sur le port 3000 **dans** le conteneur ; n'ouvre aucun port sur la machine |
| `CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]` | au démarrage : met la base à jour, **puis** (`&&`, seulement si ça a réussi) lance le backend compilé. Le compose de prod remplace cette commande pour y ajouter l'envoi des logs à ELK |

### Dockerfile de dev ou de prod : les différences

Le Dockerfile de dev est un **atelier vide** : c'est le compose qui y apporte le code (montage `./backend:/app`) et les commandes (`npm ci`, `prisma generate`, `prisma:deploy`, `start:dev`, relancées à chaque démarrage). Le Dockerfile de prod est un **colis fermé** : il doit contenir tout ce qu'il faut pour fonctionner seul. D'où les lignes en plus.

| | Dev (`backend/Dockerfile`) | Prod (`backend/Dockerfile.prod`) |
| --- | --- | --- |
| Image de base | `node:24.18.0` : Debian **complet** (~1 Go, avec compilateurs, `git`, `openssl`…) | `node:24.18.0-slim` : Debian **allégé** (~200 Mo) |
| Pourquoi pas `alpine` (comme le frontend) | — | `bcrypt` et Prisma contiennent du code compilé pour Debian ; `slim` reste du Debian, comme en dev : fonctionnement garanti |
| Étapes | une seule | deux : `builder` puis `runner` |
| Code | copié, mais **recouvert** par le montage `./backend:/app` : c'est le dossier de la machine qui est utilisé | **copié dans l'image** ; plus aucun lien avec la machine |
| Compilation | aucune à l'avance : `start:dev` compile à la volée et recompile à chaque fichier modifié | une fois, au build (`npm run build` → `dist/`) |
| Ce qui tourne | `npm run start:dev` | `node dist/main` |
| `openssl` | déjà dans Debian complet | **ajouté**, car `slim` l'a retiré |
| `prisma generate` | au démarrage (commande du compose), quand `DATABASE_URL` existe | au build, avec une `DATABASE_URL` **factice** |
| Migrations | commande du compose (`npm run prisma:deploy`) | `CMD` : `npx prisma migrate deploy` |
| Fichiers de Pedantix | déjà dans le dossier monté | copiés explicitement |
| Photos de profil | écrites dans `backend/uploads/` de la machine, via le montage | dossier de l'image, rendu persistant par le volume `uploads` |
| Mode | développement (mode cheat activable) | `NODE_ENV=production` (mode cheat impossible) |
| Utilisateur | `npm ci` en root, puis `node` ; `root` imposé par le compose sur les postes de l'école | `node` |
| Taille | **2,34 Go** | **732 Mo** |

**Pourquoi 732 Mo et pas moins** (le frontend descend à 216 Mo) : le frontend profite du mode `standalone` de Next.js, qui trie automatiquement les dépendances. Le backend garde **tout** `node_modules`, outils de dev compris, parce que `prisma` (nécessaire aux migrations au démarrage) est une dépendance de dev dans `package.json`. Piste : si l'équipe back passe `prisma` en dépendance normale, ajouter `npm prune --omit=dev` dans l'étape `builder`.

**Pourquoi garder les deux** : en dev, le backend recompile tout seul à chaque fichier enregistré (`File change detected…`). En prod, on veut un backend figé, léger, sans root et sans mode cheat ; toute modification demande de reconstruire l'image.

### Bloc cible dans `docker-compose.prod.yml`

```yaml
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    image: transcendence-backend:prod

    container_name: transcendence-backend

    restart: unless-stopped

    depends_on:
      db:
        condition: service_healthy
      vault-init:
        condition: service_completed_successfully

    environment:
      DB_USER: ${DB_USER}
      DB_NAME: ${DB_NAME}
      DATABASE_URL: "postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}"
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: ${VAULT_DEV_ROOT_TOKEN_ID}
      FRONTEND_URL: https://localhost:8443

    # migrations, puis lancement ; les logs vont aussi dans le fichier lu par ELK
    command: sh -c "npx prisma migrate deploy && node dist/main 2>&1 | tee /var/log/app/backend.log"

    volumes:
      - app_logs:/var/log/app
      - uploads:/app/uploads          # photos de profil : conservees si le conteneur est recree

    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 60s

    networks:
      - private-net
```

Plus `uploads:` dans la liste `volumes:` en bas du fichier.

| Réglage | Dev | Prod | Pourquoi |
| --- | --- | --- | --- |
| `build` | `context: ./backend` (Dockerfile de dev) | + `dockerfile: Dockerfile.prod` | image de prod : compilée au build, légère, sans root |
| `image` | — (nom automatique `ft_transcendence-backend`) | `transcendence-backend:prod` | sinon l'image de prod écrase celle de dev (même nom automatique) |
| `container_name` | `transcendence-backend` | identique | une seule stack à la fois |
| `user` | `"0:0"` (root, pour les postes de l'école) | supprimé (laissé en commentaire) | plus de code monté depuis la machine : `node` suffit (à tester sur un poste de l'école) |
| `restart` | — | `unless-stopped` | relance automatique en cas de plantage |
| `depends_on` | `db` healthy + `vault-init` terminé | identique | le backend a toujours besoin de la base et de ses secrets |
| `environment` | `DB_USER`, `DB_NAME`, `DATABASE_URL`, `VAULT_ADDR`, `VAULT_TOKEN`, `FRONTEND_URL` | identique | ce sont les **vraies** valeurs, fournies au démarrage (la `DATABASE_URL` factice du Dockerfile ne sert qu'au build) |
| `working_dir` | `/app` | supprimé | défini dans le Dockerfile (`WORKDIR /app`) |
| `command` | `npm ci && prisma generate && prisma:deploy && start:dev …` | `npx prisma migrate deploy && node dist/main …` | plus d'installation ni de compilation au démarrage : tout est fait au build ; restent les migrations et le lancement |
| `\| tee /var/log/app/backend.log` | oui | identique | les logs du backend continuent d'arriver dans ELK |
| `ports` | `127.0.0.1:5555:5555` (Prisma Studio) | supprimé | outil de dev |
| volume `./backend:/app` | oui (le code de la machine, en direct) | **supprimé** | le code est dans l'image ; le garder **recouvrirait** `dist/`, `generated/` et `node_modules` de l'image, et le backend ne démarrerait pas |
| volume `/app/node_modules` | oui | **supprimé** | les bibliothèques sont dans l'image ; plus de volumes `node_modules` anonymes (cause du disque plein) |
| volume `app_logs` | oui | identique | fichier `backend.log` lu par Logstash |
| volume `uploads` | — (les photos vont dans `backend/uploads/` de la machine) | `uploads:/app/uploads` | sans lui, les photos de profil seraient perdues à chaque recréation du conteneur |
| `stdin_open`, `tty`, `init` | oui | supprimés | utiles pour un terminal en dev |
| `healthcheck` | oui, `start_period: 120s` | identique, `start_period: 60s` | démarrage plus rapide (pas de `npm ci`) |
| `networks` | `private-net` | identique (`internal: true` à l'étape e) | le backend est joint par le WAF via le réseau privé |

**Piège** : copier le bloc de dev puis l'adapter fait facilement oublier les deux montages `./backend:/app` et `/app/node_modules`. Le build réussit quand même, mais au démarrage le dossier de la machine (code source non compilé, sans `dist/` à jour) recouvre le contenu de l'image.

### Testé le 22/10/2026

Image construite et lancée **à part** (conteneur de test, réseau `private-net` de la stack de dev, mêmes variables que le compose), sans toucher au backend de dev :

| Vérification | Résultat |
| --- | --- |
| Build | réussi, 732 Mo (1ᵉʳ essai : échec `Missing required environment variable: DATABASE_URL` → adresse factice) |
| Migrations au démarrage | `No pending migrations to apply` |
| Données de Pedantix | `Loaded 50000 word vectors (100d)` |
| Démarrage | `Nest application successfully started` |
| `/health` | `{"status":"ok", … "database":{"status":"up"}}` |
| Utilisateur | `uid=1000(node)` |

### Points d'attention

- **À relire par l'équipe back** : ces fichiers sont dans `backend/` ; eux seuls peuvent confirmer qu'aucun autre fichier n'est lu à l'exécution, et décider du seed en prod (non lancé aujourd'hui).
- **`prisma` en dépendance de dev** : impose de garder tout `node_modules` (voir taille).
- **Postes de l'école** : comme pour le frontend, vérifier sous podman que le backend démarre en `node` sans erreur `EACCES`.
- **`backend.log` existant** : sur une machine qui a fait tourner le dev, le fichier appartient à `root` ; le `tee` en utilisateur `node` ne pourra pas y écrire (le backend fonctionne quand même). Pas de problème sur une installation neuve.
- **Adresses écrites en dur** (`https://localhost:8443` dans les callbacks OAuth et l'adresse des avatars) : à transformer en variables pour un vrai nom de domaine (étape h du plan).

### État au 22/10/2026

- [x] `backend/Dockerfile.prod` écrit et testé
- [ ] bloc `backend` de `docker-compose.prod.yml` : `Dockerfile.prod`, `image`, `restart`, `command` faits ; reste à retirer `./backend:/app`, `/app/node_modules`, `stdin_open`, `tty`, `init`, à ajouter le volume `uploads` (dans le bloc et en bas du fichier), et à corriger le nom d'image (`transcendence`)
- [ ] `docker compose -f docker-compose.prod.yml build backend`
- [ ] relecture par l'équipe back
- [ ] test sur un poste de l'école

## **5. Quel fichier est utilisé ?**

C'est la **commande** qui décide. Les deux fichiers existent côte à côte, Docker n'en utilise qu'un à la fois :

| Commande | Fichier utilisé |
| --- | --- |
| `docker compose up -d` | `docker-compose.yml` (dev) : c'est le nom par défaut, utilisé quand on ne précise rien |
| `docker compose -f docker-compose.prod.yml up -d --build` | `docker-compose.prod.yml` (prod), et lui seul |

Rien ne change pour l'équipe en dev. L'évaluateur lancera ce qu'indique le README : il faudra y écrire la commande de prod (ou la cacher derrière un `Makefile`, par exemple `make` pour la prod et `make dev` pour le dev).

### `internal: true` seulement en prod

En dev, le frontend et le backend lancent `npm ci` **à chaque démarrage**, qui télécharge les paquets sur Internet : un réseau coupé d'Internet empêcherait le site de démarrer. En prod, tout est installé **au build** (qui a accès à Internet) ; en fonctionnement, seuls le backend (connexion Google/Discord, Wikipédia) et Alertmanager (webhook Discord) ont besoin d'Internet, via `egress-net`.

| Réseau | Dev | Prod |
| --- | --- | --- |
| `public-net` | WAF, frontend | WAF seul |
| `private-net` | normal (accès à Internet) | `internal: true` (coupé d'Internet) |
| `egress-net` | n'existe pas | backend et Alertmanager |

## **6. Tester sans casser la stack de dev**

Les deux fichiers créent des conteneurs **de mêmes noms** (`container_name`). On ne fait donc tourner **qu'une stack à la fois**.

| But | Commande |
| --- | --- |
| Vérifier le fichier | `docker compose -f docker-compose.prod.yml config --quiet` (rien affiché = valide) |
| Construire une image | `docker compose -f docker-compose.prod.yml build frontend` |
| Remplacer **seulement** le frontend de dev par celui de prod | `docker compose -f docker-compose.prod.yml up -d --no-deps frontend` (même nom de conteneur : Docker remplace l'ancien ; le WAF de dev le joint via `private-net`) |
| Revenir au frontend de dev | `docker compose build frontend` puis `docker compose up -d --force-recreate frontend` |
| Lancer la prod (quand backend prêt) | `docker compose down` puis `docker compose -f docker-compose.prod.yml up -d --build` |
| Revenir au dev | `docker compose -f docker-compose.prod.yml down` puis `docker compose up -d` |

`down` sans `-v` garde les volumes (base de données, logs, Elasticsearch).
