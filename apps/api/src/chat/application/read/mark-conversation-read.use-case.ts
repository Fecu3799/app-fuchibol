import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

@Injectable()
export class MarkConversationReadUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(conversationId: string, userId: string): Promise<void> {
    const exists = await this.prisma.client.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('CONVERSATION_NOT_FOUND');

    await this.prisma.client.conversationReadState.upsert({
      where: { userId_conversationId: { userId, conversationId } },
      create: { userId, conversationId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }
}
