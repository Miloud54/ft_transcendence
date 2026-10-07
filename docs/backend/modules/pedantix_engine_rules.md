# Pedantix Engine --- Rules & Domain

## 1. Purpose

The **Pedantix Engine** contains the gameplay logic specific to Transcendix.

It is distinct from the **Game** lifecycle:

-   **Game** manages the technical lifecycle of a game session;
-   **Pedantix Engine** manages what happens *inside* that game according to the Pedantix/Transcendix rules.

The initial Game lifecycle remains:

``` text
COUNTDOWN → RUNNING → FINISHED
```

The Pedantix Engine provides the gameplay state required by the frontend.
The Engine must not manage WebSocket transport directly.

## 2. Responsibilities

The Pedantix Engine is responsible for:

-   selecting a mystery Wikipedia article;
-   preparing the article for gameplay;
-   representing the hidden words/tokens that can be revealed;
-   receiving and normalizing player guesses;
-   determining whether a guess matches one or more hidden words;
-   evaluating semantic proximity for guesses that do not match;
-   assigning a proximity result that the frontend can display;
-   tracking each player's gameplay progression;
-   determining when a player has found the mystery word;
-   determining gameplay-related end conditions;
-   maintaining the game state required to produce final results;
-   optionally requesting/generating AI hints.

The Engine is **not** responsible for:

-   managing the technical Game lifecycle;
-   managing WebSocket connections;
-   rendering the frontend;
-   exposing API keys to clients.

## 3. Position in the backend architecture

The initial architecture is:

``` text
                    ┌───────────────┐
                    │     Room      │
                    │               │
                    │ Lobby /       │
                    │ players       │
                    └───────┬───────┘
                            │ starts
                            ▼
                    ┌───────────────┐
                    │     Game      │
                    │               │
                    │ COUNTDOWN     │
                    │ RUNNING       │
                    │ FINISHED      │
                    └───────┬───────┘
                            │ owns / coordinates
                            ▼
                  ┌────────────────────┐
                  │  Pedantix Engine   │
                  │                    │
                  │ Article            │
                  │ Hidden words       │
                  │ Guesses            │
                  │ Proximity          │
                  │ Progression        │
                  │ Scores             │
                  │ End conditions     │
                  └─────────┬──────────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
          AI / LLM provider       Wikipedia provider
```

The Engine should therefore be implemented as a **distinct NestJS module**, rather than as a sub-folder containing all the Pedantix logic inside `GameService`.

The Game module may import/use the Pedantix Engine module.
The Engine may expose services/interfaces to the Game module without owning the Game lifecycle itself.

## 4. Preparation during COUNTDOWN

When a Game enters `COUNTDOWN`, the Pedantix Engine should prepare the gameplay data.

The preparation may include:

1.  selecting a mystery article;
2.  retrieving the article from the configured Wikipedia source;
3.  extracting the usable article content;
4.  tokenizing the text into words/tokens;
5.  identifying which characters remain visible;
6.  creating the hidden-word representation;
7.  preparing the information needed for the frontend;
8.  preparing the semantic-analysis context.

The preparation should ideally complete during the existing 10-second Game countdown. The countdown therefore provides a natural preparation window.

The Engine must not depend on the countdown being long enough to
guarantee completion. If preparation cannot complete, the Game must not
enter `RUNNING` with an invalid or incomplete gameplay state.

## 5. Mystery article

Each Game has exactly one mystery article.

The article source is initially expected to be **English Wikipedia**.

The Engine should not hard-code the external API throughout the gameplay
logic.

Instead, an abstraction such as:

``` text
WikipediaProvider / ArticleProvider
```

should be used.

This makes it possible to:

-   change the API later;
-   use a local dataset for tests;
-   use predefined demonstration articles;
-   mock article retrieval in automated tests;
-   avoid coupling the whole Engine to one external service.

### Article selection

The first version should select an article randomly from an eligible set.

