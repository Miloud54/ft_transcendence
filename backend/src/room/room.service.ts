import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoomDto } from './create.room.dto';
import { GameStatus, Prisma, RoomStatus } from 'generated/prisma';
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

function toRoomResponse(room: RoomWithPlayers) {
  return {
    id: room.room_id.toString(),
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

function toGameResponse(game: { game_id: bigint; status: GameStatus }) {
    return {
        id: game.game_id.toString(),
        status: game.status.toLowerCase(),
    };
}

@Injectable()
export class RoomService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gameService: GameService,
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

    async create(userId: string, dto: CreateRoomDto) {
        if (dto.minPlayers > dto.maxPlayers) {
            throw new BadRequestException('minPlayers cannot be greater than maxPlayers',);
        }

        const room = await this.prisma.room.create({
            data: {
                creator_id: BigInt(userId),
                status: RoomStatus.OPEN,
                min_players: dto.minPlayers,
                max_players: dto.maxPlayers,
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

        const alreadyJoined = room.players.some(
            (player) => player.user_id === BigInt(userId),
        );

        if (alreadyJoined) {
            return this.find(roomId);
        }

        if (room.players.length >= room.max_players) {
            throw new ConflictException('Room is full');
        }

<<<<<<< HEAD
        await this.prisma.roomPlayer.create({
            data: {
                room_id: room.room_id,
                user_id: BigInt(userId),
            },
        });
=======
        // const alreadyJoined = room.players.some(
        //     (player) => player.user_id === BigInt(userId),
        // );

        if (!alreadyJoined) {
            await this.prisma.roomPlayer.create({
                data: {
                    room_id: room.room_id,
                    user_id: BigInt(userId),
                },
            });
        }
>>>>>>> 8e9b2a32040dc5a2f2fd34cb1f724df2f1d24f10

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

        if (room.players.length < room.min_players || room.players.length > room.max_players) {
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

    
