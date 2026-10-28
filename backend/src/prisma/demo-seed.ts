import * as bcrypt from 'bcrypt';
import {
  GameResult,
  GameStatus,
  PrismaClient,
  RoomStatus,
  UserStatus,
} from '../../generated/prisma';
import { loadSecretsFromVault } from '../vault';

const HISTORY_ROOM_CODE = 'DEMOHIST';

const DEMO_PLAYERS = [
  { username: 'demo_alice', xp: 3200, lvl: 8 },
  { username: 'demo_bob', xp: 1800, lvl: 5 },
  { username: 'demo_charlie', xp: 950, lvl: 3 },
  { username: 'demo_diana', xp: 1400, lvl: 4 },
];

// Each ranking lists players from 1st to last; the 1st one wins.
const DEMO_GAMES = [
  {
    article: 'Napoleon Bonaparte',
    daysAgo: 1,
    ranking: ['demo_alice', 'demo_bob', 'demo_charlie'],
  },
  {
    article: 'Great Wall of China',
    daysAgo: 2,
    ranking: ['demo_alice', 'demo_diana', 'demo_bob', 'demo_charlie'],
  },
  { article: 'Marie Curie', daysAgo: 3, ranking: ['demo_bob', 'demo_alice'] },
  {
    article: 'The Beatles',
    daysAgo: 4,
    ranking: ['demo_alice', 'demo_charlie', 'demo_diana'],
  },
  {
    article: 'Mount Everest',
    daysAgo: 5,
    ranking: ['demo_diana', 'demo_alice', 'demo_bob'],
  },
  {
    article: 'William Shakespeare',
    daysAgo: 6,
    ranking: ['demo_alice', 'demo_bob', 'demo_charlie', 'demo_diana'],
  },
  {
    article: 'Photosynthesis',
    daysAgo: 8,
    ranking: ['demo_charlie', 'demo_diana'],
  },
  {
    article: 'Eiffel Tower',
    daysAgo: 9,
    ranking: ['demo_alice', 'demo_diana'],
  },
  {
    article: 'Albert Einstein',
    daysAgo: 11,
    ranking: ['demo_bob', 'demo_charlie', 'demo_alice'],
  },
  {
    article: 'Amazon River',
    daysAgo: 13,
    ranking: ['demo_alice', 'demo_bob', 'demo_diana'],
  },
];

const daysAgo = (days: number, extraMinutes = 0) =>
  new Date(Date.now() - days * 24 * 60 * 60_000 + extraMinutes * 60_000);

async function main() {
  const secrets = await loadSecretsFromVault();
  if (!secrets.demo_password) {
    console.log('No demo_password in Vault, skipping demo seed.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const password = await bcrypt.hash(secrets.demo_password, 10);
    const userIds = new Map<string, bigint>();

    for (const player of DEMO_PLAYERS) {
      const user = await prisma.user.upsert({
        where: { username: player.username },
        update: { password },
        create: {
          username: player.username,
          email: `${player.username}@demo.local`,
          password,
          avatar: `https://api.dicebear.com/10.x/critters/svg?seed=${player.username}`,
          xp: BigInt(player.xp),
          lvl: BigInt(player.lvl),
          status: UserStatus.OFFLINE,
        },
      });
      userIds.set(player.username, user.user_id);
    }

    const existingRoom = await prisma.room.findUnique({
      where: { code: HISTORY_ROOM_CODE },
    });
    if (existingRoom) {
      console.log(
        'Demo game history already exists, only passwords were updated.',
      );
      return;
    }

    await prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          code: HISTORY_ROOM_CODE,
          status: RoomStatus.CLOSED,
          min_players: 2,
          max_players: 4,
          created_at: daysAgo(14),
          closed_at: daysAgo(1),
          creator_id: userIds.get('demo_alice')!,
        },
      });

      await tx.roomPlayer.createMany({
        data: DEMO_PLAYERS.map((player) => ({
          room_id: room.room_id,
          user_id: userIds.get(player.username)!,
        })),
      });

      for (const [gameIndex, demoGame] of DEMO_GAMES.entries()) {
        const game = await tx.game.create({
          data: {
            status: GameStatus.FINISHED,
            started_at: daysAgo(demoGame.daysAgo),
            ended_at: daysAgo(demoGame.daysAgo, 15),
            article_title: demoGame.article,
            room_id: room.room_id,
          },
        });

        await tx.gamePlayer.createMany({
          data: demoGame.ranking.map((username, index) => ({
            game_id: game.game_id,
            user_id: userIds.get(username)!,
            result: index === 0 ? GameResult.WIN : GameResult.LOSS,
            score: 1000 - index * 150 - (gameIndex % 3) * 40,
            rank: index + 1,
            discovery_rank: index + 1,
          })),
        });
      }
    });

    console.log(
      `Demo seed complete: ${DEMO_PLAYERS.length} users, ${DEMO_GAMES.length} finished games.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Demo seed failed:', error);
  process.exit(1);
});
