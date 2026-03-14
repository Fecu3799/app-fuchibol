import { Inject, Logger } from '@nestjs/common';
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
import type Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import { ChatRealtimePublisher } from './chat-realtime.publisher';

// TTL in seconds: how long we consider a user as "actively viewing" a conversation.
// Set generously to cover WS reconnect windows without unnecessary push delivery.
const VIEWING_TTL_SECONDS = 90;

function viewingKey(conversationId: string, userId: string): string {
  return `chat:viewing:${conversationId}:${userId}`;
}

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly publisher: ChatRealtimePublisher,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
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
      void client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId || !this.redis) return;
    // Clear active-viewing keys for all conv rooms this socket was in
    for (const room of client.rooms) {
      if (room.startsWith('conv:')) {
        const conversationId = room.slice('conv:'.length);
        void this.redis.del(viewingKey(conversationId, userId));
      }
    }
  }

  @SubscribeMessage('chat.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      client.disconnect();
      return;
    }

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: data.conversationId },
      select: {
        type: true,
        matchId: true,
        groupId: true,
        userAId: true,
        userBId: true,
      },
    });

    if (!conversation) {
      this.logger.warn({
        op: 'wsChatSubscribeDenied',
        reason: 'conversation_not_found',
        conversationId: data.conversationId,
        actorUserId: userId,
      });
      client.emit('error', { errorCode: 'CONVERSATION_NOT_FOUND' });
      return;
    }

    if (conversation.type === 'MATCH' && conversation.matchId) {
      const match = await this.prisma.client.match.findUnique({
        where: { id: conversation.matchId },
        select: { createdById: true },
      });

      if (!match) return;

      const isCreator = match.createdById === userId;
      if (!isCreator) {
        const participant =
          await this.prisma.client.matchParticipant.findUnique({
            where: {
              matchId_userId: { matchId: conversation.matchId, userId },
            },
            select: { status: true },
          });

        const activeStatuses = ['CONFIRMED', 'WAITLISTED', 'SPECTATOR'];
        if (!participant || !activeStatuses.includes(participant.status)) {
          this.logger.warn({
            op: 'wsChatSubscribeDenied',
            reason: 'not_match_member',
            conversationId: data.conversationId,
            actorUserId: userId,
          });
          client.emit('error', { errorCode: 'UNAUTHORIZED_ROOM' });
          return;
        }
      }
    }

    if (conversation.type === 'GROUP' && conversation.groupId) {
      const member = await this.prisma.client.groupMember.findUnique({
        where: { groupId_userId: { groupId: conversation.groupId, userId } },
        select: { groupId: true },
      });
      if (!member) {
        this.logger.warn({
          op: 'wsChatSubscribeDenied',
          reason: 'not_group_member',
          conversationId: data.conversationId,
          actorUserId: userId,
        });
        client.emit('error', { errorCode: 'UNAUTHORIZED_ROOM' });
        return;
      }
    }

    if (conversation.type === 'DIRECT') {
      if (conversation.userAId !== userId && conversation.userBId !== userId) {
        this.logger.warn({
          op: 'wsChatSubscribeDenied',
          reason: 'not_direct_member',
          conversationId: data.conversationId,
          actorUserId: userId,
        });
        client.emit('error', { errorCode: 'UNAUTHORIZED_ROOM' });
        return;
      }
    }

    await client.join(`conv:${data.conversationId}`);

    // Mark user as actively viewing this conversation for push suppression
    if (this.redis) {
      void this.redis.setex(
        viewingKey(data.conversationId, userId),
        VIEWING_TTL_SECONDS,
        '1',
      );
    }
  }

  @SubscribeMessage('chat.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    await client.leave(`conv:${data.conversationId}`);
    const userId = client.data.userId as string | undefined;
    if (userId && this.redis) {
      void this.redis.del(viewingKey(data.conversationId, userId));
    }
  }
}
