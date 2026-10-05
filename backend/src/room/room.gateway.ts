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
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { RoomService } from './room.service';

type AuthenticatedSocket = Socket & {
  data: {
    user?: {
      userId: string;
      email: string;
    };
  };
};

type RoomPayload = {
  roomId: string;
};

type ChatPayload = RoomPayload & {
  text: string;
};

const roomSocketName = (roomId: string) => `room:${roomId}`;

@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RoomGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly roomService: RoomService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: AuthenticatedSocket) {
    const token = client.handshake.auth?.token;

    if (typeof token !== 'string' || token.length === 0) {
      client.emit('auth:error', {
        message: 'Authentication token is required',
      });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
      );
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
      };
    } catch {
      client.emit('auth:error', {
        message: 'Authentication token is invalid or expired',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    client.data.user = undefined;
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RoomPayload,
  ) {
    const user = this.requireUser(client);
    const roomId = this.requireRoomId(payload);

    await this.roomService.assertMember(roomId, user.userId);
    await client.join(roomSocketName(roomId));

    const room = await this.roomService.find(roomId);
    this.server.to(roomSocketName(roomId)).emit('room:state', room);
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: RoomPayload,
  ) {
    const user = this.requireUser(client);
    const roomId = this.requireRoomId(payload);

    await this.roomService.assertMember(roomId, user.userId);
    await client.leave(roomSocketName(roomId));
  }

  @SubscribeMessage('chat:send')
  async sendChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ChatPayload,
  ) {
    const user = this.requireUser(client);
    const roomId = this.requireRoomId(payload);

    if (typeof payload.text !== 'string') {
      throw new WsException('Message text is required');
    }

    const text = payload.text.trim();
    if (text.length === 0) {
      throw new WsException('Message cannot be empty');
    }

    if (text.length > 500) {
      throw new WsException('Message cannot exceed 500 characters');
    }

    const message = await this.roomService.createChatMessage(
      roomId,
      user.userId,
      text,
    );

    this.server.to(roomSocketName(roomId)).emit('chat:message', message);
  }

  emitRoomState(roomId: string, room: unknown) {
    this.server.to(roomSocketName(roomId)).emit('room:state', room);
  }

  emitRoomStarted(roomId: string, result: unknown) {
    this.server.to(roomSocketName(roomId)).emit('room:started', result);
  }

  private requireUser(client: AuthenticatedSocket) {
    if (!client.data.user) {
      throw new WsException('Unauthorized');
    }

    return client.data.user;
  }

  private requireRoomId(payload: RoomPayload) {
    if (
      !payload ||
      typeof payload.roomId !== 'string' ||
      !/^\d+$/.test(payload.roomId)
    ) {
      throw new WsException('A valid room ID is required');
    }

    return payload.roomId;
  }
}