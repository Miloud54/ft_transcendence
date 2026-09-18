# Gestion des secrets - HashiCorp Vault

**(18/09/2026)**

Doc de référence sur ce qui est en place. Pour le détail des pièges rencontrés en le construisant (`VAULT_ADDR`, volumes périmés, etc.), voir [`waf-vault-subtleties.md`](./waf-vault-subtleties.md).

---

## Ce qui tourne maintenant

Deux services dans `docker-compose.yml` :

- **`vault`** (`hashicorp/vault:1.17`) — le coffre-fort à secrets, en **mode développement** (simple, pas de cérémonie de déverrouillage, tout en mémoire), accessible sur `http://localhost:8200`
- **`vault-init`** — conteneur jetable, s'exécute une fois à chaque démarrage, remplit automatiquement Vault avec les secrets du projet, puis s'arrête

`backend` va lui-même chercher ses secrets dans Vault au démarrage — il ne les reçoit plus tout faits.

---

## Fichiers ajoutés/modifiés

| Fichier | Rôle |
| --- | --- |
| `vault/entrypoint.sh` | écrit les secrets dans Vault (`db_password`, `jwt_secret`, regroupés sous un seul chemin `secret/backend`) |
| `docker-compose.yml` (service `vault`) | démarre Vault en mode dev, avec un token root choisi via `.env` |
| `docker-compose.yml` (service `vault-init`) | remplit Vault automatiquement, à chaque `docker compose up`, sans action manuelle |
| `docker-compose.yml` (service `backend`) | ne reçoit plus `DATABASE_URL`/`JWT_SECRET` en clair — juste un token Vault (`VAULT_ADDR`, `VAULT_TOKEN`) ; commande de démarrage modifiée pour toujours réinstaller les dépendances et régénérer Prisma au boot (`npm ci && npx prisma generate && npm run start:dev`) |
| `backend/src/main.ts` | nouvelle fonction `loadSecretsFromVault()`, appelée avant le démarrage de l'app, qui va chercher les secrets dans Vault et les injecte dans `process.env` |
| `backend/package.json` | ajout de la librairie `node-vault` |

---

## Ce que Vault fait aujourd'hui

- Stocke `DB_PASSWORD` et `JWT_SECRET`, chiffrés, sous `secret/backend`
- Rempli **automatiquement** à chaque démarrage par `vault-init` (le mode dev repart à vide à chaque fois, donc ce remplissage se refait systématiquement — pas une étape à faire une fois puis oublier)
- **Réellement utilisé** : `backend` ne fonctionne plus sans Vault — au démarrage, il interroge Vault via l'API (`node-vault`), récupère `db_password`/`jwt_secret`, et construit lui-même `DATABASE_URL`/`JWT_SECRET` avant de se connecter à la base et d'initialiser l'authentification
- Testé et validé de bout en bout : `backend` démarre `healthy`, connexion DB fonctionnelle, JWT fonctionnel — tout provient de Vault, rien n'est codé en dur

---

## Prochaines étapes

- [ ]  Étendre à d'autres secrets si besoin (clé API IA, OAuth, etc.) — même recette : une ligne de plus dans `vault/entrypoint.sh`, une ligne de plus dans `loadSecretsFromVault()`

