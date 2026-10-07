import { Body, Controller, Get, Post, UseGuards, Req, Param, } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './create.room.dto';
import type { Request } from 'express';
import { RoomGateway } from './room.gateway';

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
        private readonly roomGateway: RoomGateway, ) {}

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
