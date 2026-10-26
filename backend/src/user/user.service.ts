import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  FriendshipStatus,
  GameResult,
  GameStatus,
  RoomStatus,
  UserStatus,
} from '../../generated/prisma';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const SALT_ROUNDS = 10;

type UserRecord = {
  user_id: bigint;
  username: string;
  email: string;
  avatar: string;
  xp: bigint;
  lvl: bigint;
  status: UserStatus;
  last_seen_at: Date;
};

function toPublicUser(user: UserRecord) {
  const live = isOnline(user.last_seen_at);
  const status = !live
    ? 'OFFLINE'
    : user.status === UserStatus.IN_GAME
      ? 'IN_GAME'
      : user.status === UserStatus.OFFLINE
        ? 'OFFLINE'
        : 'ONLINE';

  return {
    id: user.user_id.toString(),
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    xp: Number(user.xp),
    lvl: Number(user.lvl),
    status,
  };
}

function isOnline(lastSeen: Date) {
  return Date.now() - lastSeen.getTime() < 60_000;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toPublicUser(user);
  }

  async search(userId: string, query: string) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        user_id: { not: BigInt(userId) },
        username: { contains: normalizedQuery, mode: 'insensitive' },
      },
      orderBy: { username: 'asc' },
      take: 20,
    });

    const relationships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          {
            user_id: BigInt(userId),
            friend_id: { in: users.map((user) => user.user_id) },
          },
          {
            friend_id: BigInt(userId),
            user_id: { in: users.map((user) => user.user_id) },
          },
        ],
      },
    });

    return users.map((user) => {
      const relationship = relationships.find(
        (item) =>
          (item.user_id === BigInt(userId) &&
            item.friend_id === user.user_id) ||
          (item.friend_id === BigInt(userId) && item.user_id === user.user_id),
      );
      return {
        ...toPublicUser(user),
        relationship: !relationship
          ? 'NONE'
          : relationship.status === FriendshipStatus.ACCEPTED
            ? 'ACCEPTED'
            : relationship.user_id === BigInt(userId)
              ? 'PENDING_SENT'
              : 'PENDING_RECEIVED',
      };
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { user_id: BigInt(userId), status: FriendshipStatus.ACCEPTED },
      include: { friend: true },
      orderBy: { friend: { username: 'asc' } },
    });

    return friendships.map(({ friend }) => toPublicUser(friend));
  }

  async getStats(userId: string) {
    const userIdBig = BigInt(userId);

    const user = await this.prisma.user.findUnique({
      where: { user_id: userIdBig },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const results = await this.prisma.gamePlayer.findMany({
      where: {
        user_id: userIdBig,
        result: { not: null },
        game: { status: GameStatus.FINISHED },
      },
      select: { result: true, score: true, rank: true },
    });

    const gamesPlayed = results.length;
    const wins = results.filter(
      (entry) => entry.result === GameResult.WIN,
    ).length;
    const losses = results.filter(
      (entry) => entry.result === GameResult.LOSS,
    ).length;
    const winRate =
      gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    const scores = results
      .map((entry) => entry.score)
      .filter((score): score is number => score !== null);
    const averageScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length,
          )
        : 0;

    const bestRank = results.reduce<number | null>((best, entry) => {
      if (entry.rank === null) return best;
      return best === null ? entry.rank : Math.min(best, entry.rank);
    }, null);

    const achievements = [
      {
        id: 'first-win',
        label: 'First victory',
        description: 'Win your first game',
        earned: wins >= 1,
      },
      {
        id: 'veteran',
        label: 'Veteran',
        description: 'Play 5 games',
        earned: gamesPlayed >= 5,
      },
      {
        id: 'champion',
        label: 'Champion',
        description: 'Finish 1st in a game',
        earned: bestRank === 1,
      },
      {
        id: 'on-a-roll',
        label: 'On a roll',
        description: 'Win 5 games',
        earned: wins >= 5,
      },
    ];

    return {
      gamesPlayed,
      wins,
      losses,
      winRate,
      averageScore,
      bestRank,
      level: Number(user.lvl),
      xp: Number(user.xp),
      achievements,
    };
  }

  async getMatchHistory(userId: string, limit = 20) {
    const userIdBig = BigInt(userId);

    const entries = await this.prisma.gamePlayer.findMany({
      where: {
        user_id: userIdBig,
        result: { not: null },
        game: { status: GameStatus.FINISHED },
      },
      include: {
        game: {
          include: {
            player: { include: { users: true } },
          },
        },
      },
      orderBy: { game: { ended_at: 'desc' } },
      take: limit,
    });

    return entries.map((entry) => ({
      id: entry.game.game_id.toString(),
      articleTitle: entry.game.article_title,
      result: entry.result === GameResult.WIN ? 'win' : 'loss',
      score: entry.score,
      rank: entry.rank,
      discoveryRank: entry.discovery_rank,
      playedAt: entry.game.ended_at,
      opponents: entry.game.player
        .filter((player) => player.user_id !== userIdBig)
        .map((player) => player.users.username),
    }));
  }

  // async getActiveGame(userId: string) {
  //   const roomPlayer = await this.prisma.roomPlayer.findFirst({
  //     where: {
  //       user_id: BigInt(userId),
  //       room: {
  //         status: {
  //           in: [RoomStatus.STARTING, RoomStatus.IN_GAME],
  //         },
  //       },
  //     },
  //     include: {
  //       room: {
  //         include: {
  //           games_hosted: {
  //             where: {
  //               status: {
  //                 in: [GameStatus.COUNTDOWN, GameStatus.RUNNING],
  //               },
  //               player: {
  //                 some: {
  //                   user_id: BigInt(userId),
  //                 },
  //               },
  //             },
  //             orderBy: { game_id: 'desc' },
  //             take: 1,
  //           },
  //         },
  //       },
  //     },
  //   });

  //   const game = roomPlayer?.room.games_hosted[0];
  //   if (!roomPlayer || !game) {
  //     return null;
  //   }

  //   return {
  //     roomId: roomPlayer.room.room_id.toString(),
  //     gameId: game.game_id.toString(),
  //   };
  // }
  async getActiveGame(userId: string) {
    const userIdBig = BigInt(userId);
    const activeGameFilter = {
      status: { in: [GameStatus.COUNTDOWN, GameStatus.RUNNING] },
      player: { some: { user_id: userIdBig } },
    };

    const roomPlayer = await this.prisma.roomPlayer.findFirst({
      where: {
        user_id: userIdBig,
        room: {
          status: { in: [RoomStatus.STARTING, RoomStatus.IN_GAME] },
          games_hosted: { some: activeGameFilter },
        },
      },
      include: {
        room: {
          include: {
            games_hosted: {
              where: activeGameFilter,
              orderBy: { game_id: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { room_id: 'desc' },
    });

    const game = roomPlayer?.room.games_hosted[0];
    if (!roomPlayer || !game) {
      return null;
    }

    return {
      roomId: roomPlayer.room.room_id.toString(),
      gameId: game.game_id.toString(),
    };
  }

  async getActiveRoom(userId: string) {
    const userIdBig = BigInt(userId);

    const roomPlayer = await this.prisma.roomPlayer.findFirst({
      where: {
        user_id: userIdBig,
        room: { status: RoomStatus.OPEN },
      },
      include: { room: true },
      orderBy: { room_id: 'desc' },
    });

    if (!roomPlayer) {
      return null;
    }

    return { roomId: roomPlayer.room.room_id.toString() };
  }

  async addFriend(userId: string, friendId: string) {
    const ownerId = BigInt(userId);
    const targetId = BigInt(friendId);
    if (ownerId === targetId) {
      throw new ConflictException('You cannot add yourself as a friend');
    }

    const friend = await this.prisma.user.findUnique({
      where: { user_id: targetId },
    });
    if (!friend) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.friendship.upsert({
        where: { user_id_friend_id: { user_id: ownerId, friend_id: targetId } },
        create: {
          user_id: ownerId,
          friend_id: targetId,
          status: FriendshipStatus.PENDING,
        },
        update: { status: FriendshipStatus.PENDING },
      }),
    ]);

    return { ...toPublicUser(friend), relationship: 'PENDING_SENT' };
  }

  async removeFriend(userId: string, friendId: string) {
    const ownerId = BigInt(userId);
    const targetId = BigInt(friendId);
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { user_id: ownerId, friend_id: targetId },
          { user_id: targetId, friend_id: ownerId },
        ],
      },
      include: { friend: true, user: true },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.prisma.friendship.deleteMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { user_id: ownerId, friend_id: targetId },
          { user_id: targetId, friend_id: ownerId },
        ],
      },
    });

    const friend =
      friendship.user_id === ownerId ? friendship.friend : friendship.user;
    return toPublicUser(friend);
  }

  async getFriendRequests(userId: string) {
    const requests = await this.prisma.friendship.findMany({
      where: { friend_id: BigInt(userId), status: FriendshipStatus.PENDING },
      include: { user: true },
      orderBy: { user: { username: 'asc' } },
    });
    return requests.map(({ user }) => toPublicUser(user));
  }

  async acceptFriendRequest(userId: string, requesterId: string) {
    const ownerId = BigInt(userId);
    const requester = BigInt(requesterId);
    const request = await this.prisma.friendship.findUnique({
      where: { user_id_friend_id: { user_id: requester, friend_id: ownerId } },
      include: { user: true },
    });
    if (!request || request.status !== FriendshipStatus.PENDING) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.$transaction([
      this.prisma.friendship.update({
        where: { friendship_id: request.friendship_id },
        data: { status: FriendshipStatus.ACCEPTED },
      }),
      this.prisma.friendship.upsert({
        where: {
          user_id_friend_id: { user_id: ownerId, friend_id: requester },
        },
        create: {
          user_id: ownerId,
          friend_id: requester,
          status: FriendshipStatus.ACCEPTED,
        },
        update: { status: FriendshipStatus.ACCEPTED },
      }),
    ]);
    return toPublicUser(request.user);
  }

  async declineFriendRequest(userId: string, requesterId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: {
        user_id_friend_id: {
          user_id: BigInt(requesterId),
          friend_id: BigInt(userId),
        },
      },
    });
    if (!request || request.status !== FriendshipStatus.PENDING) {
      throw new NotFoundException('Friend request not found');
    }
    await this.prisma.friendship.delete({
      where: { friendship_id: request.friendship_id },
    });
    return { message: 'Friend request declined' };
  }

  async updatePresence(userId: string) {
    return this.touchLastSeen(userId);
  }

  async touchLastSeen(userId: string) {
    const user = await this.prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: { last_seen_at: new Date() },
    });
    return toPublicUser(user);
  }

  async setPresence(userId: string, status: 'ONLINE' | 'OFFLINE' | 'IN_GAME') {
    const user = await this.prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: {
        status: UserStatus[status],
        last_seen_at: new Date(),
      },
    });
    return toPublicUser(user);
  }

  async update(userId: string, dto: UpdateUserDto) {
    if (dto.username || dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          user_id: { not: BigInt(userId) },
          OR: [
            ...(dto.username ? [{ username: dto.username }] : []),
            ...(dto.email ? [{ email: dto.email }] : []),
          ],
        },
      });

      if (existing) {
        throw new ConflictException('Username or email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: dto,
    });

    return toPublicUser(user);
  }

  async updateAvatar(userId: string, filename: string) {
    const avatarUrl = `https://localhost:8443/api/uploads/avatars/${filename}`;

    const user = await this.prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: { avatar: avatarUrl },
    });

    return toPublicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException(
        'Password change is not available for this account',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { user_id: BigInt(userId) },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated' };
  }
}