The exact eligibility rules remain to be finalized.

Potential criteria include:

-   article language;
-   minimum amount of usable text;
-   exclusion of disambiguation pages;
-   exclusion of redirects;
-   exclusion of unsuitable namespaces;
-   minimum/maximum article size;
-   popularity or number of page views;
-   exclusion of articles considered too obscure.

Popularity should be treated as a **selection criterion**, not as
gameplay logic.

## 6. Article library

Two sources of articles may coexist:

### Production article source

Articles are selected dynamically from the configured source.
This avoids having to manually maintain a complete database of articles.

### Curated article set

A small set of predefined articles should be kept for:
-   tests;
-   development;
-   frontend integration;
-   demonstrations.

The curated set must not necessarily be used in normal production games.

The architecture should allow the Engine to use either a live provider
or a deterministic test provider.

## 7. Hidden article representation

The frontend must be able to display the article while hiding the words
that players have not discovered.

The backend is responsible for determining which parts are hidden.

For each displayed token, the backend may expose information such as:

``` text
{
  id,
  displayForm,
  length,
  hidden,
  revealed
}
```

The exact DTO remains to be defined.

### Visible characters

Characters that are not considered part of a word may remain visible.

Examples may include:

``` text
'
%
-
,
.
(
)
:
;
```

The exact tokenization rules must be defined during implementation.

The important invariant is:

> The frontend must be able to reconstruct the visible article layout without receiving the hidden answers.


## 8. Word matching

A player's guess may correspond to a hidden word even when it is not an
exact string match.

The first version should support reasonable linguistic variations.

Examples:

``` text
a ↔ an
run ↔ runs
run ↔ running
played ↔ play
```

The matching process should therefore include deterministic normalization before using AI.

Possible normalization steps:

-   trim whitespace;
-   case folding;
-   Unicode normalization;
-   punctuation normalization where appropriate;
-   handling of common grammatical variants.

A dedicated matching component should then determine whether the normalized guess corresponds to a hidden token.

The exact linguistic rules remain to be finalized.

------------------------------------------------------------------------

## 9. AI semantic proximity

A guess that does not match a hidden word should receive a semantic proximity result.

The project will use an **LLM/AI service** rather than attempting to reproduce the original Pedantix semantic-vector system.

The AI integration should be isolated behind an interface such as:

``` text
SemanticAnalyzer
```

The Engine should not directly depend on one specific provider.

For example:

``` text
PedantixEngine
      │
      ▼
SemanticAnalyzer
      │
      ▼
LLM provider
```

This allows the provider to be changed without rewriting the gameplay
logic.

### Proximity result

The Engine should preferably work with a normalized numerical result
rather than a frontend-specific color.

For example:

``` text
semanticScore: 0..100
```

or:

``` text
semanticScore: 0..1
```

The frontend can then map the score to the project's chosen cold → warm → hot color scale.

The backend may also expose a semantic category if useful:

``` text
COLD
COOL
WARM
HOT
VERY_HOT
```

The exact scale remains an open decision.

### Important constraint

The LLM should not be trusted with the entire game state.

The backend remains authoritative for:

-   the mystery article;
-   hidden words;
-   whether a word has been found;
-   player progression;
-   game completion.

The AI provides an analysis result; it does not decide the overall Game state.

## 10. Guess processing

A player's guess follows approximately this flow:

``` text
Player guess
     │
     ▼
Input validation
     │
     ▼
Normalization
     │
     ▼
Exact / linguistic matching
     │
     ├── match found ──────► reveal matching word(s)
     │
     └── no match
             │
             ▼
       SemanticAnalyzer
             │
             ▼
       proximity result
```

The Engine should return a structured result that the transport layer can send to the frontend.

A result may contain:

``` text
guess
matchedWords
semanticScore
semanticCategory
playerProgress
newlyFound
gameEndState
```

The exact DTO remains to be defined.

