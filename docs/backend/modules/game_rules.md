# Game --- Rules & Domain

## 1. Purpose

A **Game** represents one actual game session played inside a Room.

A Game manages:
- its lifecycle and current status;
- the players participating in that Game;
- each player's Game-specific state;
- the conditions for ending the Game;
- final results and rankings.

The Game is distinct from the Room: a Room is the persistent multiplayer space, while a Game represents one specific play session. A Room may host multiple Games over its lifetime.

```text
Room
├── players
├── status
└── current Game
     ├── status
     ├── players
     └── results
```

---

## 2. Model

A Game minimally contains or is associated with:

| Property | Description |
|---|---|
| `id` | Unique Game identifier |
| `roomId` | Room containing the Game |
| `status` | Current Game status |
| `players` | Players participating in this Game |
| `startedAt` | Time at which the Game starts running |
| `finishedAt` | Time at which the Game finishes |

Additional properties may be added later.

---

## 3. Status & lifecycle

The Game has three initial statuses:

```text
COUNTDOWN
RUNNING
FINISHED
```

The intended lifecycle is:

```text
COUNTDOWN
    │
    │ countdown finished
    ▼
RUNNING
    │
    │ end condition reached
    ▼
FINISHED
```

### `COUNTDOWN`

The Game has been triggered because the Room meets the conditions required to start a Game.

A preparation countdown of **10 seconds** is currently planned. This may give players time to prepare before the active Game begins.

At the end of the countdown:

```text
COUNTDOWN → RUNNING
```

The backend is the source of truth for the countdown and Game state.

### `RUNNING`

The Game is actively being played.

Players participating in the Game can progress according to the rules defined by the Game and Pedantix Engine.

No new players can join once the Game has started.

### `FINISHED`

The Game has ended and its final results can be determined.

After the Game finishes, the Room may return to `OPEN` and be reused for another Game.

---

## 4. Starting a Game

A Game is started from a Room.

The Room must be:

```text
status == OPEN
AND
minPlayers <= playerCount <= maxPlayers
```

Any player currently in the Room may trigger the start of a Game.

The resulting lifecycle is:

```text
Room: OPEN → STARTING → IN_GAME

Game: COUNTDOWN → RUNNING
```

The Room and Game therefore have separate state machines.

The frontend may disable the Start button when the conditions are not met, but the backend must validate them.

---

## 5. Players

A Game has its own representation of the players participating in that Game.

This is distinct from the Room's current player list.

Each participating player has a Game-specific state.

Initial states considered:

```text
PLAYING
FOUND
FINISHED
```

A possible additional state such as:

```text
WAITING_ON_THE_OTHERS_TO_FIND_THE_WORD
```

may be introduced if required.

The exact states and transitions remain to be finalized.

---

## 6. Finding the mystery word

When a player finds the mystery word:

- the Game **does not end immediately**;
- that player is marked as having found the word;
- the other players continue playing;
- a countdown starts, giving the remaining players a limited amount of time to find the word.

The duration of this post-discovery countdown remains to be defined (for example, 5 minutes).

The Game finishes when either:

```text
all players have found the word
```

or:

```text
at least one player has found the word
AND
the post-discovery countdown has expired
```

The exact end-condition implementation remains to be finalized.

---

## 7. Results & ranking

The Game must be able to produce final results.

Two ranking dimensions are currently considered:

1. **Discovery order** — order in which players found the mystery word.
2. **Score ranking** — players ordered by their final score.

The preferred approach is to expose both rankings, subject to final confirmation.

The scoring algorithm and tie-breaking rules remain to be defined.

---

## 8. Joining an ongoing Game

For the initial version:

```text
Game already started → no new player
```

A player cannot join once the Game has entered its active lifecycle.

This may evolve later if late joining becomes desirable.

---

## 9. Ending and Room reuse

When the Game reaches `FINISHED`, it no longer accepts game actions.

The Room may then return to:

```text
IN_GAME → OPEN
```

allowing another Game to be started without recreating the Room.

The exact coordination between Game completion and the Room's transition back to `OPEN` remains to be finalized.

---

## 10. Initial invariants

- A Game belongs to one Room.
- A Game represents one specific game session.
- A Game has exactly one current status.
- The initial lifecycle is `COUNTDOWN → RUNNING → FINISHED`.
- The preparation countdown is currently planned at 10 seconds.
- The backend is the source of truth for Game state and timing.
- No new player can join once the Game has started in the initial version.
- Finding the word does not immediately finish the Game.
- A player who finds the word can be marked `FOUND` while the Game remains `RUNNING`.
- A post-discovery countdown limits the time available to remaining players.
- The Game can finish when everyone has found the word or when the post-discovery countdown expires after the first discovery.
- A finished Game can allow its Room to be reused for another Game.

---

## 11. Open decisions

- Exact Game end-condition behavior in edge cases.
- Scoring algorithm.
- Ranking tie-breakers.
- Exact final result representation.
- Whether additional Game statuses (e.g. `PAUSED`) will be needed.
- Whether late joining may be supported in a future version.
