import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GameService } from './game.service';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';

type GameSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string; gameId?: string }
>;
type GameServer = Server<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string; gameId?: string }
>;
type GamePayload = { gameId: string };
type GuessPayload = GamePayload & { guess: string };

const gameSocketName = (gameId: string) => `game:${gameId}`;

@WebSocketGateway({
  namespace: '/games',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'https://localhost:8443',
    credentials: true,
  },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  private server!: GameServer;

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.gameService.onStateChange((gameId) => {
      void this.emitGameState(gameId);
    });
  }

  handleConnection(client: GameSocket) {
    const auth: unknown = client.handshake.auth;
    const token =
      typeof auth === 'object' && auth !== null && 'token' in auth
        ? auth.token
        : undefined;
    if (typeof token !== 'string' || token.length === 0) {
      client.emit('auth:error', {
        message: 'Authentication token is required',
      });
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      client.data.userId = payload.sub;
    } catch {
      client.emit('auth:error', {
        message: 'Authentication token is invalid or expired',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: GameSocket) {
    const gameId = client.data.gameId;
    client.data.userId = undefined;
    client.data.gameId = undefined;
    // A closed tab or lost connection changes the online count of the game.
    if (gameId) void this.emitGameState(gameId);
  }

  @SubscribeMessage('game:join')
  async joinGame(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: GamePayload,
  ) {
    const userId = this.requireUser(client);
    const gameId = this.requireGameId(payload);
    await this.gameService.assertPlayer(gameId, userId);
    if (this.gameService.hasLeft(gameId, userId)) {
      throw new WsException('You have left this game and cannot rejoin');
    }
    await client.join(gameSocketName(gameId));
    client.data.gameId = gameId;
    // Everyone receives the new state, so the online count includes this player.
    await this.emitGameState(gameId);
  }

  @SubscribeMessage('game:leave')
  async leaveGame(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: GamePayload,
  ) {
    const userId = this.requireUser(client);
    const gameId = this.requireGameId(payload);
    await this.gameService.leaveGame(gameId, userId);
    await client.leave(gameSocketName(gameId));
    client.data.gameId = undefined;
  }

  @SubscribeMessage('game:guess')
  async guess(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: GuessPayload,
  ) {
    const userId = this.requireUser(client);
    const gameId = this.requireGameId(payload);

    if (!payload || typeof payload.guess !== 'string') {
      throw new WsException('A guess is required');
    }
    if (!client.rooms.has(gameSocketName(gameId))) {
      throw new WsException('Socket has not joined this game');
    }

    const state = await this.gameService.getState(gameId);
    if (state.status !== 'running') {
      throw new WsException(
        state.status === 'countdown'
          ? 'The game is still preparing the article'
          : 'The game is not accepting guesses',
      );
    }
    if (!state.article) {
      throw new WsException('The article is not ready yet');
    }

    const result = await this.gameService.submitGuess(
      gameId,
      userId,
      payload.guess,
    );
    // The board is shared: valid guesses are announced to the whole game.
    // Rejected ones (not a word, duplicate...) only concern the sender.
    // The new game state is emitted by GameService through onStateChange.
    if (result.valid) {
      const sockets = await this.server
        .in(gameSocketName(gameId))
        .fetchSockets();
      const { revealsTitleWord, ...publicResult } = result;
      for (const socket of sockets) {
        socket.emit('game:guess-result', {
          ...publicResult,
          guess:
            socket.data.userId === result.userId || !revealsTitleWord
              ? publicResult.guess
              : '—',
        });
      }
    } else {
      client.emit('game:guess-result', result);
    }
  }

  private async emitGameState(gameId: string) {
    const sockets = await this.server.in(gameSocketName(gameId)).fetchSockets();
    // Players with at least one open tab on the game, whatever their room status.
    const onlinePlayerIds = [
      ...new Set(
        sockets
          .map((socket) => socket.data.userId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];
    await Promise.all(
      sockets.map(async (socket) => {
        socket.emit('game:state', {
          ...(await this.gameService.getState(gameId, socket.data.userId)),
          onlinePlayerIds,
        });
      }),
    );
  }

  private requireUser(client: GameSocket) {
    if (!client.data.userId) throw new WsException('Unauthorized');
    return client.data.userId;
  }

  private requireGameId(payload: GamePayload) {
    if (
      !payload ||
      typeof payload.gameId !== 'string' ||
      !/^\d+$/.test(payload.gameId)
    ) {
      throw new WsException('A valid game ID is required');
    }
    return payload.gameId;
  }
}
