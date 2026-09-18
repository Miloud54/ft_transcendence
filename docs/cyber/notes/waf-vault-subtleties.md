# WAF + Vault — notes complètes et subtilités

**(17/09/2026)**

Doc de référence à relire seule, sans avoir à redemander — regroupe tout ce qui a coincé en le construisant, avec le "pourquoi" à chaque fois. Voir aussi [`waf-nginx.md`](./waf-nginx.md) pour le détail fichier par fichier du WAF.

---

## Partie 1 — WAF (Nginx + ModSecurity)

### C'est quoi, en une phrase

ModSecurity n'est pas un logiciel autonome — c'est un module qui a besoin d'un serveur web pour exister (Nginx ou Apache). "WAF" chez nous = Nginx (le routeur) + ModSecurity (le videur qui inspecte avant de laisser entrer) + OWASP CRS (la liste des profils suspects que le videur connaît).

### La syntaxe Nginx, en deux règles

- **Directive simple** : mot-clé + valeur(s) + `;` → un réglage unique (`listen 8080;`)
- **Directive-bloc** : mot-clé + `{ }` → crée un **contexte** (un espace où d'autres directives s'appliquent). `server { }`, `location { }`, `upstream { }` en sont.

Un `location /api/` ne s'applique qu'aux requêtes qui commencent par `/api/` — rien en dehors.

### Le piège `/api/` avec ou sans `/` final

```nginx
location /api/ {
    proxy_pass http://backend_upstream/;  # <- / final : RETIRE le préfixe /api/
}
location / {
    proxy_pass http://frontend_upstream;  # <- pas de / final : garde le chemin tel quel
}
```
`GET /api/room` → arrive chez `backend` en `GET /room` (préfixe retiré). Vérifié utile chez nous : le backend NestJS n'a pas de préfixe `/api` configuré (`app.setGlobalPrefix`), donc ce retrait est correct.

### HTTP et HTTPS = deux portes indépendantes

Un bloc `server { }` = une porte d'entrée (un port). HTTP (80) et HTTPS (443) sont deux portes différentes → les mêmes règles de routage (`location /api/`, `location /`) doivent être **répétées** dans chaque bloc. Seul le bloc HTTPS a en plus `ssl_certificate`, `ssl_certificate_key`, `ssl_protocols`.

### Port host vs port conteneur — le piège qui casse tout

```yaml
backend:
  ports:
    - "3001:3000"   # HOST:CONTENEUR
```
- `3000` = le port réel, à l'intérieur du conteneur. C'est celui que **les autres conteneurs** (le WAF) utilisent : `server backend:3000;`
- `3001` = un port qui n'existe **que pour toi**, humaine, hors de Docker (`localhost:3001`). Totalement invisible pour un autre conteneur.

**Piège inverse, plus grave** : ce même mapping `ports:` rend `backend` joignable **directement depuis l'extérieur**, en HTTP, sans passer par le WAF — même si `backend` est sur `private-net`. `private-net` protège la communication *entre conteneurs*, pas contre un port publié qui perce un tunnel direct vers l'extérieur. Même chose pour Kibana (`5601`), Prometheus (`9090`), Alertmanager (`9093`) : "être sur `private-net`" ne protège rien tant qu'un `ports:` existe en parallèle.

### HTTP/1.0 casse les WebSockets

Un WebSocket a besoin d'une connexion qui **reste ouverte**. HTTP/1.0 (comportement par défaut de `proxy_pass`) ferme la connexion après chaque échange — comme raccrocher après une phrase au lieu de garder la ligne. D'où `proxy_http_version 1.1;` dans chaque `location`, pour garder la ligne ouverte.

### Certificat auto-signé = avertissement navigateur normal

Le conteneur génère son propre certificat au démarrage (`generate-certificate`). Comme personne d'externe ne le "garantit" (pas une vraie autorité type Let's Encrypt), le navigateur affiche "connexion non sécurisée" — normal en local/éval, pas un bug.

### Piège YAML : `On` sans guillemets

```yaml
MODSEC_RULE_ENGINE: "On"   # PAS: MODSEC_RULE_ENGINE: On
```
En YAML, `on`/`off`/`yes`/`no`/`true`/`false` **sans guillemets** sont lus comme des booléens, pas du texte. Sans guillemets, ModSecurity recevrait autre chose que la chaîne `"On"` attendue, et le blocage ne s'activerait pas — silencieusement.

### DetectionOnly vs On, et le score d'anomalie

- `DetectionOnly` : ModSecurity observe et logue, ne bloque rien.
- `On` : bloque réellement (`403`).
- Chaque règle qui matche ajoute des points à un score. Le blocage se déclenche seulement quand le score **atteint le seuil** (`inbound_anomaly_score_threshold`, 5 par défaut). Testé et confirmé chez nous : une injection SQL (`1' OR '1'='1`) déclenche la règle `942100` (libinjection), score = 5 = seuil → `403` en mode `On`.

---

## Partie 2 — Vault

### Dev mode vs production — la vraie différence

| | Dev mode | Production |
|---|---|---|
| Stockage | En mémoire, perdu au redémarrage | Persistant |
| Déverrouillage | Automatique | Manuel, plusieurs clés séparées |
| TLS | Aucun par défaut | Attendu |

Le sujet demande juste "encrypted and isolated" pour les secrets — pas explicitement "hardened" comme pour le WAF. Le mode dev suffit pour cocher la case, à condition d'être **automatisé** (voir plus bas), pas rempli à la main.

