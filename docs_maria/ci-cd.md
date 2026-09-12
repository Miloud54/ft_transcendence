# CI/CD — comprendre et utiliser ce qu'on a dans ce projet

## C'est quoi, concrètement

- **CI (Intégration Continue)** : à chaque `push` ou pull request, une machine vierge exécute automatiquement le lint/les tests/le build de ton code. Le but : détecter un problème *avant* qu'il arrive sur `main` ou chez un coéquipier, sans que personne n'ait à lancer les commandes à la main.
- **CD (Déploiement Continu)** : la suite logique — si la CI passe, déployer automatiquement en prod/staging. **Ce projet n'a pas encore de CD**, seulement de la CI (voir plus bas).

Pas besoin d'installer quoi que ce soit ni de configurer un service externe : sur GitHub, un fichier YAML dans `.github/workflows/` suffit. GitHub Actions le détecte tout seul et l'exécute selon les déclencheurs définis dedans. Le repo GitHub *est* la plateforme CI/CD.

## Le pipeline de ce projet : `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24.18.0
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci
      - run: npm run lint
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24.18.0
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

### Vocabulaire de base

| Terme | Sens |
| --- | --- |
| **Workflow** | Le fichier YAML entier (ici `ci.yml`). Un repo peut en avoir plusieurs, dans `.github/workflows/`. |
| **Trigger** (`on:`) | Ce qui déclenche le workflow. Ici : tout `push` (`branches: ["**"]` = toutes les branches) et toute `pull_request`. |
| **Job** | Une unité de travail indépendante, avec sa propre machine virtuelle. Ici : `frontend` et `backend`, qui tournent **en parallèle**. |
| **Runner** (`runs-on:`) | La machine virtuelle qui exécute le job — ici `ubuntu-latest`, fournie gratuitement par GitHub (dans une limite d'heures). |
| **Step** | Une étape séquentielle à l'intérieur d'un job. Si un step échoue, les suivants ne s'exécutent pas et le job entier est marqué ❌. |
| **Action** (`uses:`) | Un step qui appelle du code réutilisable publié par quelqu'un d'autre (ex: `actions/checkout@v4` clone le repo, `actions/setup-node@v4` installe Node.js). |
| **Run** (`run:`) | Un step qui exécute une commande shell brute (ex: `npm run lint`). |

### Pourquoi chaque step existe

1. **`actions/checkout@v4`** — sans lui, la VM est vide, il n'y a aucun code à tester. Presque toujours le premier step de n'importe quel job.
2. **`actions/setup-node@v4`** — installe Node dans la version exacte du projet (`24.18.0`), pour éviter les écarts "ça marche chez moi mais pas en CI". Le `cache: npm` évite de re-télécharger les dépendances à chaque run tant que `package-lock.json` n'a pas changé.
3. **`npm ci`** (≠ `npm install`) — installe les dépendances **exactement** comme verrouillées dans `package-lock.json`, sans jamais le modifier. Plus rapide et surtout reproductible : deux runs avec le même lockfile installent toujours exactement les mêmes versions.
4. **`npm run lint`** — vérifie la syntaxe/le style du code (ESLint). Si une erreur de syntaxe traîne quelque part (vécu : voir plus bas), ce step échoue et bloque tout le job.
5. **`npm test`** (backend seulement) — lance les tests automatisés.
6. **`npm run build`** — vérifie que le projet compile réellement. Un `lint` qui passe ne garantit pas que le code compile ; inversement, tester le build après le lint permet de détecter les deux types de problèmes séparément.

## Comment déboguer un run qui échoue

1. **Sur GitHub** : onglet **Actions** du repo → cliquer sur le run en échec → cliquer sur le job rouge → déplier le step qui a un ❌ → lire les logs, l'erreur est en général explicite.
2. **En local, sans attendre un push** : reproduire le step qui échoue directement dans le conteneur du service concerné, par exemple :
   ```bash
   podman exec transcendence-frontend npm run lint
   ```
   C'est comme ça qu'on a trouvé le bug `game-board.tsx` (erreur de parsing ESLint) sans avoir besoin d'attendre un run GitHub.
3. Le nom du job qui échoue (`frontend` ou `backend`) te dit déjà dans quel dossier chercher.

## Statut actuel de ce projet

- ✅ CI en place pour `frontend` et `backend` (lint + build, + tests pour le backend).
- ❌ Pas de CD : rien ne se déploie automatiquement après un push, même si la CI passe.
- ❌ Pas de CI pour le reste de la stack (ELK, monitoring, etc.) — seulement les deux apps Node.

## Pour aller plus loin

- Ajouter un job qui valide `docker-compose.yml` (ex: `docker compose config` pour vérifier la syntaxe) éviterait de découvrir une erreur de config seulement en local.
- Un job de CD viendrait après la CI, avec une condition du type `needs: [frontend, backend]` pour ne déployer que si les deux jobs précédents sont passés.
