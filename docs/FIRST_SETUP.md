# 🚀 Initialisation du projet ft_transcendence

Ce document propose une procédure pour créer et développer le projet.

⚠️ Les étapes seront à tester et à ajuster si nécessaire lors de la première installation du projet.

L'objectif est que personne n'installe Node.js, npm, NestJS CLI, Prisma, etc. sur sa machine et que tous le monde ait les mêmes versions de tout ce qu'on utilisera pour le projet.

Les seuls prérequis sont : Git, Docker et Docker Compose.

_Les versions de Node.js et des outils de génération sont volontairement figées pour que tout le monde obtienne exactement le même squelette du projet._

# 1. Vérifier les prérequis

### Git

```bash
git --version
```

### Docker

```bash
docker --version
```

### Docker Compose

```bash
docker compose version
```

Si ces trois commandes fonctionnent, tout est prêt.

# 2. Génération du squelette du projet (à faire une seule fois)

> Cette partie est réalisée uniquement par la personne qui initialise le projet.

### Cloner le dépôt

```bash
git clone git@github.com:<organisation>/ft_transcendence.git
cd ft_transcendence
```

### Créer l'arborescence

```bash
mkdir backend frontend
```

### Créer le fichier `docker-compose.yml`

Ce fichier décrira, à terme, tous les services du projet.

Créer un premier fichier minimal `docker-compose.yml` contenant :

```yaml
services:

  node:

    image: node:24.18.0

    user: "${UID:-1000}:${GID:-1000}"

    working_dir: /workspace

    volumes:
      - .:/workspace

    stdin_open: true

    tty: true
```

Ce conteneur servira à exécuter toutes les commandes Node.js nécessaires à la génération du squelette du projet.

> **Remarque :**
>
> Ce premier `docker-compose.yml` est volontairement minimal. Il sert uniquement à créer le frontend et le backend sans installer Node.js sur la machine hôte.
>
> Il sera ensuite remplacé par le véritable environnement de développement Docker, qui contiendra progressivement les services :
>
> - frontend
> - backend
> - postgres
> - prometheus
> - grafana
> - vault
> - waf
> - etc.

### Générer le frontend

```bash
sudo docker compose run --rm node \
npx create-next-app@16.2.11 frontend
```

Would you like to use the recommended Next.js defaults?
***Yes***

### Générer le backend

```bash
docker compose run --rm node \
npx @nestjs/cli@11.0.24 new backend --skip-git
```

Choisir :

```
npm
```

### Ajouter un .gitignore

```bash
touch .gitignore
```

Et y ajouter :

```gitignore
.env
.vscode/
.DS_Store
```

### Vérifier l'arborescence

On doit obtenir :

```text
backend/
frontend/
docker-compose.yml
README.md
.gitignore
```

### Premier commit

```bash
git add .
git commit -m "Initial project structure"
git push
```

---

# 🚀 Mise en place de l'environnement Docker de développement

À la fin de cette étape, le frontend et le backend tourneront entièrement dans Docker, et le lancement du projet se fera avec **docker compose up**.

# 1. Créer le Dockerfile du frontend

Créer :

```text
frontend/Dockerfile
```

Contenu :

```Dockerfile
FROM node:24.18.0

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

# 2. Créer le Dockerfile du backend

Créer :

```text
backend/Dockerfile
```

Contenu :

```Dockerfile
FROM node:24.18.0

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
```

# 3. Créer les fichiers `.dockerignore`

Ces fichiers permettent d'éviter d'envoyer des fichiers inutiles lors du build des images Docker.

### Frontend

Créer :

```text
frontend/.dockerignore
```

Contenu :

```text
node_modules
.next
.git
```

### Backend

Créer :

```text
backend/.dockerignore
```

Contenu :

```text
node_modules
dist
.git
```

# 4. Remplacer le `docker-compose.yml`

Supprimer le service `node`.

Créer le fichier suivant :

```yaml
services:

  frontend:

    build:
      context: ./frontend

    container_name: transcendence-frontend

    user: "${UID:-1000}:${GID:-1000}"

    environment:
      UID: ${UID:-1000}
      GID: ${GID:-1000}

    working_dir: /app

    command: npm run dev

    ports:
      - "3000:3000"

    volumes:
      - ./frontend:/app
      - /app/node_modules

    stdin_open: true
    tty: true
    init: true

  backend:

    build:
      context: ./backend

    container_name: transcendence-backend

    user: "${UID:-1000}:${GID:-1000}"

    environment:
      UID: ${UID:-1000}
      GID: ${GID:-1000}

    working_dir: /app

    command: npm run start:dev

    ports:
      - "3001:3000"

    volumes:
      - ./backend:/app
      - /app/node_modules

    stdin_open: true
    tty: true
    init: true
