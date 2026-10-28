import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PedantixEngineService } from 'src/pedantix-engine/pedantix-engine.service';

import { GameResult, GameStatus, RoomStatus } from 'generated/prisma';

import { UserService } from 'src/user/user.service';
import { PresenceGateway } from 'src/user/presence.gateway';
import { levelForXp, xpForGame } from './xp';

/** Points for a guess that uncovers at least one new word. */
export const SCORE_PER_WORD = 30;
/** Bonus for the player whose guess completes the title. */
export const SCORE_TITLE = 500;
const MIN_GUESS_INTERVAL_MS = 300;
const TITLE_GRACE_PERIOD_MS = 5 * 60_000;
/** In-memory game data is kept this long after the end (results screen). */
const RELEASE_DELAY_MS = 30 * 60_000;

export type GameState = {
  gameId: string;
  status: string;
  countdownRemaining: number;
  /** Seconds remaining after the title is found, before the game closes. */
  graceRemaining: number;
  /** Board view personalized for the requesting player. */
  article?: ReturnType<PedantixEngineService['getArticleView']>;
  scores: Record<string, number>;
  attempts: Record<string, number>;
  winnerId?: string;
  leftPlayerIds: string[];
};

export type GuessRejection = Extract<
  NonNullable<ReturnType<PedantixEngineService['applyGuess']>>,
  { valid: false }
>['reason'];

export type GuessResult = {
  gameId: string;
  userId: string;
  guess: string;
  valid: boolean;
  reason?: GuessRejection | 'TOO_FAST';
  /** points earned by this guess */
  score: number;
  /** true when this guess completed the title */
  correct: boolean;
  /** tokens newly revealed by this guess */
  revealedCount: number;
  /** true when the guessed word occurs in the article, even if already revealed */
  foundInText: boolean;
  /** best proximity grade this guess produced (0..4) */
  bestGrade: number;
  /** Used by the gateway to hide title guesses from other players. */
  revealsTitleWord: boolean;
};

