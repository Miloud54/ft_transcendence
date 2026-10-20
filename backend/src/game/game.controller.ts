import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GameService } from './game.service';

@UseGuards(JwtAuthGuard)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('leaderboard')
  getLeaderboard(@Query('sortBy') sortBy?: string) {
    return this.gameService.getLeaderboard(20, sortBy === 'points' ? 'points' : 'wins');
  }

  @Get(':gameId/results')
  getResults(@Param('gameId') gameId: string) {
    return this.gameService.getResults(gameId);
  }
}
