import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { MessageView } from '../application/list-messages.use-case';

@Injectable()
export class ChatRealtimePublisher {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  notifyNewMessage(conversationId: string, message: MessageView): void {
    if (!this.server) return;
    this.server
      .to(`conv:${conversationId}`)
      .emit('message.new', { conversationId, message });
  }
}
