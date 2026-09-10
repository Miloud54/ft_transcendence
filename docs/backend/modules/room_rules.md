# Room --- Rules & Domain

## 1. Purpose

A **Room** is a persistent space where several players can gather to play together.

A Room contains or is associated with:
-   the players currently in the Room;
-   the user who created the Room;
-   the current Room status;
-   the minimum and maximum number of players;
-   a current Game, when a game is running;
-   a chat associated with the Room.

The Room and the Game are two distinct concepts.

**Room and Game are distinct concepts.** A Room may survive after a Game ends and potentially be reused for another Game.

------------------------------------------------------------------------

## 2. Model

A Room minimally contains:

  Property       Description
  -------------- ------------------------------------------
  `id`           Unique Room identifier
  `creatorId`    User who created the Room
  `players`      Players currently in the Room
  `status`       Current Room status
  `minPlayers`   Minimum players required to start a Game
  `maxPlayers`   Maximum players allowed

Additional properties may be added later.

### Creator

`creatorId` identifies the user who created the Room. It does **not** imply ownership or additional privileges: players are considered equal by default.

Creator-specific permissions may be introduced later.

------------------------------------------------------------------------

## 3. Status & lifecycle

``` text
                 startGame()
OPEN ─────────────────────────► STARTING
 ▲                                │
 │                                │ countdown finished
 │                                ▼
 └──────────────────────────── IN_GAME
```

The Room has four initial statuses:

-   **`OPEN`** --- Lobby is available. Players may join/leave and
    invitations may be handled according to the invitation rules. A Game
    may be started if the player-count conditions are met.
-   **`STARTING`** --- A Game is about to start. A 10-second preparation
    countdown is planned. New players cannot join.
-   **`IN_GAME`** --- A Game is currently running. New players cannot
    join.
-   **`CLOSED`** --- Room is unavailable. Its exact meaning and entry
    conditions remain to be defined.

A Room may be reused for multiple Games:

``` text
OPEN → STARTING → IN_GAME → OPEN → STARTING → IN_GAME → ...
```

The exact conditions for `IN_GAME → OPEN` remain to be finalized.

`CLOSED` is intended to represent a Room-level closure, not simply the
end of a Game.

------------------------------------------------------------------------

## 4. Core operations

### `createRoom()`

Creates a new Room with:

``` text
creatorId = creating user
players   = [creating user]
status    = OPEN
```

Creating a Room and starting a Game are separate operations.

The exact moment when a Game is created/associated with the Room remains
to be decided.

### `addPlayer()`

A player can be added only when:

``` text
status == OPEN
AND
playerCount < maxPlayers
```

A player cannot be present more than once.

Invitation/search rules are partly defined but remain to be finalized.

### `startGame()`

Starting a **Game**, not the Room, is triggered by any player currently
in the Room when:

``` text
status == OPEN
AND
playerCount >= minPlayers
AND
playerCount <= maxPlayers
```

The transition is:

``` text
OPEN → STARTING
```

The backend must validate these conditions; frontend controls are only
UX.

After the 10-second preparation countdown:

``` text
STARTING → IN_GAME
```

The actual Game lifecycle is handled by the Game Engine.

### `leaveRoom()`

Players may leave voluntarily or leave involuntarily because of events
such as connection loss or browser closure.

The exact allowed voluntary-leave actions and the consequences of
leaving/disconnecting are intentionally not defined yet.

------------------------------------------------------------------------

## 5. Joining rules

For the initial version:

  Status         Join
  ------------ ------
  `OPEN`           ✅
  `STARTING`       ❌
  `IN_GAME`        ❌
  `CLOSED`         ❌

Joining a Game that has already started is therefore not supported
initially.

------------------------------------------------------------------------

## 6. Connection & disconnection

Connection handling is not defined yet.

Potential player connection states:

``` text
CONNECTED
DISCONNECTED
RECONNECTED
LEFT
```

These should not be implemented prematurely in the Room domain.

Future decisions include:
- voluntary leave rules by Room status
- consequences of disconnection
- whether and for how long a player can reconnect
- whether a disconnected player keeps their place
- behavior during `STARTING` and `IN_GAME`
- consequences when the creator leaves
- whether the creator can be replaced

------------------------------------------------------------------------

## 7. Room vs Game responsibilities

### Room

Responsible for:

``` text
✓ Room identity
✓ Creator and players
✓ Room status
✓ Player limits
✓ Joining / leaving
✓ Starting a Game
✓ Room lifecycle
```

### Game / Game Engine

Not handled by Room:

``` text
✗ Mystery word
✗ Guess validation / analysis
✗ Semantic proximity
✗ Scores
✗ Rankings
✗ Game-specific player states
✗ Game completion rules
✗ Pedantix logic
```

The Room may reference a current Game, but does not manage the Game's internal rules.

------------------------------------------------------------------------

## 8. Initial invariants

-   A Room has exactly one creator.
-   The creator is initially a player.
-   A new Room starts as `OPEN`.
-   A player cannot appear twice in the same Room.
-   `playerCount` cannot exceed `maxPlayers`.
-   New players can only join while `OPEN`.
-   A Game can only be started from `OPEN`.
-   `startGame()` requires `minPlayers <= playerCount <= maxPlayers`.
-   Any player in the Room may trigger `startGame()`.
-   Starting a Game changes the Room to `STARTING`.
-   The preparation countdown occurs during `STARTING`.
-   Countdown completion changes the Room to `IN_GAME`.
-   A Room may host multiple Games over its lifetime.

------------------------------------------------------------------------

## 9. Open decisions

The following are intentionally left unresolved for now:

-   Exact meaning and closure conditions of `CLOSED`.
-   Default `minPlayers` and `maxPlayers`.
-   Voluntary `leaveRoom()` rules for each status.
-   Consequences of voluntary leave and involuntary disconnect.
-   Reconnection behavior and time limits.
-   Game cancellation and its effect on the Room.
-   Whether additional Room statuses will be needed later.
