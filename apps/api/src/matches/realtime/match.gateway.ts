import { Logger } from '@nestjs/common';
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
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MatchRealtimePublisher } from './match-realtime.publisher';

@WebSocketGateway({ namespace: '/matches', cors: { origin: '*' } })
export class MatchGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MatchGateway.name);

  constructor(
    private readonly publisher: MatchRealtimePublisher,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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
    // lastKnownRevision accepted for forward compatibility (gap detection)
    @MessageBody() data: { matchId: string; lastKnownRevision?: number },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      client.disconnect();
      return;
    }

    // Verify actor is the creator or has a participation row (any status)
    const match = await this.prisma.client.match.findUnique({
      where: { id: data.matchId },
      select: { createdById: true },
    });

    if (!match) {
      this.logger.warn({
        op: 'wsSubscribeDenied',
        reason: 'match_not_found',
        matchId: data.matchId,
        actorUserId: userId,
      });
      client.emit('error', { errorCode: 'MATCH_NOT_FOUND' });
      return;
    }

    const isCreator = match.createdById === userId;
    if (!isCreator) {
      const participant = await this.prisma.client.matchParticipant.findUnique({
        where: { matchId_userId: { matchId: data.matchId, userId } },
        select: { id: true },
      });
      if (!participant) {
        this.logger.warn({
          op: 'wsSubscribeDenied',
          reason: 'not_member',
          matchId: data.matchId,
          actorUserId: userId,
        });
        client.emit('error', { errorCode: 'UNAUTHORIZED_ROOM' });
        return;
      }
    }

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
