import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchRealtimePublisher } from './match-realtime.publisher';

@WebSocketGateway({ namespace: '/matches', cors: { origin: '*' } })
export class MatchGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly publisher: MatchRealtimePublisher,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server): void {
    this.publisher.setServer(server);
  }

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string; role: string }>(
        token,
      );
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // rooms cleaned up automatically by socket.io
  }

  @SubscribeMessage('match.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ): Promise<void> {
    await client.join(`match:${data.matchId}`);
  }

  @SubscribeMessage('match.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ): Promise<void> {
    await client.leave(`match:${data.matchId}`);
  }
}
