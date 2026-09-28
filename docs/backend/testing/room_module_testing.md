# Room Module: Changes and Manual Testing

## Implemented changes

The Room module now supports the initial lifecycle described in `room_rules.md`:

- `POST /rooms` creates an `OPEN` room and adds the authenticated user as its first player.
- `POST /rooms/:roomId/join` joins an `OPEN` room when it is not full.
- Joining the same room more than once does not add a duplicate player.
- `POST /rooms/:roomId/start` allows any current room player to start a game when the player count is between `minPlayers` and `maxPlayers`.
- Starting a room changes its status to `STARTING` and creates a game with `COUNTDOWN` status.
- Room and game IDs are returned as strings so responses can be serialized as JSON.
- Requests to create, join, or start a room require a valid JWT bearer token.

The rules for leaving, reconnecting, cancelling a game, and transitioning back to `OPEN` remain intentionally undefined and are not implemented here.

## Prerequisites

Start the backend and its dependencies from the repository root:

```bash
docker compose up --build backend db vault
```

The backend is exposed at `http://localhost:3001`. The examples below use `curl` and assume the database is empty or that the usernames and emails are changed for each run.

## Test with curl

### 1. Register two users

```bash
curl -sS -X POST http://localhost:3001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"room-owner","email":"room-owner@example.com","password":"password123"}'

curl -sS -X POST http://localhost:3001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"room-player","email":"room-player@example.com","password":"password123"}'
```

Copy each response's `accessToken` and export them:

```bash
export OWNER_TOKEN='paste-the-first-accessToken-here'
export PLAYER_TOKEN='paste-the-second-accessToken-here'
```

### 2. Create a room

Create a room that needs two players and accepts up to four:

```bash
curl -sS -X POST http://localhost:3001/rooms \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"minPlayers":2,"maxPlayers":4}'
```

Expected result: HTTP `201` with a response similar to:

```json
{
  "id": "1",
  "status": "open",
  "minPlayers": 2,
  "maxPlayers": 4,
  "players": [
    {
      "id": "1",
      "username": "room-owner",
      "avatarUrl": "https://..."
    }
  ]
}
```

Export the returned room ID:

```bash
export ROOM_ID='1'
```

### 3. Join the room

```bash
curl -sS -X POST "http://localhost:3001/rooms/$ROOM_ID/join" \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

Expected result: HTTP `201` with two players in the `players` array.

Repeat the same command. The request should still succeed without adding a second copy of `room-player`.

### 4. Start the game

Any player in the room may start it. Use the second user's token to test that this is not creator-only:

```bash
curl -sS -X POST "http://localhost:3001/rooms/$ROOM_ID/start" \
  -H "Authorization: Bearer $PLAYER_TOKEN"
```

Expected result: HTTP `201` with a response similar to:

```json
{
  "room": {
    "id": "1",
    "status": "starting",
    "minPlayers": 2,
    "maxPlayers": 4,
    "players": [
      {"id": "1", "username": "room-owner", "avatarUrl": "https://..."},
      {"id": "2", "username": "room-player", "avatarUrl": "https://..."}
    ]
  },
  "game": {
    "id": "1",
    "status": "countdown"
  }
}
```

### 5. Check rejected cases

Starting again should fail because the room is no longer `OPEN`:

```bash
curl -sS -i -X POST "http://localhost:3001/rooms/$ROOM_ID/start" \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

Expected result: HTTP `409`.

Joining after the room starts should also fail with HTTP `409`:

```bash
curl -sS -i -X POST "http://localhost:3001/rooms/$ROOM_ID/join" \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

Starting with a user who is not in the room should fail with HTTP `403`. An invalid or missing token should fail with HTTP `401`.

## Test from a browser

There is no dedicated Room page yet. Use the browser's Developer Tools Console while the backend is running. Replace the token and room ID values with the values from the curl flow.

```js
const token = 'paste-a-JWT-here';
const response = await fetch('http://localhost:3001/rooms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ minPlayers: 2, maxPlayers: 4 }),
});
const room = await response.json();
console.log(response.status, room);
```

Join and start from the console:

```js
const roomId = '1';

const joinResponse = await fetch(`http://localhost:3001/rooms/${roomId}/join`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
console.log(joinResponse.status, await joinResponse.json());

const startResponse = await fetch(`http://localhost:3001/rooms/${roomId}/start`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
});
console.log(startResponse.status, await startResponse.json());
```

A successful start should show room status `starting` and game status `countdown` in the console.
