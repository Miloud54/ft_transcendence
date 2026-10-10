import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PedantixEngineService } from 'src/pedantix-engine/pedantix-engine.service';

import {
  GameStatus,
  RoomStatus,
} from 'generated/prisma';

@Injectable()
export class GameService {
  private readonly countdowns = new Set<string>();
  private readonly preparations = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedantixEngine: PedantixEngineService,
  ) {}

  async transitionToRunning(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: {
        game_id: BigInt(gameId),
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatus.COUNTDOWN) {
      throw new ConflictException('Game is not in COUNTDOWN');
    }

    if (!this.pedantixEngine.isGamePrepared(gameId)) {
      throw new ConflictException('Game preparation is not complete');
    }

    await this.prisma.$transaction(async (transaction) => {
      const updatedGame = await transaction.game.updateMany({
        where: {
          game_id: game.game_id,
          status: GameStatus.COUNTDOWN,
        },
        data: {
          status: GameStatus.RUNNING,
        },
      });

      if (updatedGame.count === 0) {
        return;
      }

      await transaction.room.update({
        where: {
          room_id: game.room_id,
        },
        data: {
          status: RoomStatus.IN_GAME,
        },
      });
    });
  }

  async startCountdown(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: {
        game_id: BigInt(gameId),
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatus.COUNTDOWN) {
      throw new ConflictException('Game is not in COUNTDOWN');
    }

    if (this.countdowns.has(gameId)) {
      return;
    }

    this.countdowns.add(gameId);

    const preparation = this.pedantixEngine.prepareGame(gameId);
    this.preparations.set(gameId, preparation);

    setTimeout(async () => {
      try {
        await preparation;
        await this.transitionToRunning(gameId);
      } catch (error) {
        console.error('Failed to start game:', error);
      } finally {
        this.countdowns.delete(gameId);
        this.preparations.delete(gameId);
      }
    }, 10_000);
  }

  async finishGame(gameId: string): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: {
        game_id: BigInt(gameId),
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    if (game.status !== GameStatus.RUNNING) {
      throw new ConflictException('Game is not RUNNING');
    }

    await this.prisma.$transaction(async (transaction) => {
      const updatedGame = await transaction.game.updateMany({
        where: {
          game_id: game.game_id,
          status: GameStatus.RUNNING,
        },
        data: {
          status: GameStatus.FINISHED,
        },
      });

      if (updatedGame.count === 0) {
        return;
      }

      await transaction.room.update({
        where: {
          room_id: game.room_id,
        },
        data: {
          status: RoomStatus.OPEN,
        },
      });
    });
  }
}

/*

Status : COUNTDOWN / RUNNING / FINISHED

startCountdown(gameId) {

    // vérifier que le Game existe
    // vérifier que le Game est en COUNTDOWN

    // lancer le countdown de 10 secondes

    // pendant les 10 secondes :
    //   - informer le frontend via WebSocket
    //   - demander au Pedantix Engine de préparer les données

    // à la fin des 10 secondes
    transitionToRunning(gameId);
}


transitionToRunning(gameId) {

    // Game → RUNNING
    // Room → IN_GAME

    // informer le frontend via WebSocket
}



finishGame() {
  // vérifier que le Game existe
  // vérifier que le Game est RUNNING

  // game status -> FINISHED
  // room status -> OPEN
}
*/