import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { MetricsService } from '../../metrics/metrics.service';
import type { MessageView } from '../application/messages/list-messages.use-case';

export interface ConversationUpdatedPayload {
  conversationId: string;
  type: string;
  lastMessage: {
    id: string;
    body: string;
    senderUsername: string;
    createdAt: string;
    senderId: string;
  };
}

@Injectable()
export class ChatRealtimePublisher {
  private readonly logger = new Logger(ChatRealtimePublisher.name);
  private server: Server | null = null;

  constructor(@Optional() private readonly metrics?: MetricsService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  notifyNewMessage(conversationId: string, message: MessageView): void {
    if (!this.server) {
      this.logger.warn({
        op: 'socketEmitFailed',
        conversationId,
        messageId: message.id,
        errorCode: 'SOCKET_EMIT_FAILED',
      });
      this.metrics?.incCounter('chat_socket_emit_failures_total');
      return;
    }
    this.server
      .to(`conv:${conversationId}`)
      .emit('message.new', { conversationId, message });
  }

  /**
   * Emits `chat.conversation.updated` to each member's personal `user:{userId}` room.
   * Used to update conversation lists on any screen in real-time.
   */
  notifyConversationUpdated(
    memberUserIds: string[],
    payload: ConversationUpdatedPayload,
  ): void {
    if (!this.server || memberUserIds.length === 0) return;
    for (const userId of memberUserIds) {
      this.server
        .to(`user:${userId}`)
        .emit('chat.conversation.updated', payload);
    }
  }
}
