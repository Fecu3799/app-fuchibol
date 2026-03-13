import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MatchChatAccessService } from '../access/match-chat-access.service';
import { GroupChatAccessService } from '../access/group-chat-access.service';
import { DirectChatAccessService } from '../access/direct-chat-access.service';
import { StorageService } from '../../../infra/storage/storage.service';
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
    private readonly groupAccess: GroupChatAccessService,
    private readonly directAccess: DirectChatAccessService,
    private readonly storage: StorageService,
  ) {}

  async execute(
    input: SendMessageInput,
  ): Promise<{ message: MessageView; created: boolean }> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: input.conversationId },
      select: { type: true, matchId: true, groupId: true },
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

    if (conversation.type === 'GROUP' && conversation.groupId) {
      const allowed = await this.groupAccess.checkAccess(
        conversation.groupId,
        input.senderId,
      );
      if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');
    }

    if (conversation.type === 'DIRECT') {
      const allowed = await this.directAccess.checkAccess(
        input.conversationId,
        input.senderId,
      );
      if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');
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

    let created = false;
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
      created = true;
    }

    return {
      message: {
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
      },
      created,
    };
  }
}
