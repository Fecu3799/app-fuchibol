import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

const MATCH_ACTIVE_STATUSES = ['CONFIRMED', 'WAITLISTED', 'SPECTATOR'] as const;
const MATCH_READONLY_STATUSES = ['played', 'canceled'] as const;

@Injectable()
export class GetUnreadCountUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<number> {
    const [matchConvs, groupConvs, directConvs] = await Promise.all([
      this.prisma.client.conversation.findMany({
        where: {
          type: 'MATCH',
          match: {
            status: { notIn: [...MATCH_READONLY_STATUSES] },
            OR: [
              { createdById: userId },
              {
                participants: {
                  some: { userId, status: { in: [...MATCH_ACTIVE_STATUSES] } },
                },
              },
            ],
          },
        },
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { senderId: true, createdAt: true },
          },
        },
      }),
      this.prisma.client.conversation.findMany({
        where: {
          type: 'GROUP',
          group: { members: { some: { userId } } },
        },
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { senderId: true, createdAt: true },
          },
        },
      }),
      this.prisma.client.conversation.findMany({
        where: {
          type: 'DIRECT',
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { senderId: true, createdAt: true },
          },
        },
      }),
    ]);

    const allConvs = [...matchConvs, ...groupConvs, ...directConvs];
    if (allConvs.length === 0) return 0;

    const allIds = allConvs.map((c) => c.id);
    const readStates = await this.prisma.client.conversationReadState.findMany({
      where: { userId, conversationId: { in: allIds } },
      select: { conversationId: true, lastReadAt: true },
    });
    const readMap = new Map(
      readStates.map((r) => [r.conversationId, r.lastReadAt]),
    );

    let count = 0;
    for (const conv of allConvs) {
      const lastMsg = conv.messages[0];
      if (!lastMsg) continue;
      if (lastMsg.senderId === userId) continue;
      const lastReadAt = readMap.get(conv.id) ?? null;
      if (lastReadAt === null || lastMsg.createdAt > lastReadAt) count++;
    }
    return count;
  }
}
