# Gestion du trafic public - WAF (Nginx + ModSecurity)

**(15/09/2026)**

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
- Les ports directs `frontend:3000` et `backend:3001` restent ouverts en parallèle pour l'instant (phase transitoire, le temps de tout valider) — donc le WAF n'est **pas encore** le seul point d'entrée possible

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
