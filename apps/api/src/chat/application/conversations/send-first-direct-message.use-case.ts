import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { StorageService } from '../../../infra/storage/storage.service';
import type { MessageView } from '../messages/list-messages.use-case';

export interface SendFirstDirectMessageInput {
  senderId: string;
  targetUserId: string;
  body: string;
  clientMsgId: string;
}

@Injectable()
export class SendFirstDirectMessageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(input: SendFirstDirectMessageInput): Promise<{
    conversationId: string;
    message: MessageView;
    created: boolean;
  }> {
    if (input.senderId === input.targetUserId) {
      throw new UnprocessableEntityException('CANNOT_CHAT_WITH_SELF');
    }

    const target = await this.prisma.client.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('USER_NOT_FOUND');

    // Canonical ordering: lexicographically smaller UUID is always userA.
    // Guarantees A→B and B→A resolve to the same conversation.
    const [userAId, userBId] =
      input.senderId < input.targetUserId
        ? [input.senderId, input.targetUserId]
        : [input.targetUserId, input.senderId];

    // Get or create conversation — handles concurrent creation via P2002.
    let conversation = await this.prisma.client.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true },
    });

    if (!conversation) {
      try {
        conversation = await this.prisma.client.conversation.create({
          data: { type: 'DIRECT', userAId, userBId },
          select: { id: true },
        });
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') {
          conversation = await this.prisma.client.conversation.findUnique({
            where: { userAId_userBId: { userAId, userBId } },
            select: { id: true },
          });
          if (!conversation) throw err;
        } else {
          throw err;
        }
      }
    }

    const conversationId = conversation.id;

    // Idempotency via DB unique constraint on (conversationId, senderId, clientMsgId).
    let message = await this.prisma.client.message.findUnique({
      where: {
        conversationId_senderId_clientMsgId: {
          conversationId,
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
          conversationId,
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
      conversationId,
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
