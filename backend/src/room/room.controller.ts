import { Body, Controller, Post, UseGuards, Req, Param, } from '@nestjs/common';
import { RoomService } from './room.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateRoomDto } from './create.room.dto';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
  };
};

@Controller('rooms')
export class RoomController {
    constructor(private readonly roomService: RoomService) {}

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
    join (
        @Param('roomId') roomId: string,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.roomService.join(roomId, request.user.userId)
    }
}
