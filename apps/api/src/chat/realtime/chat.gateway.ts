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
import { ChatRealtimePublisher } from './chat-realtime.publisher';

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
      this.logger.warn(
        `WS chat.subscribe: conversation ${data.conversationId} not found`,
      );
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
              matchId_userId: {
                matchId: conversation.matchId,
                userId,
              },
            },
            select: { status: true },
          });

        const activeStatuses = ['CONFIRMED', 'WAITLISTED', 'SPECTATOR'];
        if (!participant || !activeStatuses.includes(participant.status)) {
          this.logger.warn(
            `WS chat.subscribe: user ${userId} denied access to conv ${data.conversationId}`,
          );
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
        this.logger.warn(
          `WS chat.subscribe: user ${userId} denied access to group conv ${data.conversationId}`,
        );
        return;
      }
    }

    if (conversation.type === 'DIRECT') {
      if (conversation.userAId !== userId && conversation.userBId !== userId) {
        this.logger.warn(
          `WS chat.subscribe: user ${userId} denied access to direct conv ${data.conversationId}`,
        );
        return;
      }
    }

    await client.join(`conv:${data.conversationId}`);
  }

  @SubscribeMessage('chat.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    await client.leave(`conv:${data.conversationId}`);
  }
}