## 11. Player progression

Each Game player has a gameplay state separate from their Room membership.

The Engine tracks at least:

-   whether the player is still playing;
-   which words they have discovered;
-   whether they have found the mystery word;
-   discovery time/order;
-   score;
-   other statistics required for final results.

The Game rules currently define the conceptual states:

``` text
PLAYING
FOUND
FINISHED
```

The Engine should provide the gameplay information needed by the Game to determine the final state.

## 12. Mystery word / winning condition

The Engine is responsible for detecting when a player has found the mystery word.

When a player finds it:

-   that player is marked as having found it;
-   the Game does not necessarily finish immediately;
-   other players may continue playing;
-   the Engine records the discovery order/time;
-   the Game's post-discovery end condition is evaluated.

The current Game rules specify that the Game may finish when:

``` text
all players have found the word
```

or:

``` text
at least one player has found the word
AND
the post-discovery countdown expires
```

The exact durationremain Game-level open decisions.

## 13. Scores

Scoring is intentionally not finalized at this stage.

The Engine will eventually calculate player scores from gameplay
information such as:

-   discovery order;
-   time to discovery;
-   number of successful guesses;
-   number of guesses;
-   hints used;
-   other gameplay criteria decided later.

## 14. AI-generated hints

An optional AI hint system may be added.

A hint request would follow approximately:

``` text
Player requests hint
        │
        ▼
PedantixEngine
        │
        ▼
HintGenerator
        │
        ▼
LLM provider
        │
        ▼
Hint result
```

Hints must not directly reveal the mystery word.
The exact hint rules remain open.

## 15. Frontend contract

The Pedantix Engine produces **structured backend data**.

That data can be serialized as JSON by the REST/WebSocket transport layer.

For example:

``` text
Backend
  │
  ├── PedantixEngine
  │       │
  │       └── gameplay state/result
  │
  └── Controller / WebSocket Gateway
          │
          └── JSON message
                    │
                    ▼
                 Frontend
```

The frontend therefore accesses the Engine indirectly.

The exact transport mechanism remains to be designed, but gameplay updates are expected to use **WebSockets** because guesses and discoveries must be synchronized between players in real time.

REST endpoints may be used for operations where real-time delivery is not required.

The frontend should never call the AI provider or Wikipedia provider directly.

## 16. Persistence

Information that must survive the end of the Game:

-   Game result;
-   player score;
-   discovery order;
-   statistics required by the dashboard/history.

The exact database schema should be finalized after the gameplay model
is stable.

The existing `Games` and `Game_players` tables provide the current
Game/player relationship, but additional gameplay/result fields may be
required later.

## 17. Initial module structure

A possible NestJS structure is:

``` text
backend/src/
├── room/
│   ├── room.module.ts
│   ├── room.controller.ts
│   └── room.service.ts
│
├── game/
│   ├── game.module.ts
│   ├── game.controller.ts
│   └── game.service.ts
│
└── pedantix-engine/
    ├── pedantix-engine.module.ts
    ├── pedantix-engine.service.ts
    │
    ├── article/
    │   ├── article.ts
    │   ├── article.provider.ts
    │   ├── wikipedia.provider.ts
    │   └── article-selector.service.ts
    │
    ├── words/
    │   ├── word-matcher.service.ts
    │   ├── tokenizer.service.ts
    │   └── normalizer.service.ts
    │
    ├── semantic/
    │   ├── semantic-analyzer.ts
    │   └── llm-semantic-analyzer.service.ts
    │
    ├── hints/
    │   └── hint-generator.service.ts
    │
    └── dto/
        ├── game-board.dto.ts
        └── guess-result.dto.ts
```

This is a proposed organization, not a requirement that every file must exist immediately.

The module should be kept sufficiently modular so that individual providers can be replaced or mocked.

## 18. Initial invariants summary

