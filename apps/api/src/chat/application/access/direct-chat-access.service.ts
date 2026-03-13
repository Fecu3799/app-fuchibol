import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

@Injectable()
export class DirectChatAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAccess(conversationId: string, userId: string): Promise<boolean> {
    const conv = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    });
    if (!conv) return false;
    return conv.userAId === userId || conv.userBId === userId;
  }
}
