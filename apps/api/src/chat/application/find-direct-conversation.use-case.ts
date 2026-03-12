import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class FindDirectConversationUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    requesterId: string,
    targetUserId: string,
  ): Promise<{ id: string } | null> {
    if (requesterId === targetUserId) {
      throw new UnprocessableEntityException('CANNOT_CHAT_WITH_SELF');
    }

    const [userAId, userBId] =
      requesterId < targetUserId
        ? [requesterId, targetUserId]
        : [targetUserId, requesterId];

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true },
    });

    return conversation ? { id: conversation.id } : null;
  }
}
