import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { UserService } from './user.service';

type PresenceSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  { userId?: string }
>;

@WebSocketGateway({
  namespace: '/presence',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'https://localhost:8443',
    credentials: true,
  },
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly connections = new Map<string, number>();

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: PresenceSocket) {
    const auth: unknown = client.handshake.auth;
    const token =
      typeof auth === 'object' && auth !== null && 'token' in auth
        ? auth.token
        : undefined;

    if (typeof token !== 'string' || token.length === 0) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      client.data.userId = payload.sub;
      await client.join(this.userRoom(payload.sub));
      const count = (this.connections.get(payload.sub) ?? 0) + 1;
      this.connections.set(payload.sub, count);
      if (count === 1) {
        await this.userService.setPresence(payload.sub, 'ONLINE');
        this.server.emit('presence:update', {
          id: payload.sub,
          status: 'ONLINE',
        });
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: PresenceSocket) {
    const userId = client.data.userId;
    if (!userId) return;

    const count = (this.connections.get(userId) ?? 1) - 1;
    if (count > 0) {
      this.connections.set(userId, count);
      return;
    }

    this.connections.delete(userId);
    try {
      await this.userService.setPresence(userId, 'OFFLINE');
    } catch {
      return;
    }
    this.server.emit('presence:update', { id: userId, status: 'OFFLINE' });
  }

  notifyUser(userId: string, event: string, payload: unknown) {
    this.server.to(this.userRoom(userId)).emit(event, payload);
  }

  broadcastPresence(userId: string, status: 'ONLINE' | 'OFFLINE' | 'IN_GAME') {
    this.server.emit('presence:update', { id: userId, status });
  }
}
