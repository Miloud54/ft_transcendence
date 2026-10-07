/**
 * prisma/seed.ts
 *
 * Setup:
 *   1. Put this file at prisma/seed.ts
 *   2. npm i -D tsx
 *   3. In package.json add:
 *        "prisma": { "seed": "tsx prisma/seed.ts" }
 *   4. Run:  npx prisma db seed     (or: npx prisma migrate reset)
 */
import { PrismaClient, UserStatus, RoomStatus, GameStatus } from "../generated/prisma";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

// Dependency-free password hashing (swap for bcrypt/argon2 if you already use one)
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function main() {
  console.log("🧹 Cleaning database...");
  // TRUNCATE + RESTART IDENTITY so ids start again at 1
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Game_players", "Games", "Room_players", "Rooms", "Users" RESTART IDENTITY CASCADE;`
  );

  // ---------------------------------------------------------------------------
  // USERS
  // ---------------------------------------------------------------------------
  console.log("👤 Seeding users...");
  const defaultPassword = hashPassword("password123");

  const userData = [
    { username: "alice",   email: "alice@example.com",   status: UserStatus.ONLINE,  xp: 1250, lvl: 5 },
    { username: "bob",     email: "bob@example.com",     status: UserStatus.IN_GAME, xp: 3400, lvl: 9 },
    { username: "charlie", email: "charlie@example.com", status: UserStatus.IN_GAME, xp: 800,  lvl: 3 },
    { username: "diana",   email: "diana@example.com",   status: UserStatus.IN_GAME, xp: 5200, lvl: 12 },
    { username: "eve",     email: "eve@example.com",     status: UserStatus.OFFLINE, xp: 150,  lvl: 1 },
    { username: "frank",   email: "frank@example.com",   status: UserStatus.ONLINE,  xp: 2100, lvl: 7 },
    { username: "grace",   email: "grace@example.com",   status: UserStatus.ONLINE,  xp: 4300, lvl: 10 },
    { username: "heidi",   email: "heidi@example.com",   status: UserStatus.OFFLINE, xp: 90,   lvl: 1 },
    { username: "ivan",    email: "ivan@example.com",    status: UserStatus.ONLINE,  xp: 600,  lvl: 2 },
  ];

  const users: Record<string, { user_id: bigint }> = {};

  for (const u of userData) {
    users[u.username] = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        password: defaultPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`,
        xp: BigInt(u.xp),
        lvl: BigInt(u.lvl),
        status: u.status,
      },
    });
  }

  // OAuth-only users (no password)
  users["oauth_google"] = await prisma.user.create({
    data: {
      username: "google_user",
      email: "google.user@gmail.com",
      password: null,
      googleId: "google-oauth-1234567890",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=google_user",
      xp: BigInt(0),
      lvl: BigInt(1),
      status: UserStatus.OFFLINE,
    },
  });

  users["oauth_discord"] = await prisma.user.create({
    data: {
      username: "discord_user",
      email: "discord.user@example.com",
      password: null,
      discordId: "discord-oauth-0987654321",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=discord_user",
      xp: BigInt(0),
      lvl: BigInt(1),
      status: UserStatus.OFFLINE,
    },
  });

  // ---------------------------------------------------------------------------
  // ROOMS (one per status)
  // ---------------------------------------------------------------------------
  console.log("🚪 Seeding rooms...");

  const roomOpen = await prisma.room.create({
    data: {
      status: RoomStatus.OPEN,
      min_players: 2,
      max_players: 6,
      created_at: minutesAgo(5),
      creator_id: users.alice.user_id,
    },
  });

  const roomInGame = await prisma.room.create({
    data: {
      status: RoomStatus.IN_GAME,
      min_players: 2,
      max_players: 4,
      created_at: minutesAgo(30),
      creator_id: users.bob.user_id,
    },
  });

  const roomStarting = await prisma.room.create({
    data: {
      status: RoomStatus.STARTING,
      min_players: 2,
      max_players: 8,
      created_at: minutesAgo(2),
      creator_id: users.grace.user_id,
    },
  });

  const roomClosed = await prisma.room.create({
    data: {
      status: RoomStatus.CLOSED,
      min_players: 2,
      max_players: 5,
      created_at: minutesAgo(180),
      closed_at: minutesAgo(120),
      creator_id: users.eve.user_id,
    },
  });

  // ---------------------------------------------------------------------------
  // ROOM PLAYERS
  // ---------------------------------------------------------------------------
  console.log("🧑‍🤝‍🧑 Seeding room players...");

  await prisma.roomPlayer.createMany({
    data: [
      // Open room
      { room_id: roomOpen.room_id, user_id: users.alice.user_id },
      { room_id: roomOpen.room_id, user_id: users.frank.user_id },
      // In-game room
      { room_id: roomInGame.room_id, user_id: users.bob.user_id },
      { room_id: roomInGame.room_id, user_id: users.charlie.user_id },
      { room_id: roomInGame.room_id, user_id: users.diana.user_id },
      // Starting room
      { room_id: roomStarting.room_id, user_id: users.grace.user_id },
      { room_id: roomStarting.room_id, user_id: users.ivan.user_id },
      // Closed room
      { room_id: roomClosed.room_id, user_id: users.eve.user_id },
      { room_id: roomClosed.room_id, user_id: users.heidi.user_id },
    ],
  });

  // ---------------------------------------------------------------------------
  // GAMES
  // ---------------------------------------------------------------------------
  console.log("🎮 Seeding games...");

  const gameRunning = await prisma.game.create({
    data: {
      status: GameStatus.RUNNING,
      started_at: minutesAgo(10),
      room_id: roomInGame.room_id,
    },
  });

  const gameCountdown = await prisma.game.create({
    data: {
      status: GameStatus.COUNTDOWN,
      started_at: null,
      room_id: roomStarting.room_id,
    },
  });

  const gameFinished = await prisma.game.create({
    data: {
      status: GameStatus.FINISHED,
      started_at: minutesAgo(150),
      ended_at: minutesAgo(125),
      room_id: roomClosed.room_id,
    },
  });

  // ---------------------------------------------------------------------------
  // GAME PLAYERS
  // ---------------------------------------------------------------------------
  console.log("🏁 Seeding game players...");

  await prisma.gamePlayer.createMany({
    data: [
      // Running game
      { game_id: gameRunning.game_id, user_id: users.bob.user_id },
      { game_id: gameRunning.game_id, user_id: users.charlie.user_id },
      { game_id: gameRunning.game_id, user_id: users.diana.user_id },
      // Countdown game
      { game_id: gameCountdown.game_id, user_id: users.grace.user_id },
      { game_id: gameCountdown.game_id, user_id: users.ivan.user_id },
      // Finished game
      { game_id: gameFinished.game_id, user_id: users.eve.user_id },
      { game_id: gameFinished.game_id, user_id: users.heidi.user_id },
    ],
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const [u, r, rp, g, gp] = await Promise.all([
    prisma.user.count(),
    prisma.room.count(),
    prisma.roomPlayer.count(),
    prisma.game.count(),
    prisma.gamePlayer.count(),
  ]);

  console.log("\n✅ Seed complete:");
  console.log(`   Users: ${u} | Rooms: ${r} | Room_players: ${rp} | Games: ${g} | Game_players: ${gp}`);
  console.log("   Default password for seeded users: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });