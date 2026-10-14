const { io } = require("socket.io-client");

async function login(email, password) {
  const res = await fetch("http://backend:3000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("login failed: " + JSON.stringify(data));
  return data.accessToken;
}

async function getUser(token) {
  const res = await fetch("http://backend:3000/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function main() {
  const aliceToken = await login("alice@example.com", "password123");
  const bobToken = await login("bob@example.com", "password123");

  console.log("alice before connecting socket:", await getUser(aliceToken));

  const socket = io("http://backend:3000/presence", {
    auth: { token: aliceToken },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 5000);
  });
  console.log("socket connected, id =", socket.id);

  await new Promise((r) => setTimeout(r, 1000));
  console.log("alice after connecting socket:", await getUser(aliceToken));

  // bob listens for presence:update while alice disconnects
  const bobSocket = io("http://backend:3000/presence", {
    auth: { token: bobToken },
    transports: ["websocket"],
  });
  await new Promise((resolve, reject) => {
    bobSocket.on("connect", resolve);
    bobSocket.on("connect_error", reject);
    setTimeout(() => reject(new Error("bob connect timeout")), 5000);
  });

  bobSocket.on("presence:update", (update) => {
    console.log("bob received presence:update event:", update);
  });

  socket.disconnect();
  await new Promise((r) => setTimeout(r, 1500));
  console.log("alice after disconnecting socket:", await getUser(aliceToken));

  bobSocket.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