-   A Game has exactly one mystery article.
-   The mystery article is selected before the Game enters `RUNNING`.
-   The complete mystery article is never sent to the frontend.
-   Hidden answers remain server-side.
-   The backend is authoritative for gameplay state.
-   A guess is processed by the Pedantix Engine.
-   A guess can reveal one or more matching hidden words.
-   A non-matching guess may receive a semantic proximity result.
-   Semantic proximity is provided by an AI-backed abstraction.
-   The frontend receives structured data, not direct access to the Engine internals.
-   WebSockets are used for real-time gameplay synchronization.
-   The Engine does not manage Room status.
-   The Engine does not manage the technical Game lifecycle.
-   AI provider failures must not corrupt the Game state.
-   API keys and internal prompts remain server-side.
-   Final scores are determined by the backend.


**~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~**  
**~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~**  

# Pedantix Engine related notes

## Wikipedia's 3 APIs

Combination of the 3 APIs to have all the information we need.



                   ArticleProvider
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     Action API      REST API       Pageviews API
          │              │              │
     sélection /       contenu        popularité
      filtres          HTML
          │              │              │
          └──────────────┴──────────────┘
                         │
                         ▼
                 Transcendix Article

ArticleProvider  
    └── getCandidateArticle()  
    └── getArticleContent()  


Action API : https://en.wikipedia.org/w/api.php

## Rules for a candidate Article

1. title de la page = mot/article mystère à trouver
- Exemple : Jupiter
- Il sera évidemment caché au joueur.
2. On ne prend que le contenu introductif, c'est-à-dire les paragraphes situés avant le premier titre de section.
- Pour Jupiter : les 5 paragraphes allant de Jupiter is the fifth planet... jusqu'à Jupiter-like exoplanets....
- On s'arrête avant Name and symbol.
3. On impose une taille minimale et maximale :
- minimum : 3 paragraphes
- maximum : 12 paragraphes
- ces valeurs seront configurables/modifiables plus tard.
4. Si l'article contient moins de 3 paragraphes introductifs → article rejeté.
5. S'il en contient plus de 12 → on ne prend que les 12 premiers.
6. Dans ces paragraphes :
- texte → ✅
- liens → ✅, mais uniquement leur texte
- références [22], [23], etc. → ❌
- images → ❌
- tableaux → ❌
- autres éléments non jouables → ❌
7. Pour le futur plateau :
- lettres et nombres → éléments potentiellement cachables
- caractères spéciaux (., ,, ', -, (, ), %, etc.) → affichés directement.

## Distinct Article states :

1. Article --> représentation nettoyée de wikipedi

Article
├── id
├── url
├── title
└── paragraphs
    ├── paragraph 1
    ├── paragraph 2
    ├── ...
    └── paragraph N

------------ 

Traduction en Typescript :

export interface Article {
    id: number;
    url: string;
    title: string;
    paragraphs: string[];
}

------------

Exemple :

const article: Article = {
    id: 38930,
    url: "https://en.wikipedia.org/wiki/Jupiter",
    title: "Jupiter",
    paragraphs: [
        "Jupiter is the fifth planet from the Sun...",
        "Jupiter was the first of the Sun's planets to form...",
        "The outer atmosphere is divided...",
        // ...
    ],
};

------------

2. ArticleReadyForGame --> transformation de l'article por le jeu

Article {
    words: ...
    hiddenWords: ...
    revealedWords: ...
}

-----

Ajout de cheerio dans les packages json.
C'est un outil pour parser du HTML.
https://cheerio.js.org/
(installer via les npm du début)

Ajout de franc dans les packages json.
C'est un outil pour détecter la langue et s'assurer que l'article soit en anglais

-----

Pour lancer les tests de spec :

docker compose exec backend npx jest src/pedantix-engine/article/wikipedia.provider.spec.ts --runInBand

docker compose exec backend npx jest src/pedantix-engine/article/article-selector.service.spec.ts --runInBand
