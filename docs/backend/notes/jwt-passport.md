# JWT & Passport, expliqués avec JwtStrategy et JwtAuthGuard

## 1. C'est quoi un JWT

JWT = **JSON Web Token**. Une chaîne de caractères en trois parties séparées par des points, que le serveur donne au client après une connexion réussie :

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZW1haWwiOiJlbWlsaWUuZmluYWxAZXhhbXBsZS5jb20ifQ.eexw1HNdjBYM_oXhFxjHYwiMtrYEli9GWnG4caTfnww
     └────────── en-tête ──────────┘ └────────────────── données (payload) ──────────────────┘ └─────────── signature ───────────┘
```

- **En-tête** : l'algorithme de signature utilisé.
- **Payload** : les données qu'on a choisi d'y mettre — chez nous, dans `AuthService` : `{ sub: user.id, email: user.email }`.
- **Signature** : le résultat d'un calcul cryptographique sur les deux premières parties, à l'aide d'une clé secrète (`JWT_SECRET`) que seul le serveur connaît.

Point essentiel à bien comprendre : **un JWT est signé, pas chiffré**. Le payload (partie 2) est simplement encodé en base64 — n'importe qui peut le décoder et lire `{"sub":"2","email":"..."}` sans aucune clé. Ce qui protège le jeton, c'est la signature : impossible de la reproduire sans connaître `JWT_SECRET`, donc impossible de fabriquer un faux jeton ou de modifier un jeton existant sans que la vérification échoue. **Ne jamais mettre une donnée sensible (mot de passe, etc.) dans le payload d'un JWT** — elle serait lisible par n'importe qui l'interceptant.

## 2. Pourquoi un jeton plutôt qu'une session classique

Une session classique (cookie + stockage côté serveur) oblige le serveur à garder en mémoire (ou en base) "qui est connecté" pour chaque utilisateur. Un JWT est **auto-suffisant** : toutes les infos nécessaires pour savoir qui fait la requête sont dans le jeton lui-même. Le serveur n'a rien à stocker — il reçoit le jeton, vérifie la signature, et sait immédiatement qui c'est.

La contrepartie honnête : impossible de "déconnecter" quelqu'un de force avant l'expiration naturelle du jeton (`expiresIn: '1d'` chez nous) sans mettre en place un mécanisme de révocation à part (liste noire de jetons, etc.) — non implémenté pour l'instant, à garder en tête si le besoin se présente plus tard.

## 3. Passport et le concept de "stratégie"

Passport est une bibliothèque d'authentification pour Node, construite autour d'un principe simple : chaque **façon** de prouver son identité (email + mot de passe, JWT, Google, Discord...) est une **stratégie** différente, mais elles s'utilisent toutes de la même manière dans le code. Apprendre à en utiliser une, c'est déjà savoir utiliser les autres.

`JwtStrategy` est la nôtre pour vérifier un jeton :

```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  validate(payload: { sub: string; email: string }) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

Deux étapes bien distinctes s'y passent, dans cet ordre :

1. **Avant `validate()` : Passport fait le travail de vérification tout seul.** `jwtFromRequest` lui dit où chercher le jeton (l'en-tête `Authorization: Bearer <token>`), `secretOrKey` lui donne la clé pour vérifier la signature, `ignoreExpiration: false` lui dit de rejeter un jeton expiré. Si la signature est fausse ou le jeton expiré, `validate()` n'est **jamais appelée** — la requête est directement coupée.
2. **`validate()` ne s'exécute que sur un jeton déjà authentifié.** Elle ne revérifie rien — son seul rôle est de décider quoi exposer ensuite. Ce qu'elle retourne devient automatiquement `request.user`, disponible dans n'importe quel controller derrière.

## 4. Le guard — brancher la stratégie sur une route

Une stratégie seule ne fait rien tant qu'elle n'est pas rattachée à une route. C'est le rôle du guard :

```ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Et sur le controller :

```ts
@UseGuards(JwtAuthGuard)
@Get('me')
me(@Req() req: Request) {
  return req.user;
}
```

`@UseGuards(JwtAuthGuard)` s'exécute **avant** le corps de `me()`. Si le jeton est absent ou invalide, la méthode `me()` n'est jamais appelée du tout — le guard répond `401 Unauthorized` directement.

## 5. Le trajet complet, de la connexion à la route protégée

```
POST /auth/login  { email, password }
        │
        ▼
AuthService vérifie le mot de passe (bcrypt.compare)
        │
        ▼
JwtService.sign({ sub, email })  →  accessToken
        │
        ▼
Le client stocke ce token, et le renvoie à chaque requête suivante :
        Authorization: Bearer <accessToken>
        │
        ▼
GET /auth/me
        │
        ▼
JwtAuthGuard → JwtStrategy vérifie signature + expiration
        │
        ├── invalide/absent → 401, me() jamais appelée
        │
        └── valide → validate() → request.user rempli → me() s'exécute
```

| Situation | Résultat |
|---|---|
| Pas d'en-tête `Authorization` | `401 Unauthorized` |
| Jeton présent mais expiré ou signature invalide | `401 Unauthorized` |
| Jeton valide | La route s'exécute, `request.user` disponible |

## Le fil conducteur

Un JWT remplace la question "est-ce que je connais cet utilisateur ?" par "est-ce que je peux vérifier que ce jeton vient bien de moi ?" — le serveur n'a besoin de retenir aucun état, juste de savoir vérifier une signature. Passport standardise *comment* on brasse cette vérification (et n'importe quelle autre méthode d'authentification) dans le cycle de vie d'une requête NestJS, via le duo stratégie (la logique de vérification) + guard (le point d'accroche sur une route). Une fois ce mécanisme posé une fois, protéger une nouvelle route ne demande plus qu'une ligne : `@UseGuards(JwtAuthGuard)`.

coucou
