# Les DTO, expliqués avec RegisterDto et LoginDto

## 1. C'est quoi, un DTO

DTO = **Data Transfer Object**. Une classe simple, sans logique, qui décrit *la forme exacte* des données qui traversent une frontière — typiquement, ce qu'un client envoie à une route de l'API.

Ce n'est pas un modèle de base de données. C'est un contrat : "voici ce que j'accepte en entrée, ni plus ni moins."

```ts
export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Rien qu'en lisant cette classe, on sait exactement ce qu'une requête `POST /auth/register` doit contenir, sans avoir à aller lire le code du controller ou du service.

## 2. Pourquoi ne pas juste utiliser le modèle Prisma directement

Le modèle `User` de `schema.prisma` a des champs comme `user_id`, `xp`, `lvl`, `status`, `avatar` — des choses que la base de données gère, pas des choses qu'un utilisateur qui s'inscrit devrait pouvoir fournir lui-même.

Si le controller acceptait n'importe quel objet ressemblant à un `User` en entrée, rien n'empêcherait une requête malveillante du type :

```json
{
  "username": "hacker",
  "email": "hacker@test.com",
  "password": "motdepasse123",
  "xp": 999999,
  "lvl": 99,
  "status": "ONLINE"
}
```

Le DTO résout ça juste en ne déclarant pas ces champs : `xp`, `lvl`, `status` n'existent pas dans `RegisterDto`. Combiné à `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` (configuré dans `main.ts`), NestJS **rejette carrément la requête** si un champ non prévu est envoyé — pas besoin de vérifier ça à la main dans chaque service.

Trois raisons de séparer DTO et modèle Prisma :

| | Modèle Prisma (`schema.prisma`) | DTO |
|---|---|---|
| Décrit | La structure réelle en base de données | Ce qu'une requête HTTP a le droit de contenir |
| Contient | Tous les champs, y compris ceux gérés par le serveur (`user_id`, `xp`...) | Seulement les champs que le client doit fournir |
| Change quand | Le schéma de données évolue | Le contrat de l'API évolue |
| Exemple | `User` (12 champs, relations incluses) | `RegisterDto` (3 champs) |

## 3. Le lien avec la validation

Les décorateurs (`@IsEmail()`, `@IsString()`, `@MinLength(8)`...) viennent de `class-validator`. Seuls, ils ne font rien — c'est `ValidationPipe`, branché une fois pour toute l'API dans `main.ts`, qui les lit automatiquement à chaque requête entrante et rejette celles qui ne passent pas, avec une erreur `400` claire.

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

Concrètement : personne n'écrit `if (!email.includes('@')) throw ...` à la main dans `AuthService`. Le DTO porte la règle, le pipe l'applique, le service n'a jamais à s'en soucier — il reçoit toujours des données déjà valides.

## 4. Deux DTO différents pour deux routes différentes

`LoginDto` ressemble à `RegisterDto` mais n'est **pas** le même :

```ts
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

Pas de `username`, pas de `@MinLength(8)` sur le mot de passe. À la connexion, on ne valide pas la *force* d'un mot de passe (ce n'est plus le moment de l'exiger), juste qu'une chaîne a bien été envoyée. Un DTO correspond à *une action précise*, pas à *une entité* — c'est pour ça qu'on en a plusieurs plutôt qu'un seul "UserDto" générique réutilisé partout.

## 5. Et dans l'autre sens — ce qu'on renvoie

Un DTO d'entrée décrit ce qu'on reçoit. Mais ce qu'on **renvoie** au client mérite le même soin, pour une raison différente cette fois : ne jamais exposer plus que nécessaire.

Dans `AuthService`, la fonction `toPublicUser()` prend l'objet `User` complet tel que Prisma le renvoie, et n'en garde qu'une partie :

```ts
function toPublicUser(user: UserRecord) {
  return {
    id: user.user_id.toString(),
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    xp: Number(user.xp),
    lvl: Number(user.lvl),
    status: user.status,
  };
}
```

Deux choses s'y passent en même temps :
- **`password` disparaît complètement** — même hashé, il n'a aucune raison de sortir de l'API un jour.
- **`user_id`, `xp`, `lvl` sont convertis** depuis `BigInt` (le type Prisma) vers `string`/`number` — parce que `JSON.stringify` ne sait pas sérialiser un `BigInt` et ferait planter la réponse sinon.

Ce n'est pas une classe avec des décorateurs comme les DTO d'entrée, mais le principe est identique : ne jamais faire transiter le modèle de base de données brut à travers une frontière (API, ou même le payload d'un JWT) sans être passé par une forme explicite et contrôlée.

## Le fil conducteur

Le modèle Prisma décrit *la vérité* — ce qui existe réellement en base. Le DTO décrit *le contrat* — ce qu'une route accepte en entrée, ou ce qu'elle promet en sortie. Les deux se ressemblent souvent, mais les confondre revient à laisser la structure interne de la base dicter ce que n'importe quel client peut envoyer ou voir — exactement le genre de raccourci qui devient un problème de sécurité le jour où quelqu'un l'exploite.
