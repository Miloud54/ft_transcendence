/*
To apply the seed to the db run:
docker compose exec backend npx prisma db seed
 */
import { PrismaClient, UserStatus, RoomStatus, GameStatus } from "../generated/prisma";
import * as bcrypt from "bcrypt";
import { levelForXp, xpForGame } from "../src/game/xp";

const prisma = new PrismaClient();

// Dependency-free password hashing (swap for bcrypt/argon2 if you already use one)
function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function main() {
const existingUsers = await prisma.user.count();
  if (existingUsers > 0 && process.env.SEED_FORCE !== "true") {
    console.log(`Database already contains ${existingUsers} users, skipping seed (set SEED_FORCE=true to reset).`);
    return;
  }
  
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
    { username: "alice",   email: "alice@example.com",   status: UserStatus.ONLINE },
    { username: "bob",     email: "bob@example.com",     status: UserStatus.IN_GAME },
    { username: "charlie", email: "charlie@example.com", status: UserStatus.IN_GAME },
    { username: "diana",   email: "diana@example.com",   status: UserStatus.IN_GAME },
    { username: "eve",     email: "eve@example.com",     status: UserStatus.OFFLINE },
    { username: "frank",   email: "frank@example.com",   status: UserStatus.ONLINE },
    { username: "grace",   email: "grace@example.com",   status: UserStatus.ONLINE },
    { username: "heidi",   email: "heidi@example.com",   status: UserStatus.OFFLINE },
    { username: "ivan",    email: "ivan@example.com",    status: UserStatus.ONLINE },
  ];

  const users: Record<string, { user_id: bigint }> = {};

  for (const u of userData) {
    users[u.username] = await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        password: defaultPassword,
        avatar: `https://api.dicebear.com/10.x/critters/svg?seed=${u.username}`,        
        xp: BigInt(0),
        lvl: BigInt(1),
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
      avatar: "https://api.dicebear.com/10.x/critters/svg?seed=google_user",      xp: BigInt(0),
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
      avatar: "https://api.dicebear.com/10.x/critters/svg?seed=discord_user",
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
      code: 'ALICE1',
    },
  });

  const roomInGame = await prisma.room.create({
    data: {
      status: RoomStatus.IN_GAME,
      min_players: 2,
      max_players: 4,
      created_at: minutesAgo(30),
      creator_id: users.bob.user_id,
      code: 'BOBGAM1',
    },
  });

  const roomStarting = await prisma.room.create({
    data: {
      status: RoomStatus.STARTING,
      min_players: 2,
      max_players: 8,
      created_at: minutesAgo(2),
      creator_id: users.grace.user_id,
      code: 'GRACE1',
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
      code: 'EVECLOSD',
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
      article_title: "Eiffel Tower",
    },
  });

  const gameCountdown = await prisma.game.create({
    data: {
      status: GameStatus.COUNTDOWN,
      started_at: null,
      room_id: roomStarting.room_id,
      article_title: "Photosynthesis",
    },
  });

  const finishedGamesData = [
    { article: "Napoleon Bonaparte", daysAgo: 1, winner: "alice", others: ["bob", "charlie"], discoveryOrder: ["alice", "bob", "charlie"] },
    { article: "Great Wall of China", daysAgo: 2, winner: "diana", others: ["eve", "frank", "grace"], discoveryOrder: ["frank", "diana", "grace", "eve"] },
    { article: "Marie Curie", daysAgo: 3, winner: "bob", others: ["alice"], discoveryOrder: ["bob", "alice"] },
    { article: "The Beatles", daysAgo: 4, winner: "grace", others: ["heidi", "ivan"], discoveryOrder: ["heidi", "grace", "ivan"] },
    { article: "Mount Everest", daysAgo: 5, winner: "alice", others: ["diana", "frank"], discoveryOrder: ["alice", "frank", "diana"] },
    { article: "William Shakespeare", daysAgo: 6, winner: "charlie", others: ["bob", "eve", "grace"], discoveryOrder: ["charlie", "bob", "eve", "grace"] },
  ];

  const finishedGames = [];
  for (const data of finishedGamesData) {
    const minutesAgoStart = data.daysAgo * 24 * 60 + 30;
    const game = await prisma.game.create({
      data: {
        status: GameStatus.FINISHED,
        started_at: minutesAgo(minutesAgoStart),
        ended_at: minutesAgo(minutesAgoStart - 15),
        room_id: roomClosed.room_id,
        article_title: data.article,
      },
    });
    finishedGames.push({ game, ...data });
  }

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
    ],
  });

  // XP earned through the finished games, with the same rule as real games.
  const xpByUsername = new Map<string, number>();
  const addXp = (username: string, score: number, won: boolean) =>
    xpByUsername.set(username, (xpByUsername.get(username) ?? 0) + xpForGame(score, won));

  for (const { game, winner, others, discoveryOrder } of finishedGames) {
    const discoveryRankByUsername = new Map<string, number>(
      discoveryOrder.map((username, index) => [username, index + 1]),
    );

    await prisma.gamePlayer.create({
      data: {
        game_id: game.game_id,
        user_id: users[winner].user_id,
        result: "WIN",
        score: 1000,
        xp_gained: xpForGame(1000, true),
        rank: 1,
        discovery_rank: discoveryRankByUsername.get(winner),
      },
    });
    addXp(winner, 1000, true);

    for (const [index, username] of others.entries()) {
      await prisma.gamePlayer.create({
        data: {
          game_id: game.game_id,
          user_id: users[username].user_id,
          result: "LOSS",
          score: 850 - index * 120,
          xp_gained: xpForGame(850 - index * 120, false),
          rank: index + 2,
          discovery_rank: discoveryRankByUsername.get(username),
        },
      });
      addXp(username, 850 - index * 120, false);
    }
  }

  for (const [username, xp] of xpByUsername) {
    await prisma.user.update({
      where: { user_id: users[username].user_id },
      data: { xp: BigInt(xp), lvl: BigInt(levelForXp(xp)) },
    });
  }

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