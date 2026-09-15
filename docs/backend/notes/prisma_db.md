# Les bases de données relationnelles, expliquées avec schema.prisma

## 1. Tables et colonnes

Une **table** représente une entité (les utilisateurs, les articles, les commandes...). Chaque **colonne** représente une propriété de cette entité, avec un type précis (texte, nombre, date, booléen...).

Pense à une table comme un tableau Excel : chaque ligne = un enregistrement, chaque colonne = une info sur cet enregistrement.

En Prisma, une table = un `model` :

```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String
  email String
  age   Int
}
```

Ici, `User` deviendra une vraie table SQL nommée `User` (ou `users` selon la config), avec les colonnes `id`, `name`, `email`, `age`.

## 2. Les IDs et pourquoi on utilise des identifiants uniques

Deux utilisateurs peuvent s'appeler "Marie Dupont". Le nom ne suffit pas à les distinguer de façon fiable. On a besoin d'un identifiant **unique et stable** pour chaque ligne — c'est l'ID.

Ça sert à :
- Retrouver une ligne précise sans ambiguïté
- Faire le lien entre les tables (voir clés étrangères plus bas)
- Éviter les doublons accidentels

En Prisma :

```prisma
model User {
  id String @id @default(uuid())
  // ...
}
```

Deux stratégies courantes :
- `@default(autoincrement())` → 1, 2, 3, 4... (simple, lisible, mais prévisible)
- `@default(uuid())` → un identifiant aléatoire du type `a3f9c1e2-...` (plus sûr pour une API publique, car on ne peut pas deviner l'ID suivant)

## 3. Clés primaires et clés étrangères

**Clé primaire (Primary Key)** : l'ID qui identifie de façon unique chaque ligne d'une table. En Prisma, c'est le champ marqué `@id`.

**Clé étrangère (Foreign Key)** : une colonne qui contient l'ID d'une ligne d'une *autre* table, pour créer un lien entre elles.

Exemple : chaque `Post` (article) appartient à un `User` (auteur).

```prisma
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}
```

Ici, `authorId` est la clé étrangère : elle stocke l'`id` d'un `User`. C'est ce qui permet à SQL de savoir "cet article appartient à cet utilisateur".

## 4. Les relations entre tables

### One-to-One (1-1)
Une ligne d'une table correspond à exactement une ligne d'une autre. Exemple : un utilisateur a un seul profil détaillé.

```prisma
model User {
  id      Int      @id @default(autoincrement())
  profile Profile?
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String
  user   User   @relation(fields: [userId], references: [id])
  userId Int    @unique
}
```

Le `@unique` sur `userId` est ce qui force la relation à rester "un seul profil par utilisateur" (sinon ce serait du 1-N).

### One-to-Many (1-N)
Une ligne d'une table peut être liée à plusieurs lignes d'une autre. C'est le cas le plus courant. Exemple vu plus haut : un utilisateur a plusieurs posts, mais un post a un seul auteur.

```prisma
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]   // "many" côté User
}

model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
  authorId Int  // "one" côté Post
}
```

### Many-to-Many (N-N)
Plusieurs lignes d'une table peuvent être liées à plusieurs lignes d'une autre. Exemple : un article peut avoir plusieurs tags, et un tag peut être sur plusieurs articles.

```prisma
model Post {
  id   Int    @id @default(autoincrement())
  tags Tag[]
}

model Tag {
  id    Int    @id @default(autoincrement())
  posts Post[]
}
```

En interne, SQL ne peut pas représenter du N-N directement — il crée une **table de jonction** invisible (ou explicite) qui contient des paires `(postId, tagId)`. Prisma gère ça automatiquement dans ce cas simple ; si tu as besoin de stocker des infos sur la relation elle-même (par ex. une date d'ajout du tag), tu dois créer cette table de jonction toi-même de façon explicite.

## 5. Les requêtes SQL de base

Sous le capot, Prisma génère ces requêtes SQL pour toi (via son "Client"), mais voici ce qu'elles font :

| Requête | Rôle | Équivalent Prisma Client |
|---|---|---|
| `SELECT` | Lire des données | `prisma.user.findMany()` |
| `INSERT` | Ajouter une ligne | `prisma.user.create()` |
| `UPDATE` | Modifier une ligne existante | `prisma.user.update()` |
| `DELETE` | Supprimer une ligne | `prisma.user.delete()` |
| `JOIN` | Combiner des données de plusieurs tables liées | `prisma.user.findMany({ include: { posts: true } })` |

Exemple concret — récupérer un utilisateur avec tous ses articles (ça fait un JOIN en coulisses) :

```javascript
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true }
});
```

## 6. Les migrations

Le **schéma** de ta base de données (quelles tables, quelles colonnes, quels types) va évoluer au fil du projet. Une **migration** est un fichier qui décrit précisément comment passer d'une version du schéma à la suivante — un peu comme un historique Git, mais pour la structure de la base.

Pourquoi c'est important :
- Ça permet de reproduire exactement la même structure de DB en dev, en staging et en prod
- Ça garde un historique traçable des changements ("on a ajouté la colonne `age` le 3 mars")
- Ça évite de devoir modifier la base à la main, ce qui est risqué et pas reproductible

Avec Prisma, le flux est simple : tu modifies `schema.prisma`, puis tu lances :

```bash
npx prisma migrate dev --name add_age_to_user
```

Ça compare ton nouveau schéma à l'ancien, génère un fichier SQL de migration dans `prisma/migrations/`, et l'applique à ta base locale.

## 7. Les seeds

Un **seed** sert à insérer des données initiales ou de test dans la base, automatiquement, plutôt qu'à la main. Utile pour :
- Avoir des données de démo dès le premier lancement du projet
- Avoir toujours le même jeu de données de test en dev (pratique pour déboguer ou pour que toute l'équipe travaille sur la même base)
- Peupler des tables de référence (ex: une liste de rôles, de catégories fixes)

Avec Prisma, tu écris un script `prisma/seed.ts` :

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: { name: 'Alice', email: 'alice@test.com', age: 25 }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Puis tu déclares le script dans `package.json` :

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Et tu l'exécutes avec :

```bash
npx prisma db seed
```

## Le fil conducteur

`schema.prisma` est le fichier central qui décrit *tout* ton schéma relationnel en un seul endroit lisible — tables, colonnes, IDs, relations. Prisma se charge ensuite de traduire ça en vrai SQL (via les migrations) et de générer un client JavaScript/TypeScript typé pour que tu n'aies jamais à écrire du SQL brut toi-même au quotidien.