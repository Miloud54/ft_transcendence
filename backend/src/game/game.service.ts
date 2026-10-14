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

export type GameState = {
  gameId: string;
  status: string;
  countdownRemaining: number;
  article?: ReturnType<PedantixEngineService['getInitialArticleView']>;
  scores: Record<string, number>;
  attempts: Record<string, number>;
};

export type GuessResult = {
  gameId: string;
  userId: string;
  guess: string;
  score: number;
  correct: boolean;
};

@Injectable()
export class GameService {
  private readonly countdowns = new Set<string>();
  private readonly preparations = new Map<string, Promise<void>>();
  private readonly countdownEnds = new Map<string, number>();
  private readonly scores = new Map<string, Map<string, number>>();
  private readonly attempts = new Map<string, Map<string, number>>();
  private readonly stateListeners = new Set<
    (gameId: string, state: GameState) => void
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedantixEngine: PedantixEngineService,
  ) {}

  onStateChange(listener: (gameId: string, state: GameState) => void) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async getState(gameId: string): Promise<GameState> {
    const game = await this.prisma.game.findUnique({
      where: { game_id: BigInt(gameId) },
    });
    if (!game) throw new NotFoundException('Game not found');
    const countdownEndsAt = this.countdownEnds.get(gameId);
    return {
      gameId,
      status: game.status.toLowerCase(),
      countdownRemaining: countdownEndsAt
        ? Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000))
        : 0,
      article: game.status === GameStatus.RUNNING
        ? this.pedantixEngine.getInitialArticleView(gameId)
        : undefined,
      scores: Object.fromEntries(this.scores.get(gameId) ?? []),
      attempts: Object.fromEntries(this.attempts.get(gameId) ?? []),
    };
  }

  async assertPlayer(gameId: string, userId: string) {
    const player = await this.prisma.gamePlayer.findUnique({
      where: {
        game_id_user_id: { game_id: BigInt(gameId), user_id: BigInt(userId) },
      },
    });
    if (!player) throw new ConflictException('User is not a game player');
  }

  async submitGuess(
    gameId: string,
    userId: string,
    rawGuess: string,
  ): Promise<GuessResult> {
    await this.assertPlayer(gameId, userId);

    const game = await this.prisma.game.findUnique({
      where: { game_id: BigInt(gameId) },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== GameStatus.RUNNING) {
      throw new ConflictException('Game is not running');
    }

    const guess = rawGuess.trim().toLowerCase();
    if (guess.length < 1 || guess.length > 100) {
      throw new ConflictException('Guess must contain between 1 and 100 characters');
    }

    const tokenizedArticle = this.pedantixEngine.getTokenizedArticle(gameId);
    if (!tokenizedArticle) {
      throw new ConflictException('Game data is not ready');
    }

    const title = tokenizedArticle.title.tokens
      .filter((token) => token.type === 'word')
      .map((token) => token.text.toLowerCase())
      .join(' ');
    const correct = title === guess;
    const score = correct ? 1000 : 0;

    const gameScores = this.scores.get(gameId) ?? new Map<string, number>();
    const gameAttempts = this.attempts.get(gameId) ?? new Map<string, number>();
    gameScores.set(userId, (gameScores.get(userId) ?? 0) + score);
    gameAttempts.set(userId, (gameAttempts.get(userId) ?? 0) + 1);
    this.scores.set(gameId, gameScores);
    this.attempts.set(gameId, gameAttempts);

    const result = { gameId, userId, guess, score, correct };
    await this.emitState(gameId);
    return result;
  }

  private async emitState(gameId: string) {
    const state = await this.getState(gameId);
    for (const listener of this.stateListeners) listener(gameId, state);
  }

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
    await this.emitState(gameId);
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
        this.countdownEnds.delete(gameId);
      }
    }, 10_000);
    this.countdownEnds.set(gameId, Date.now() + 10_000);
    void this.emitState(gameId);
    const interval = setInterval(() => {
      if (!this.countdowns.has(gameId)) {
        clearInterval(interval);
        return;
      }
      void this.emitState(gameId);
    }, 1_000);
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
    await this.emitState(gameId);
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