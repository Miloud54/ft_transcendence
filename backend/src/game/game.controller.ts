import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GameService } from './game.service';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('leaderboard')
  getLeaderboard(@Query('sortBy') sortBy?: string) {
    return this.gameService.getLeaderboard(
      20,
      sortBy === 'points' ? 'points' : 'wins',
    );
  }

  @Get(':gameId/results')
  getResults(@Param('gameId') gameId: string) {
    return this.gameService.getResults(gameId);
  }

  @Patch(':gameId/leave')
  async leaveGame(
    @Param('gameId') gameId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.gameService.leaveGame(gameId, request.user.userId);
    return { left: true };
  }
}
