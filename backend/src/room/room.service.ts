import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CreateRoomDto } from './create.room.dto';
import {
  FriendshipStatus,
  GameStatus,
  Prisma,
  RoomInvitationStatus,
  RoomStatus,
  UserStatus,
} from 'generated/prisma';
import { GameService } from 'src/game/game.service';

type RoomWithPlayers = Prisma.RoomGetPayload<{
  include: {
    players: {
      include: {
        users: true;
      };
    };
  };
}>;

const ROOM_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code +=
      ROOM_CODE_CHARACTERS[
        Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)
      ];
  }
  return code;
}

function toRoomResponse(room: RoomWithPlayers) {
  return {
    id: room.room_id.toString(),
    hostId: room.creator_id.toString(),
    code: room.code,
    status: room.status.toLowerCase(),
    minPlayers: room.min_players,
    maxPlayers: room.max_players,
    players: room.players.map((player) => ({
      id: player.users.user_id.toString(),
      username: player.users.username,
      avatarUrl: player.users.avatar,
    })),
  };
}

type RoomChatMessage = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
};

@Injectable()
export class RoomService {
  private readonly chatMessages = new Map<string, RoomChatMessage[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameService: GameService,
    private readonly userService: UserService,
  ) {}

  async find(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: BigInt(roomId) },
      include: {
        players: {
          include: {
            users: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return toRoomResponse(room);
  }

  async getPendingInvitations(userId: string) {
    const invitations = await this.prisma.roomInvitation.findMany({
      where: {
        invitee_id: BigInt(userId),
        status: RoomInvitationStatus.PENDING,
      },
      include: {
        room: {
          include: {
            creator: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return invitations.map((invitation) => ({
      roomId: invitation.room_id.toString(),
      inviter: {
        id: invitation.room.creator_id.toString(),
        username: invitation.room.creator.username,
      },
    }));
  }

  async assertMember(roomId: string, userId: string) {
    const membership = await this.prisma.roomPlayer.findUnique({
      where: {
        room_id_user_id: {
          room_id: BigInt(roomId),
          user_id: BigInt(userId),
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this room');
    }
  }

  async createChatMessage(roomId: string, userId: string, text: string) {
    await this.assertMember(roomId, userId);

    const user = await this.prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const message = {
      id: `${Date.now()}-${userId}`,
      roomId,
      userId,
      username: user.username,
      avatar: user.avatar,
      text,
      createdAt: new Date().toISOString(),
    };
    const messages = this.chatMessages.get(roomId) ?? [];
    messages.push(message);
    this.chatMessages.set(roomId, messages.slice(-100));
    return message;
  }

  async getChatMessages(roomId: string, userId: string) {
    await this.assertMember(roomId, userId);
    return this.chatMessages.get(roomId) ?? [];
  }

  async create(userId: string, dto: CreateRoomDto) {
    if (dto.minPlayers > dto.maxPlayers) {
      throw new BadRequestException(
        'minPlayers cannot be greater than maxPlayers',
      );
    }

    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const room = await this.prisma.room.create({
          data: {
            creator_id: BigInt(userId),
            status: RoomStatus.OPEN,
            min_players: dto.minPlayers,
            max_players: dto.maxPlayers,
            code: generateRoomCode(),
            players: {
              create: {
                user_id: BigInt(userId),
              },
            },
          },
          include: {
            players: {
              include: {
                users: true,
              },
            },
          },
        });

        return toRoomResponse(room);
      } catch (error) {
        const isCodeCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (isCodeCollision && attempt < MAX_ATTEMPTS - 1) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(
      'Could not generate a unique room code, please try again',
    );
  }

  async createRematch(
        userId: string,
        dto: { minPlayers: number; maxPlayers: number; playerIds: string[] },
    ) {
        if (dto.minPlayers > dto.maxPlayers) {
            throw new BadRequestException('minPlayers cannot be greater than maxPlayers');
        }

        const candidateIds = dto.playerIds
            .filter((id) => id !== userId)
            .map((id) => BigInt(id));

        const onlineUsers = candidateIds.length
            ? await this.prisma.user.findMany({
                  where: { user_id: { in: candidateIds }, status: UserStatus.ONLINE },
                  select: { user_id: true },
              })
            : [];

        const MAX_ATTEMPTS = 5;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                const room = await this.prisma.room.create({
                    data: {
                        creator_id: BigInt(userId),
                        status: RoomStatus.OPEN,
                        min_players: dto.minPlayers,
                        max_players: dto.maxPlayers,
                        code: generateRoomCode(),
                        players: {
                            create: [
                                { user_id: BigInt(userId) },
                                ...onlineUsers.map((onlineUser) => ({ user_id: onlineUser.user_id })),
                            ],
                        },
                    },
                    include: {
                        players: {
                            include: {
                                users: true,
                            },
                        },
                    },
                });

                return toRoomResponse(room);
            } catch (error) {
                const isCodeCollision =
                    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
                if (isCodeCollision && attempt < MAX_ATTEMPTS - 1) {
                    continue;
                }
                throw error;
            }
        }

        throw new ConflictException('Could not generate a unique room code, please try again');
    }


  async listFriendsOpenRooms(userId: string) {
    const userIdBig = BigInt(userId);

    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ user_id: userIdBig }, { friend_id: userIdBig }],
      },
    });

    const friendIds = friendships.map((friendship) =>
      friendship.user_id === userIdBig
        ? friendship.friend_id
        : friendship.user_id,
    );

    if (friendIds.length === 0) {
      return [];
    }

    const rooms = await this.prisma.room.findMany({
      where: {
        status: RoomStatus.OPEN,
        creator_id: { in: friendIds },
        players: { none: { user_id: userIdBig } },
      },
      include: {
        creator: true,
        players: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return rooms.map((room) => ({
      id: room.room_id.toString(),
      hostUsername: room.creator.username,
      playerCount: room.players.length,
      maxPlayers: room.max_players,
    }));
  }

  async joinByCode(code: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!room) {
      throw new NotFoundException('Invalid room code');
    }

    return this.join(room.room_id.toString(), userId);
  }

  async join(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: BigInt(roomId) },
      include: { players: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== RoomStatus.OPEN) {
      throw new ConflictException('Room is not open');
    }

    const requester = await this.userService.findById(userId);
    if (requester.status === 'IN_GAME') {
      throw new ConflictException(
        'You cannot join another room while you are in a game',
      );
    }

    const alreadyJoined = room.players.some(
      (player) => player.user_id === BigInt(userId),
    );

    if (alreadyJoined) {
      return this.find(roomId);
    }

    if (room.players.length >= room.max_players) {
      throw new ConflictException('Room is full');
    }

    if (!alreadyJoined) {
      await this.prisma.roomPlayer.create({
        data: {
          room_id: room.room_id,
          user_id: BigInt(userId),
        },
      });
    }

    const updatedRoom = await this.prisma.room.findUniqueOrThrow({
      where: { room_id: room.room_id },
      include: {
        players: {
          include: {
            users: true,
          },
        },
      },
    });

    return toRoomResponse(updatedRoom);
  }

  async leave(roomId: string, userId: string) {
      const room = await this.prisma.room.findUnique({
          where: { room_id: BigInt(roomId) },
      });
      if (!room) {
          throw new NotFoundException('Room not found');
      }

      if (room.creator_id === BigInt(userId)) {
          throw new ConflictException('The host cannot leave their own lobby');
      }

      if (room.status !== RoomStatus.OPEN) {
          throw new ConflictException('Room is not open');
      }

      await this.prisma.roomPlayer.deleteMany({
          where: { room_id: room.room_id, user_id: BigInt(userId) },
      });

      return this.find(roomId);
  }

  async removePlayer(roomId: string, hostUserId: string, targetUserId: string) {
      const room = await this.prisma.room.findUnique({
          where: { room_id: BigInt(roomId) },
      });
      if (!room) {
          throw new NotFoundException('Room not found');
      }

      if (room.creator_id !== BigInt(hostUserId)) {
          throw new ForbiddenException('Only the host can remove players');
      }

      if (BigInt(targetUserId) === BigInt(hostUserId)) {
          throw new ConflictException('The host cannot remove themselves');
      }

      if (room.status !== RoomStatus.OPEN) {
          throw new ConflictException('Room is not open');
      }

      await this.prisma.roomPlayer.deleteMany({
          where: { room_id: room.room_id, user_id: BigInt(targetUserId) },
      });

      return this.find(roomId);
  }

  async cancelRoom(roomId: string, hostUserId: string) {
      const room = await this.prisma.room.findUnique({
          where: { room_id: BigInt(roomId) },
          include: { players: true },
      });
      if (!room) {
          throw new NotFoundException('Room not found');
      }

      if (room.creator_id !== BigInt(hostUserId)) {
          throw new ForbiddenException('Only the host can close this lobby');
      }

      if (room.status !== RoomStatus.OPEN) {
          throw new ConflictException('Only an open lobby can be closed');
      }

      await this.prisma.room.update({
          where: { room_id: room.room_id },
          data: { status: RoomStatus.CLOSED, closed_at: new Date() },
      });

      const otherPlayerIds = room.players
          .filter((player) => player.user_id !== room.creator_id)
          .map((player) => player.user_id.toString());

      return { roomId, canceled: true, otherPlayerIds };
  }

  async inviteFriend(roomId: string, userId: string, friendId: string) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: BigInt(roomId) },
      include: { players: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.creator_id !== BigInt(userId)) {
      throw new ForbiddenException('Only the room host can invite friends');
    }
    if (room.status !== RoomStatus.OPEN) {
      throw new ConflictException('Room is not open');
    }
    if (room.players.length >= room.max_players) {
      throw new ConflictException('Room is full');
    }
    if (BigInt(userId) === BigInt(friendId)) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { user_id: BigInt(userId), friend_id: BigInt(friendId) },
          { user_id: BigInt(friendId), friend_id: BigInt(userId) },
        ],
      },
    });
    if (!friendship) {
      throw new ForbiddenException('You can only invite accepted friends');
    }

    const alreadyJoined = room.players.some(
      (player) => player.user_id === BigInt(friendId),
    );
    if (alreadyJoined) {
      throw new ConflictException('Friend is already in the room');
    }

    const inviter = await this.prisma.user.findUnique({
      where: { user_id: BigInt(userId) },
    });
    if (!inviter) {
      throw new NotFoundException('Inviter not found');
    }

    await this.prisma.roomInvitation.upsert({
      where: {
        room_id_invitee_id: {
          room_id: room.room_id,
          invitee_id: BigInt(friendId),
        },
      },
      create: {
        room_id: room.room_id,
        invitee_id: BigInt(friendId),
        status: RoomInvitationStatus.PENDING,
      },
      update: {
        status: RoomInvitationStatus.PENDING,
        created_at: new Date(),
      },
    });

    return {
      roomId,
      inviter: {
        id: userId,
        username: inviter.username,
      },
      friendId,
    };
  }

  async acceptInvitation(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: BigInt(roomId) },
      include: { players: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (room.status !== RoomStatus.OPEN) {
      throw new ConflictException('Room is not open');
    }
    if (room.players.length >= room.max_players) {
      throw new ConflictException('Room is full');
    }

    const invitation = await this.prisma.roomInvitation.findUnique({
      where: {
        room_id_invitee_id: {
          room_id: room.room_id,
          invitee_id: BigInt(userId),
        },
      },
    });
    if (!invitation || invitation.status !== RoomInvitationStatus.PENDING) {
      throw new NotFoundException('Room invitation not found');
    }

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { user_id: room.creator_id, friend_id: BigInt(userId) },
          { user_id: BigInt(userId), friend_id: room.creator_id },
        ],
      },
    });
    if (!friendship) {
      throw new ForbiddenException(
        'You can only join a room invited by a friend',
      );
    }

    const alreadyJoined = room.players.some(
      (player) => player.user_id === BigInt(userId),
    );
    if (alreadyJoined) {
      return this.find(roomId);
    }

    await this.prisma.$transaction([
      this.prisma.roomInvitation.update({
        where: { invitation_id: invitation.invitation_id },
        data: { status: RoomInvitationStatus.ACCEPTED },
      }),
      this.prisma.roomPlayer.create({
        data: {
          room_id: room.room_id,
          user_id: BigInt(userId),
        },
      }),
    ]);

    return this.find(roomId);
  }

  async declineInvitation(roomId: string, userId: string) {
    const invitation = await this.prisma.roomInvitation.findUnique({
      where: {
        room_id_invitee_id: {
          room_id: BigInt(roomId),
          invitee_id: BigInt(userId),
        },
      },
      include: { room: true },
    });
    if (!invitation || invitation.status !== RoomInvitationStatus.PENDING) {
      throw new NotFoundException('Room invitation not found');
    }
    await this.prisma.roomInvitation.update({
      where: { invitation_id: invitation.invitation_id },
      data: { status: RoomInvitationStatus.DECLINED },
    });
    return {
      roomId,
      declined: true,
      hostId: invitation.room.creator_id.toString(),
    };
  }

  async start(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: BigInt(roomId) },
      include: { players: true },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isPlayer = room.players.some(
      (player) => player.user_id == BigInt(userId),
    );

    if (!isPlayer) {
      throw new ForbiddenException('Only room players can start the game');
    }

    if (room.status != RoomStatus.OPEN) {
      throw new ConflictException('Room is not open');
    }

    if (
      room.players.length < room.min_players ||
      room.players.length > room.max_players
    ) {
      throw new ConflictException('Invalid number of players');
    }

    // return this.prisma.$transaction(async (transaction) => {
    // const updatedRoom = await transaction.room.update({
    //     where: { room_id: room.room_id },
    //     data: { status: RoomStatus.STARTING },
    // });

    // const game = await transaction.game.create({
    //     data: {
    //     room_id: room.room_id,
    //     status: GameStatus.COUNTDOWN,
    //     },
    // });

    // return {
    //     room: {
    //     id: updatedRoom.room_id.toString(),
    //     status: updatedRoom.status.toLowerCase(),
    //     },
    //     game: {
    //     id: game.game_id.toString(),
    //     status: game.status.toLowerCase(),
    //     },
    // };
    // });

    const result = await this.prisma.$transaction(async (transaction) => {
      const updatedRoom = await transaction.room.update({
        where: { room_id: room.room_id },
        data: { status: RoomStatus.STARTING },
      });

      const game = await transaction.game.create({
        data: {
          room_id: room.room_id,
          status: GameStatus.COUNTDOWN,
          player: {
            create: room.players.map((player) => ({
              user_id: player.user_id,
            })),
          },
        },
      });

      return {
        room: {
          id: updatedRoom.room_id.toString(),
          status: updatedRoom.status.toLowerCase(),
        },
        game: {
          id: game.game_id.toString(),
          status: game.status.toLowerCase(),
        },
      };
    });

    await this.gameService.startCountdown(result.game.id);

    return result;
  }
}
