import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MatchChatAccessService } from './match-chat-access.service';
import { StorageService } from '../../infra/storage/storage.service';
import type { MessageView } from './list-messages.use-case';

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  body: string;
  clientMsgId: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MatchChatAccessService,
    private readonly storage: StorageService,
  ) {}

  async execute(input: SendMessageInput): Promise<MessageView> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: input.conversationId },
      select: { type: true, matchId: true },
    });

    if (!conversation) {
      throw new NotFoundException('CONVERSATION_NOT_FOUND');
    }

    if (conversation.type === 'MATCH' && conversation.matchId) {
      const { allowed, isReadOnly } = await this.access.checkAccess(
        conversation.matchId,
        input.senderId,
      );

      if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');
      if (isReadOnly) throw new UnprocessableEntityException('CHAT_READ_ONLY');
    }

    // Idempotency via DB unique constraint on (conversationId, senderId, clientMsgId)
    let message = await this.prisma.client.message.findUnique({
      where: {
        conversationId_senderId_clientMsgId: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          clientMsgId: input.clientMsgId,
        },
      },
      include: {
        sender: {
          select: { username: true, avatar: { select: { key: true } } },
        },
      },
    });

    if (!message) {
      message = await this.prisma.client.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          body: input.body.trim(),
          clientMsgId: input.clientMsgId,
        },
        include: {
          sender: {
            select: { username: true, avatar: { select: { key: true } } },
          },
        },
      });
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderUsername: message.sender.username,
      senderAvatarUrl: message.sender.avatar?.key
        ? this.storage.buildPublicUrl(message.sender.avatar.key)
        : null,
      body: message.body,
      clientMsgId: message.clientMsgId,
      createdAt: message.createdAt,
    };
  }
}