@Injectable()
export class GameService {
  private readonly countdowns = new Set<string>();
  private readonly preparations = new Map<string, Promise<void>>();
  private readonly countdownEnds = new Map<string, number>();
  private readonly graceEnds = new Map<string, number>();
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  private readonly scores = new Map<string, Map<string, number>>();
  private readonly attempts = new Map<string, Map<string, number>>();
  private readonly winners = new Map<string, string>();
  private readonly lastGuessAt = new Map<string, number>();
  private readonly leftPlayers = new Map<string, Set<string>>();
  private readonly stateListeners = new Set<
    (gameId: string, state: GameState) => void
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedantixEngine: PedantixEngineService,
    private readonly userService: UserService,
    private readonly presenceGateway: PresenceGateway,
  ) {}

  onStateChange(listener: (gameId: string, state: GameState) => void) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async getState(gameId: string, viewerId?: string): Promise<GameState> {
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
      graceRemaining: this.remainingSeconds(this.graceEnds.get(gameId)),
      article:
        game.status === GameStatus.RUNNING
          ? this.pedantixEngine.getArticleView(gameId, viewerId)
          : game.status === GameStatus.FINISHED
            ? this.pedantixEngine.getRevealedArticleView(gameId)
            : undefined,
      scores: Object.fromEntries(this.scores.get(gameId) ?? []),
      attempts: Object.fromEntries(this.attempts.get(gameId) ?? []),
      winnerId: this.winners.get(gameId),
      leftPlayerIds: [...(this.leftPlayers.get(gameId) ?? [])],
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
    if (!this.pedantixEngine.isGamePrepared(gameId)) {
      throw new ConflictException('Game data is not ready');
    }

    const throttleKey = `${gameId}:${userId}`;
    const now = Date.now();
    if (
      now - (this.lastGuessAt.get(throttleKey) ?? 0) <
      MIN_GUESS_INTERVAL_MS
    ) {
      return this.rejected(gameId, userId, rawGuess, 'TOO_FAST');
    }
    this.lastGuessAt.set(throttleKey, now);

    // Synchronous and atomic: validation, reveal, proximity, title detection.
    const outcome = this.pedantixEngine.applyGuess(gameId, userId, rawGuess);
    if (!outcome) throw new ConflictException('Game data is not ready');
    if (!outcome.valid) {
      return this.rejected(gameId, userId, rawGuess, outcome.reason);
    }

    const score =
      (outcome.revealedCount > 0 ? SCORE_PER_WORD : 0) +
      (outcome.titleFound ? SCORE_TITLE : 0);

    const gameScores = this.scores.get(gameId) ?? new Map<string, number>();
    const gameAttempts = this.attempts.get(gameId) ?? new Map<string, number>();
    gameScores.set(userId, (gameScores.get(userId) ?? 0) + score);
    gameAttempts.set(userId, (gameAttempts.get(userId) ?? 0) + 1);
    this.scores.set(gameId, gameScores);
    this.attempts.set(gameId, gameAttempts);

    const result: GuessResult = {
      gameId,
      userId,
      guess: outcome.normalized,
      valid: true,
      score,
      correct: outcome.titleFound,
      revealedCount: outcome.revealedCount,
      foundInText: outcome.foundInText,
      bestGrade: outcome.bestGrade,
      revealsTitleWord: outcome.revealsTitleWord,
    };

    if (outcome.titleFound) {
      const activePlayers = [
        ...(await this.prisma.gamePlayer.findMany({
          where: { game_id: game.game_id },
        })),
      ]
        .map((player) => player.user_id.toString())
        .filter((id) => !this.leftPlayers.get(gameId)?.has(id));

      if (this.pedantixEngine.hasAllPlayersFoundTitle(gameId, activePlayers)) {
        // The winner is the first player who found the title, not the last one.
        await this.finishGame(gameId, this.winners.get(gameId) ?? userId);
        return result;
      }

      this.winners.set(gameId, userId);
      this.startTitleGracePeriod(gameId);
    }
    await this.emitState(gameId);
    return result;
  }

  private startTitleGracePeriod(gameId: string) {
    if (this.graceEnds.has(gameId)) return;

    const endsAt = Date.now() + TITLE_GRACE_PERIOD_MS;
    this.graceEnds.set(gameId, endsAt);
    const timer = setTimeout(() => {
      this.graceTimers.delete(gameId);
      this.graceEnds.delete(gameId);
      void this.finishGame(gameId).catch((error) => {
        console.error('Failed to finish game after title grace period:', error);
      });
    }, TITLE_GRACE_PERIOD_MS);
    timer.unref();
    this.graceTimers.set(gameId, timer);

    const interval = setInterval(() => {
      if (!this.graceEnds.has(gameId)) {
        clearInterval(interval);
        return;
      }
      void this.emitState(gameId);
    }, 1_000);
  }

  private remainingSeconds(endsAt: number | undefined): number {
    return endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0;
  }

  async leaveGame(gameId: string, userId: string): Promise<void> {
    await this.assertPlayer(gameId, userId);

    const game = await this.prisma.game.findUnique({
      where: { game_id: BigInt(gameId) },
    });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== GameStatus.RUNNING) {
      return;
    }

    const left = this.leftPlayers.get(gameId) ?? new Set<string>();
    left.add(userId);
    this.leftPlayers.set(gameId, left);

    await this.prisma.gamePlayer.update({
      where: {
        game_id_user_id: { game_id: game.game_id, user_id: BigInt(userId) },
      },
      data: { result: GameResult.LOSS },
    });

    await this.userService.setPresence(userId, 'ONLINE');
    this.presenceGateway.broadcastPresence(userId, 'ONLINE');
    await this.emitState(gameId);
  }

  private rejected(
    gameId: string,
    userId: string,
    rawGuess: string,
    reason: NonNullable<GuessResult['reason']>,
  ): GuessResult {
    return {
      gameId,
      userId,
      guess: rawGuess.trim().slice(0, 100),
      valid: false,
      reason,
      score: 0,
      correct: false,
      revealedCount: 0,
      foundInText: false,
      bestGrade: 0,
      revealsTitleWord: false,
    };
  }

  hasLeft(gameId: string, userId: string): boolean {
    return this.leftPlayers.get(gameId)?.has(userId) ?? false;
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

    const transitioned = await this.prisma.$transaction(async (transaction) => {
      const updatedGame = await transaction.game.updateMany({
        where: {
          game_id: game.game_id,
          status: GameStatus.COUNTDOWN,
        },
        data: {
          status: GameStatus.RUNNING,
          started_at: new Date(),
        },
      });

      if (updatedGame.count === 0) {
        return false;
      }

      await transaction.room.update({
        where: {
          room_id: game.room_id,
        },
        data: {
          status: RoomStatus.IN_GAME,
        },
      });

      return true;
    });
    await this.emitState(gameId);

    if (!transitioned) {
      return;
    }

    const roomPlayers = await this.prisma.roomPlayer.findMany({
      where: { room_id: game.room_id },
    });

    await Promise.all(
      roomPlayers.map(async (roomPlayer) => {
        const userId = roomPlayer.user_id.toString();
        await this.userService.setPresence(userId, 'IN_GAME');
        this.presenceGateway.broadcastPresence(userId, 'IN_GAME');
      }),
    );
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

    setTimeout(() => {
      void (async () => {
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
      })();
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

  async finishGame(gameId: string, winnerId?: string): Promise<void> {
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

    const gamePlayers = await this.prisma.gamePlayer.findMany({
      where: { game_id: game.game_id },
    });
    const scores = this.scores.get(gameId) ?? new Map<string, number>();
    const attempts = this.attempts.get(gameId) ?? new Map<string, number>();
    const leftPlayers = this.leftPlayers.get(gameId) ?? new Set<string>();
    const winner = winnerId ?? this.topScorer(scores, leftPlayers);

    // Players who left rank last. Otherwise: winner, then score (desc), then fewer attempts.
    const ranked = [...gamePlayers].sort((a, b) => {
      const idA = a.user_id.toString();
      const idB = b.user_id.toString();
      const leftA = leftPlayers.has(idA);
      const leftB = leftPlayers.has(idB);
      if (leftA !== leftB) return leftA ? 1 : -1;
      if ((idA === winner) !== (idB === winner)) return idA === winner ? -1 : 1;
      const byScore = (scores.get(idB) ?? 0) - (scores.get(idA) ?? 0);
      if (byScore !== 0) return byScore;
      return (attempts.get(idA) ?? 0) - (attempts.get(idB) ?? 0);
    });

    if (winner) this.winners.set(gameId, winner);

    const finished = await this.prisma.$transaction(async (transaction) => {
      const updatedGame = await transaction.game.updateMany({
        where: {
          game_id: game.game_id,
          status: GameStatus.RUNNING,
        },
        data: {
          status: GameStatus.FINISHED,
          ended_at: new Date(),
          article_title: this.pedantixEngine.getArticleTitle(gameId),
        },
      });

      if (updatedGame.count === 0) {
        return false;
      }

      for (const [position, player] of ranked.entries()) {
        const id = player.user_id.toString();

        // Players who left the game earn no XP.
        const xpGained = leftPlayers.has(id)
          ? 0
          : xpForGame(scores.get(id) ?? 0, id === winner);
        let leveledUp = false;
        if (xpGained > 0) {
          const user = await transaction.user.update({
            where: { user_id: player.user_id },
            data: { xp: { increment: BigInt(xpGained) } },
          });
          const newLevel = levelForXp(Number(user.xp));
          leveledUp = newLevel > Number(user.lvl);
          await transaction.user.update({
            where: { user_id: player.user_id },
            data: { lvl: BigInt(newLevel) },
          });
        }

        await transaction.gamePlayer.update({
          where: {
            game_id_user_id: {
              game_id: player.game_id,
              user_id: player.user_id,
            },
          },
          data: {
            result: id === winner ? GameResult.WIN : GameResult.LOSS,
            score: scores.get(id) ?? 0,
            rank: position + 1,
            xp_gained: xpGained,
            leveled_up: leveledUp,
          },
        });
      }

      await transaction.room.update({
        where: {
          room_id: game.room_id,
        },
        data: {
          status: RoomStatus.CLOSED,
          closed_at: new Date(),
        },
      });

      return true;
    });
    if (finished) {
      this.graceEnds.delete(gameId);
      const graceTimer = this.graceTimers.get(gameId);
      if (graceTimer) {
        clearTimeout(graceTimer);
        this.graceTimers.delete(gameId);
      }
      this.pedantixEngine.markGameFinished(gameId);
    }
    await this.emitState(gameId);

    if (!finished) {
      return;
    }

    const roomPlayers = await this.prisma.roomPlayer.findMany({
      where: { room_id: game.room_id },
    });

    await Promise.all(
      roomPlayers.map(async (roomPlayer) => {
        const userId = roomPlayer.user_id.toString();
        await this.userService.setPresence(userId, 'ONLINE');
        this.presenceGateway.broadcastPresence(userId, 'ONLINE');
      }),
    );

    // Keep the revealed article available for the results screen, then free it.
    setTimeout(() => this.releaseGame(gameId), RELEASE_DELAY_MS).unref();
  }

  private topScorer(
    scores: Map<string, number>,
    exclude: Set<string>,
  ): string | undefined {
    let best: string | undefined;
    let bestScore = 0;
    for (const [userId, score] of scores) {
      if (exclude.has(userId)) continue;
      if (score > bestScore) {
        best = userId;
        bestScore = score;
      }
    }
    return best;
  }

  private releaseGame(gameId: string) {
    const graceTimer = this.graceTimers.get(gameId);
    if (graceTimer) clearTimeout(graceTimer);
    this.graceTimers.delete(gameId);
    this.graceEnds.delete(gameId);
    this.pedantixEngine.releaseGame(gameId);
    this.scores.delete(gameId);
    this.attempts.delete(gameId);
    this.winners.delete(gameId);
    this.leftPlayers.delete(gameId);
    for (const key of this.lastGuessAt.keys()) {
      if (key.startsWith(`${gameId}:`)) this.lastGuessAt.delete(key);
    }
  }

  async getLeaderboard(limit = 20, sortBy: 'wins' | 'points' = 'wins') {
    const players = await this.prisma.gamePlayer.findMany({
      where: { result: { not: null }, game: { status: GameStatus.FINISHED } },
      include: { users: true },
    });

    const statsByUser = new Map<
      string,
      {
        user: {
          user_id: bigint;
          username: string;
          avatar: string;
          lvl: bigint;
        };
        wins: number;
        games: number;
        totalScore: number;
      }
    >();

    for (const player of players) {
      const key = player.user_id.toString();
      const score = player.score ?? 0;
      const existing = statsByUser.get(key);
      if (existing) {
        existing.games += 1;
        existing.totalScore += score;
        if (player.result === GameResult.WIN) existing.wins += 1;
      } else {
        statsByUser.set(key, {
          user: player.users,
          wins: player.result === GameResult.WIN ? 1 : 0,
          games: 1,
          totalScore: score,
        });
      }
    }

    return Array.from(statsByUser.values())
      .sort((a, b) =>
        sortBy === 'points' ? b.totalScore - a.totalScore : b.wins - a.wins,
      )
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        id: entry.user.user_id.toString(),
        username: entry.user.username,
        avatar: entry.user.avatar,
        level: Number(entry.user.lvl),
        wins: entry.wins,
        gamesPlayed: entry.games,
        totalScore: entry.totalScore,
      }));
  }

  async getResults(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { game_id: BigInt(gameId) },
      include: {
        player: { include: { users: true } },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const players = game.player.map((player) => ({
      userId: player.user_id.toString(),
      username: player.users.username,
      avatar: player.users.avatar,
      result: player.result,
      score: player.score,
      rank: player.rank,
      discoveryRank: player.discovery_rank,
      xpGained: player.xp_gained,
      leveledUp: player.leveled_up,
    }));

    return {
      gameId: game.game_id.toString(),
      articleTitle: game.article_title,
      byScore: [...players].sort(
        (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity),
      ),
      byDiscovery: [...players].sort(
        (a, b) => (a.discoveryRank ?? Infinity) - (b.discoveryRank ?? Infinity),
      ),
    };
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