### `VAULT_DEV_ROOT_TOKEN_ID` — le mot de passe que TU choisis

Vault génère un token root automatiquement en mode dev ; cette variable permet de le fixer soi-même (comme `DB_PASSWORD`) plutôt que d'aller le chercher dans les logs à chaque fois.

### `command: ["server", "-dev"]`

`server` = démarre un vrai serveur Vault qui tourne en continu (par opposition à une commande ponctuelle comme `vault status`). `-dev` = mode développement. Écrit en liste `["server", "-dev"]` plutôt qu'en texte simple : chaque argument est transmis exactement, sans passer par un interpréteur shell qui pourrait mal lire des espaces/caractères spéciaux — un détail de syntaxe Docker, pas essentiel à retenir en profondeur.

### `VAULT_ADDR` vs `VAULT_DEV_LISTEN_ADDRESS` — le piège qui a cassé le healthcheck

Deux rôles différents, faciles à confondre :

- **`VAULT_DEV_LISTEN_ADDRESS` (0.0.0.0:8200)** — côté **serveur** : "qui a le droit de m'appeler". `0.0.0.0` = accepte les connexions venant de n'importe où (nécessaire pour que `vault-init`, le WAF plus tard, et le navigateur via le port publié puissent tous joindre Vault).
- **`VAULT_ADDR` (http://127.0.0.1:8200)** — côté **client** : "à qui je me connecte". `127.0.0.1` = soi-même, utilisé par le healthcheck qui vérifie Vault depuis l'intérieur de son propre conteneur.

**Le bug rencontré** : sans `VAULT_ADDR` explicite, la commande `vault status` (utilisée par le healthcheck) essaie par défaut de se connecter en **HTTPS**. Mais notre Vault dev écoute en **HTTP simple** (pas de `-dev-tls`). Résultat : le healthcheck échoue à se connecter → Docker déclare le conteneur "unhealthy" alors que Vault tourne parfaitement (visible dans les logs : `Vault server started!`, `core: vault is unsealed`, aucune erreur réelle). Fix : ajouter `VAULT_ADDR: http://127.0.0.1:8200` dans l'`environment:` du service `vault`.

**Règle générale à garder** :
- Un conteneur qui parle à **un autre conteneur** → nom du service (`backend:3000`)
- Un processus qui se vérifie **lui-même** → `127.0.0.1`

### `vault-init` — pourquoi un conteneur jetable, et pourquoi c'est standard

Vault en mode dev repart **vide** à chaque redémarrage. Sans un conteneur qui le re-remplit automatiquement, il faudrait taper les secrets à la main à chaque `docker compose up` — inacceptable pour le sujet, qui exige un déploiement en **une seule commande**.

`vault-init` : démarre après que `vault` soit `healthy`, écrit les secrets dans Vault via `vault/entrypoint.sh`, s'arrête. Même principe que `logs-init`, déjà présent dans le projet depuis le début.

**Ce n'est pas un hack inventé pour ce projet** — c'est un motif standard. Preuve : [`deviantony/docker-elk`](https://github.com/deviantony/docker-elk), la référence la plus utilisée pour monter ELK avec Docker Compose, utilise un service `setup` qui fait exactement ça : initialise les mots de passe `kibana_system`/`logstash_internal` depuis `.env`, une fois, au démarrage.

Recherche faite sur une dizaine de vrais dépôts `ft_transcendence` publics : aucun n'a de Vault réellement fonctionnel — la comparaison "les autres font pareil" ne tient pas, mais `docker-elk` (projet infra sérieux, sans lien avec 42) est une preuve plus solide encore.

### `.env` disparaît-il avec Vault ? Non, et c'est normal

`docker-compose` doit connaître `DB_PASSWORD` **avant même que Vault existe**, pour démarrer `db` — impossible de casser ce problème de l'œuf et la poule dans ce genre de setup. `.env` reste la source de bootstrap.

**Ce qui change vraiment** : aujourd'hui, `backend` reçoit `DATABASE_URL` (mot de passe inclus) directement via `docker-compose`. L'objectif utile n'est pas "supprimer `.env`" mais "**l'application ne lit plus jamais `.env` directement**" — `backend` irait chercher le mot de passe dans Vault au démarrage (via un token, pas le vrai mot de passe reçu en clair). C'est cette étape-là qui donne à Vault son intérêt réel (contrôle d'accès par secret, journal de qui a demandé quoi, rotation sans tout redéployer) — sans elle, Vault contient une copie du secret mais rien ne le consomme réellement. **Mise en pause pour l'instant, à reprendre plus tard** — implique de toucher du code NestJS (`backend/src/main.ts`), pas juste du YAML.

---

## Le fil conducteur derrière toutes ces subtilités

Presque tous les pièges rencontrés viennent de la même distinction, sous des formes différentes :
- **Qui peut appeler qui** (port publié qui perce `private-net`, `0.0.0.0` vs `127.0.0.1`)
- **Quel compte a le droit de faire quoi** (compte `elastic` refusé par Kibana au profit de `kibana_system`, futur token Vault limité plutôt que le vrai mot de passe)

Un seul principe derrière les deux : **ne jamais donner plus d'accès que nécessaire, à la bonne échelle**. Une fois ce fil repéré, chaque nouveau piège du même genre se reconnaît plus vite.
