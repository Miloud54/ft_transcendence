"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../generated/prisma");
const crypto_1 = require("crypto");
const prisma = new prisma_1.PrismaClient();
function hashPassword(plain) {
    const salt = (0, crypto_1.randomBytes)(16).toString("hex");
    const hash = (0, crypto_1.scryptSync)(plain, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
const minutesAgo = (m) => new Date(Date.now() - m * 60_000);
async function main() {
    console.log("🧹 Cleaning database...");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Game_players", "Games", "Room_players", "Rooms", "Users" RESTART IDENTITY CASCADE;`);
    console.log("👤 Seeding users...");
    const defaultPassword = hashPassword("password123");
    const userData = [
        { username: "alice", email: "alice@example.com", status: prisma_1.UserStatus.ONLINE, xp: 1250, lvl: 5 },
        { username: "bob", email: "bob@example.com", status: prisma_1.UserStatus.IN_GAME, xp: 3400, lvl: 9 },
        { username: "charlie", email: "charlie@example.com", status: prisma_1.UserStatus.IN_GAME, xp: 800, lvl: 3 },
        { username: "diana", email: "diana@example.com", status: prisma_1.UserStatus.IN_GAME, xp: 5200, lvl: 12 },
        { username: "eve", email: "eve@example.com", status: prisma_1.UserStatus.OFFLINE, xp: 150, lvl: 1 },
        { username: "frank", email: "frank@example.com", status: prisma_1.UserStatus.ONLINE, xp: 2100, lvl: 7 },
        { username: "grace", email: "grace@example.com", status: prisma_1.UserStatus.ONLINE, xp: 4300, lvl: 10 },
        { username: "heidi", email: "heidi@example.com", status: prisma_1.UserStatus.OFFLINE, xp: 90, lvl: 1 },
        { username: "ivan", email: "ivan@example.com", status: prisma_1.UserStatus.ONLINE, xp: 600, lvl: 2 },
    ];
    const users = {};
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
    users["oauth_google"] = await prisma.user.create({
        data: {
            username: "google_user",
            email: "google.user@gmail.com",
            password: null,
            googleId: "google-oauth-1234567890",
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=google_user",
            xp: BigInt(0),
            lvl: BigInt(1),
            status: prisma_1.UserStatus.OFFLINE,
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
            status: prisma_1.UserStatus.OFFLINE,
        },
    });
    console.log("🚪 Seeding rooms...");
    const roomOpen = await prisma.room.create({
        data: {
            status: prisma_1.RoomStatus.OPEN,
            min_players: 2,
            max_players: 6,
            created_at: minutesAgo(5),
            creator_id: users.alice.user_id,
        },
    });
    const roomInGame = await prisma.room.create({
        data: {
            status: prisma_1.RoomStatus.IN_GAME,
            min_players: 2,
            max_players: 4,
            created_at: minutesAgo(30),
            creator_id: users.bob.user_id,
        },
    });
    const roomStarting = await prisma.room.create({
        data: {
            status: prisma_1.RoomStatus.STARTING,
            min_players: 2,
            max_players: 8,
            created_at: minutesAgo(2),
            creator_id: users.grace.user_id,
        },
    });
    const roomClosed = await prisma.room.create({
        data: {
            status: prisma_1.RoomStatus.CLOSED,
            min_players: 2,
            max_players: 5,
            created_at: minutesAgo(180),
            closed_at: minutesAgo(120),
            creator_id: users.eve.user_id,
        },
    });
    console.log("🧑‍🤝‍🧑 Seeding room players...");
    await prisma.roomPlayer.createMany({
        data: [
            { room_id: roomOpen.room_id, user_id: users.alice.user_id },
            { room_id: roomOpen.room_id, user_id: users.frank.user_id },
            { room_id: roomInGame.room_id, user_id: users.bob.user_id },
            { room_id: roomInGame.room_id, user_id: users.charlie.user_id },
            { room_id: roomInGame.room_id, user_id: users.diana.user_id },
            { room_id: roomStarting.room_id, user_id: users.grace.user_id },
            { room_id: roomStarting.room_id, user_id: users.ivan.user_id },
            { room_id: roomClosed.room_id, user_id: users.eve.user_id },
            { room_id: roomClosed.room_id, user_id: users.heidi.user_id },
        ],
    });
    console.log("🎮 Seeding games...");
    const gameRunning = await prisma.game.create({
        data: {
            status: prisma_1.GameStatus.RUNNING,
            started_at: minutesAgo(10),
            room_id: roomInGame.room_id,
        },
    });
    const gameCountdown = await prisma.game.create({
        data: {
            status: prisma_1.GameStatus.COUNTDOWN,
            started_at: null,
            room_id: roomStarting.room_id,
        },
    });
    const gameFinished = await prisma.game.create({
        data: {
            status: prisma_1.GameStatus.FINISHED,
            started_at: minutesAgo(150),
            ended_at: minutesAgo(125),
            room_id: roomClosed.room_id,
        },
    });
    console.log("🏁 Seeding game players...");
    await prisma.gamePlayer.createMany({
        data: [
            { game_id: gameRunning.game_id, user_id: users.bob.user_id },
            { game_id: gameRunning.game_id, user_id: users.charlie.user_id },
            { game_id: gameRunning.game_id, user_id: users.diana.user_id },
            { game_id: gameCountdown.game_id, user_id: users.grace.user_id },
            { game_id: gameCountdown.game_id, user_id: users.ivan.user_id },
            { game_id: gameFinished.game_id, user_id: users.eve.user_id },
            { game_id: gameFinished.game_id, user_id: users.heidi.user_id },
        ],
    });
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
//# sourceMappingURL=seed.js.map