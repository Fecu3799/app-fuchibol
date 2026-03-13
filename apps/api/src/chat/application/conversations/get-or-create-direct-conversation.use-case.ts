import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { ConversationInfo } from './get-match-conversation.use-case';

@Injectable()
export class GetOrCreateDirectConversationUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    requesterId: string,
    targetUserId: string,
  ): Promise<ConversationInfo> {
    if (requesterId === targetUserId) {
      throw new UnprocessableEntityException('CANNOT_CHAT_WITH_SELF');
    }

    const target = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('USER_NOT_FOUND');

    // Canonical ordering: lexicographically smaller UUID is always userA.
    // This guarantees A→B and B→A resolve to the same conversation.
    const [userAId, userBId] =
      requesterId < targetUserId
        ? [requesterId, targetUserId]
        : [targetUserId, requesterId];

    let conversation = await this.prisma.client.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true, type: true },
    });

    if (!conversation) {
      try {
        conversation = await this.prisma.client.conversation.create({
          data: { type: 'DIRECT', userAId, userBId },
          select: { id: true, type: true },
        });
      } catch (err) {
        // Race condition: another request created the conversation concurrently.
        if ((err as { code?: string }).code === 'P2002') {
          conversation = await this.prisma.client.conversation.findUnique({
            where: { userAId_userBId: { userAId, userBId } },
            select: { id: true, type: true },
          });
          if (!conversation) throw err;
        } else {
          throw err;
        }
      }
    }

    return { id: conversation.id, type: conversation.type, isReadOnly: false };
  }
}
