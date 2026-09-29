# Browser Testing: Frontend Rooms

This guide verifies the room flow currently implemented between the Next.js frontend and NestJS backend.

## Prerequisites

From the repository root, make sure the environment file and required Vault/database settings are configured. Start the services with:

```bash
docker compose up --build
```

The browser endpoints are:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Backend health check: http://localhost:3001/health

Open the browser developer tools before testing. The **Console**, **Application > Local Storage**, and **Network** tabs are useful for checking each request.

## 1. Create an account

1. Open http://localhost:3000/register.
2. Enter a username, email, and password.
3. Submit the form.
4. Confirm that the browser redirects to `/dashboard`.
5. In **Application > Local Storage**, confirm that `accessToken` exists for the frontend origin.
6. In **Network**, confirm that the request is:

   ```text
   POST http://localhost:3001/auth/register
   ```

The response should contain `user` and `accessToken`.

If an account already exists, use the login flow instead.

## 2. Log in

1. Open http://localhost:3000/login.
2. Enter the account email and password.
3. Submit the form.
4. Confirm that the browser redirects to `/dashboard`.
5. Confirm that `accessToken` is present in local storage.
6. Confirm that the request is:

   ```text
   POST http://localhost:3001/auth/login
   ```

For invalid credentials, the page should remain on the login screen and display the backend error.

## 3. Create a room

1. On the dashboard, find **Create a room**.
2. Set **Minimum players** to `2`.
3. Set **Maximum players** to `6`.
4. Click **Create room**.
5. In **Network**, confirm a successful request:

   ```text
   POST http://localhost:3001/rooms
   ```

   The request should include:

   ```http
   Authorization: Bearer <accessToken>
   Content-Type: application/json
   ```

   and this JSON body:

   ```json
   {
     "minPlayers": 2,
     "maxPlayers": 6
   }
   ```

6. Confirm that the browser redirects to `/lobby/<room-id>`.

The response should contain the room ID, status, player limits, and the creating user as the first player.

## 4. Verify the lobby

After the redirect to the lobby:

1. Confirm that the page displays the room ID.
2. Confirm that the player count starts at `1/6`.
3. Confirm that the creating user is displayed as the host.
4. In **Network**, confirm a successful request:

   ```text
   GET http://localhost:3001/rooms/<room-id>
   ```

5. Refresh the page.
6. Confirm that the lobby loads again from the backend instead of reverting to mock players.

The room lookup request must also contain the Bearer token.

## 5. Check validation and authentication errors

### Invalid player limits

Try to submit these values:

- Minimum `6`, maximum `2`
- Minimum `1`, maximum `6`
- Minimum `2`, maximum `7`

The browser controls should prevent invalid values where possible. If a request is sent, the page should display the backend error and remain on the dashboard.

### Missing token

1. Open developer tools and go to **Application > Local Storage**.
2. Delete `accessToken`.
3. Open the dashboard and submit the room form, or navigate directly to an existing lobby URL.
4. Confirm that the backend returns `401 Unauthorized`.
5. Confirm that the frontend displays an error instead of showing a successful room.

Restore the token by logging in again.

### CORS

Requests from `http://localhost:3000` to `http://localhost:3001` should complete without a CORS error in the Console. A CORS error indicates that the backend is not running the current `enableCors` configuration or that the frontend is using a different origin.

## 6. Optional manual join test

There is not yet a join button in the frontend. The backend and frontend helper support joining, so it can be tested from the browser Console while logged in:

```js
fetch("http://localhost:3001/rooms/<room-id>/join", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
  },
}).then(async (response) => ({
  status: response.status,
  body: await response.json(),
}))
```

Expected result for an open room with space available: HTTP `201` and the updated room with the new player.

## Current limitations

- The lobby has no live polling or WebSocket updates. Refresh the page to fetch the latest player list.
- The frontend has no join-room control yet.
- The lobby Start button is only a visual control. The backend service has start logic, but no controller route is currently exposed for the browser to call.
- The browser must use `localhost:3001` for the backend because browser requests originate outside the Docker network.
