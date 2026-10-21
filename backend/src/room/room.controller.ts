import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './create.room.dto';
import type { Request } from 'express';
import { RoomGateway } from './room.gateway';
import { PresenceGateway } from '../user/presence.gateway';
import { JoinByCodeDto } from './dto/join-by-code.dto';
import { CreateRematchDto } from './dto/create-rematch.dto';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
  };
};

@Controller('rooms')
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly roomGateway: RoomGateway,
    private readonly presenceGateway: PresenceGateway,
  ) {}

  @Get('me/invitations')
  @UseGuards(JwtAuthGuard)
  getPendingInvitations(@Req() request: AuthenticatedRequest) {
    return this.roomService.getPendingInvitations(request.user.userId);
  }

  @Get('open/friends')
  @UseGuards(JwtAuthGuard)
  getFriendsOpenRooms(@Req() request: AuthenticatedRequest) {
    return this.roomService.listFriendsOpenRooms(request.user.userId);
  }

  @Get(':roomId')
  @UseGuards(JwtAuthGuard)
  get(@Param('roomId') roomId: string) {
    return this.roomService.find(roomId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateRoomDto) {
    return this.roomService.create(request.user.userId, dto);
  }

  @Post('rematch')
  @UseGuards(JwtAuthGuard)
  async createRematch(@Req() request: AuthenticatedRequest, @Body() dto: CreateRematchDto) {
    const room = await this.roomService.createRematch(request.user.userId, dto);
    for (const player of room.players) {
      if (player.id !== request.user.userId) {
        this.presenceGateway.notifyUser(player.id, 'rematch:created', room);
      }
    }
    return room;
  }

  @Post('join-by-code')
  @UseGuards(JwtAuthGuard)
  async joinByCode(
    @Body() dto: JoinByCodeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const room = await this.roomService.joinByCode(
      dto.code,
      request.user.userId,
    );
    this.roomGateway.emitRoomState(room.id, room);
    return room;
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  async join(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const room = await this.roomService.join(roomId, request.user.userId);
    this.roomGateway.emitRoomState(roomId, room);

    return room;
  }

  @Delete(':roomId/players/:playerId')
  @UseGuards(JwtAuthGuard)
  async removePlayer(
    @Param('roomId') roomId: string,
    @Param('playerId') playerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const room = await this.roomService.removePlayer(roomId, request.user.userId, playerId);
    this.roomGateway.emitRoomState(roomId, room);
    this.presenceGateway.notifyUser(playerId, 'room:removed', { roomId });
    return room;
  }

  @Post(':roomId/leave')
  @UseGuards(JwtAuthGuard)
  async leave(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const room = await this.roomService.leave(roomId, request.user.userId);
    this.roomGateway.emitRoomState(roomId, room);

    return room;
  }

  @Post(':roomId/invite/:friendId')
  @UseGuards(JwtAuthGuard)
  async inviteFriend(
    @Param('roomId') roomId: string,
    @Param('friendId') friendId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const invitation = await this.roomService.inviteFriend(
      roomId,
      request.user.userId,
      friendId,
    );
    this.presenceGateway.notifyUser(
      friendId,
      'room-invitation:received',
      invitation,
    );
    return invitation;
  }

  @Post(':roomId/invitation/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const room = await this.roomService.acceptInvitation(
      roomId,
      request.user.userId,
    );
    this.roomGateway.emitRoomState(roomId, room);
    return room;
  }

  @Post(':roomId/invitation/decline')
  @UseGuards(JwtAuthGuard)
  async declineInvitation(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.roomService.declineInvitation(
      roomId,
      request.user.userId,
    );
    this.presenceGateway.notifyUser(result.hostId, 'room-invitation:declined', {
      roomId,
      friendId: request.user.userId,
    });
    return result;
  }

  @Post(':roomId/start')
  @UseGuards(JwtAuthGuard)
  async start(
    @Param('roomId') roomId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.roomService.start(roomId, request.user.userId);

    this.roomGateway.emitRoomStarted(roomId, result);

    return result;
  }
}