```

# 5. Construire et démarrer le projet

```bash
docker compose up --build
```

# 6. Vérifier le bon fonctionnement

Le frontend doit être accessible sur :

```text
http://localhost:3000
```

Le backend doit être accessible sur :

```text
http://localhost:3001
```

Les deux doivent démarrer correctement.

# 7. Vérifier le Hot Reload

### Frontend

Modifier une page.

Le navigateur doit se mettre à jour automatiquement.

### Backend

Modifier un controller (par exemple ajouter une route ou modifier un message de retour).

NestJS doit afficher :

```text
Found 0 errors.
Restarting...
```

sans reconstruire l'image Docker.

À partir de cette étape, l'environnement de développement est entièrement conteneurisé. Toutes les commandes de développement (installation de dépendance, génération de code, lancement des serveurs, migrations, etc.) seront exécutées dans les conteneurs Docker.

---

# 👥 Commandes pour le reste de l'équipe

Une fois les deux étapes précédentes réalisées (initialisation du projet et mise en place de l'environnement Docker), chaque membre de l'équipe peut récupérer et lancer le projet en quelques commandes.

# 1. Première installation

Cloner le dépôt :

```bash
git clone git@github.com:<organisation>/ft_transcendence.git
cd ft_transcendence
```

Construire les images Docker et démarrer l'environnement de développement :

```bash
docker compose up --build
```

Cette commande construit automatiquement les images Docker si elles n'existent pas encore, puis lance le frontend et le backend.

# 2. Après chaque `git pull`

Mettre à jour le dépôt :

```bash
git pull
```

Dans la majorité des cas, il suffit ensuite de relancer les conteneurs :

```bash
docker compose up
```

Si un `Dockerfile` ou le `docker-compose.yml` a été modifié, reconstruire les images :

```bash
docker compose up --build
```

Le `--build` force Docker à reconstruire les images afin de prendre en compte les modifications de l'environnement de développement.

---

# 🛠️ Commandes utiles pour la suite du projet

À partir de la mise en place de l'environnement Docker de développement, toutes les commandes seront exécutées dans les conteneurs Docker.

# Docker

## Construire et démarrer le projet

```bash
docker compose up --build
```

Construit les images Docker si nécessaire, puis démarre l'ensemble des services.

## Démarrer le projet

```bash
docker compose up
```

Démarre les conteneurs sans reconstruire les images.

## Arrêter le projet

```bash
docker compose down
```

Arrête et supprime les conteneurs.

# Frontend

## Ouvrir un terminal dans le conteneur

```bash
docker compose exec frontend bash
```

## Installer une dépendance

```bash
docker compose exec frontend npm install <package>
```

# Backend

## Ouvrir un terminal dans le conteneur

```bash
docker compose exec backend bash
```

## Installer une dépendance

```bash
docker compose exec backend npm install <package>
```

## Générer un module NestJS

```bash
docker compose exec backend npx nest g module users
```

## Générer un controller

```bash
docker compose exec backend npx nest g controller users
```

## Générer un service

```bash
docker compose exec backend npx nest g service users
```

## Générer une ressource complète (module + controller + service)

```bash
docker compose exec backend npx nest g resource users
```

Toutes ces commandes sont exécutées dans les conteneurs Docker.

Aucun membre de l'équipe n'a besoin d'installer Node.js, npm, NestJS CLI, Prisma ou toute autre dépendance JavaScript sur sa machine.

---

# 🚀 TODO LATER

- Mettre en place la gestion des variables d'environnement :
  - **`.env`** (ignoré par Git)
  - **`.env.example`** (versionné, servant de modèle pour les différents fichiers `.env`)
  - définir la structure des variables pour Docker, le backend et le frontend

- Ajouter PostgreSQL au `docker-compose.yml`

- Ajouter `depends_on` pour le backend

```yaml
backend:
  depends_on:
    - postgres
```

- Mettre en place Prisma, etc.

## Outils pour modéliser des bases de données
- [dbdiagram.io](https://dbdiagram.io/)  
ou
- [DrawSQL](https://drawsql.app/)

