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
import type { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

type GameSocket = Socket & { data: { userId?: string } };
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
  private server!: Server;

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.gameService.onStateChange((gameId, state) => {
      this.server.to(gameSocketName(gameId)).emit('game:state', state);
    });
  }

  handleConnection(client: GameSocket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      client.emit('auth:error', { message: 'Authentication token is required' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      client.data.userId = payload.sub;
    } catch {
      client.emit('auth:error', { message: 'Authentication token is invalid or expired' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: GameSocket) {
    client.data.userId = undefined;
  }

  @SubscribeMessage('game:join')
  async joinGame(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: GamePayload,
  ) {
    const userId = this.requireUser(client);
    const gameId = this.requireGameId(payload);
    await this.gameService.assertPlayer(gameId, userId);
    await client.join(gameSocketName(gameId));
    client.emit('game:state', await this.gameService.getState(gameId));
  }

  @SubscribeMessage('game:leave')
  async leaveGame(
    @ConnectedSocket() client: GameSocket,
    @MessageBody() payload: GamePayload,
  ) {
    this.requireUser(client);
    const gameId = this.requireGameId(payload);
    await client.leave(gameSocketName(gameId));
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
    this.server.to(gameSocketName(gameId)).emit('game:guess-result', result);
    this.server
      .to(gameSocketName(gameId))
      .emit('game:state', await this.gameService.getState(gameId));
  }

  private requireUser(client: GameSocket) {
    if (!client.data.userId) throw new WsException('Unauthorized');
    return client.data.userId;
  }

  private requireGameId(payload: GamePayload) {
    if (!payload || typeof payload.gameId !== 'string' || !/^\d+$/.test(payload.gameId)) {
      throw new WsException('A valid game ID is required');
    }
    return payload.gameId;
  }
}
