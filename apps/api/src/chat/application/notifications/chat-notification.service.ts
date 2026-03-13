import { Inject, Injectable } from '@nestjs/common';
import { MatchParticipantStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../../../infra/redis/redis.module';
import { NOTIFICATION_PROVIDER } from '../../../push/notification-provider.interface';
import type {
  NotificationProvider,
  NotificationPayload,
} from '../../../push/notification-provider.interface';
import { ChatRealtimePublisher } from '../../realtime/chat-realtime.publisher';
import type { MessageView } from '../messages/list-messages.use-case';

const ACTIVE_STATUSES = [
  MatchParticipantStatus.CONFIRMED,
  MatchParticipantStatus.WAITLISTED,
  MatchParticipantStatus.SPECTATOR,
];
const MAX_BODY_LENGTH = 100;

type ConversationWithRelations = {
  id: string;
  type: string;
  matchId: string | null;
  groupId: string | null;
  userAId: string | null;
  userBId: string | null;
  match: { title: string } | null;
  group: { name: string } | null;
};

function viewingKey(conversationId: string, userId: string): string {
  return `chat:viewing:${conversationId}:${userId}`;
}

@Injectable()
export class ChatNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: ChatRealtimePublisher,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async onMessageCreated(message: MessageView): Promise<void> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: message.conversationId },
      select: {
        id: true,
        type: true,
        matchId: true,
        groupId: true,
        userAId: true,
        userBId: true,
        match: { select: { title: true } },
        group: { select: { name: true } },
      },
    });

    if (!conversation) return;

    // Recipients = all members EXCEPT sender (for push notification dedup logic)
    const recipientIds = await this.resolveRecipients(
      conversation,
      message.senderId,
    );

    // Notify ALL members (sender + recipients) via WS user rooms for list updates
    this.realtimePublisher.notifyConversationUpdated(
      [message.senderId, ...recipientIds],
      {
        conversationId: conversation.id,
        type: conversation.type,
        lastMessage: {
          id: message.id,
          body: message.body,
          senderUsername: message.senderUsername,
          createdAt:
            message.createdAt instanceof Date
              ? message.createdAt.toISOString()
              : (message.createdAt as string),
          senderId: message.senderId,
        },
      },
    );

    if (recipientIds.length === 0) return;

    // Filter out recipients who are actively viewing the conversation (push suppression)
    const activeRecipients = await this.filterViewingUsers(
      conversation.id,
      recipientIds,
    );
    if (activeRecipients.length === 0) return;

    const payload = this.buildPayload(conversation, message);

    await Promise.allSettled(
      activeRecipients.map((userId) =>
        this.notificationProvider.sendToUser(userId, payload),
      ),
    );
  }

  /**
   * Returns the subset of userIds who are NOT actively viewing the conversation.
   * Fails open: if Redis is unavailable, pushes to everyone (no suppression).
   */
  private async filterViewingUsers(
    conversationId: string,
    userIds: string[],
  ): Promise<string[]> {
    if (!this.redis || userIds.length === 0) return userIds;

    const keys = userIds.map((uid) => viewingKey(conversationId, uid));
    const results = await this.redis.mget(...keys);

    return userIds.filter((_, i) => results[i] === null);
  }

  private async resolveRecipients(
    conversation: ConversationWithRelations,
    senderId: string,
  ): Promise<string[]> {
    if (conversation.type === 'MATCH' && conversation.matchId) {
      const participants = await this.prisma.client.matchParticipant.findMany({
        where: {
          matchId: conversation.matchId,
          status: { in: ACTIVE_STATUSES },
          userId: { not: senderId },
        },
        select: { userId: true },
      });
      return participants.map((p) => p.userId);
    }

    if (conversation.type === 'GROUP' && conversation.groupId) {
      const members = await this.prisma.client.groupMember.findMany({
        where: {
          groupId: conversation.groupId,
          userId: { not: senderId },
        },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }

    if (conversation.type === 'DIRECT') {
      return [conversation.userAId, conversation.userBId].filter(
        (id): id is string => id !== null && id !== senderId,
      );
    }

    return [];
  }

  private buildPayload(
    conversation: ConversationWithRelations,
    message: MessageView,
  ): NotificationPayload {
    const truncated =
      message.body.length > MAX_BODY_LENGTH
        ? message.body.slice(0, MAX_BODY_LENGTH) + '…'
        : message.body;

    if (conversation.type === 'MATCH') {
      return {
        title: conversation.match!.title,
        body: `${message.senderUsername}: ${truncated}`,
        data: {
          type: 'chat_message',
          conversationType: 'MATCH',
          matchId: conversation.matchId,
        },
      };
    }

    if (conversation.type === 'GROUP') {
      return {
        title: conversation.group!.name,
        body: `${message.senderUsername}: ${truncated}`,
        data: {
          type: 'chat_message',
          conversationType: 'GROUP',
          groupId: conversation.groupId,
          groupName: conversation.group!.name,
        },
      };
    }

    // DIRECT
    return {
      title: message.senderUsername,
      body: truncated,
      data: {
        type: 'chat_message',
        conversationType: 'DIRECT',
        conversationId: conversation.id,
        otherUsername: message.senderUsername,
      },
    };
  }
}
