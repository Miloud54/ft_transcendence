import { Body, Controller, Get, Post, UseGuards, Req, Param, } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './create.room.dto';
import type { Request } from 'express';
import { RoomGateway } from './room.gateway';
import { PresenceGateway } from '../user/presence.gateway';

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

    @Get(':roomId')
    @UseGuards(JwtAuthGuard)
    get(@Param('roomId') roomId: string) {
        return this.roomService.find(roomId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    create (
        @Req() request: AuthenticatedRequest,
        @Body() dto: CreateRoomDto,
    ) {
        return this.roomService.create(request.user.userId, dto);
    }

    @Post(':roomId/join')
    @UseGuards(JwtAuthGuard)
    async join (
        @Param('roomId') roomId: string,
        @Req() request: AuthenticatedRequest,
    ) {
        const room = await this.roomService.join(roomId, request.user.userId);
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
        this.presenceGateway.notifyUser(friendId, 'room-invitation:received', invitation);
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
    declineInvitation(
        @Param('roomId') roomId: string,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.roomService.declineInvitation(roomId, request.user.userId);
    }

    @Post(':roomId/start')
    @UseGuards(JwtAuthGuard)
    async start(
        @Param('roomId') roomId: string,
        @Req() request: AuthenticatedRequest,
    ) {
        const result = await this.roomService.start(
            roomId,
            request.user.userId,
        );

        this.roomGateway.emitRoomStarted(roomId, result);

        return result;
    }
}
