import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const READONLY_STATUSES = ['played', 'canceled'] as const;
const ACTIVE_STATUSES = ['CONFIRMED', 'WAITLISTED', 'SPECTATOR'] as const;

export interface MatchConversationListItem {
  id: string;
  type: string;
  isReadOnly: boolean;
  hasUnread: boolean;
  match: {
    id: string;
    title: string;
    status: string;
    startsAt: string;
  };
  lastMessage: {
    id: string;
    body: string;
    senderUsername: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

@Injectable()
export class ListUserConversationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<MatchConversationListItem[]> {
    const conversations = await this.prisma.client.conversation.findMany({
      where: {
        type: 'MATCH',
        match: {
          status: { notIn: [...READONLY_STATUSES] },
          OR: [
            { createdById: userId },
            {
              participants: {
                some: {
                  userId,
                  status: { in: [...ACTIVE_STATUSES] },
                },
              },
            },
          ],
        },
      },
      include: {
        match: {
          select: {
            id: true,
            title: true,
            status: true,
            startsAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { username: true } },
          },
        },
      },
    });

    if (conversations.length === 0) return [];

    // Fetch read states for all conversations in one query
    const readStates = await this.prisma.client.conversationReadState.findMany({
      where: { userId, conversationId: { in: conversations.map((c) => c.id) } },
      select: { conversationId: true, lastReadAt: true },
    });
    const readStateMap = new Map(
      readStates.map((s) => [s.conversationId, s.lastReadAt]),
    );

    const items: MatchConversationListItem[] = conversations.map((conv) => {
      const match = conv.match!;
      const lastMsg = conv.messages[0] ?? null;
      const isReadOnly = (READONLY_STATUSES as readonly string[]).includes(
        match.status as string,
      );
      const lastReadAt = readStateMap.get(conv.id) ?? null;
      const hasUnread =
        lastMsg !== null &&
        lastMsg.senderId !== userId &&
        (lastReadAt === null || lastMsg.createdAt > lastReadAt);

      return {
        id: conv.id,
        type: conv.type,
        isReadOnly,
        hasUnread,
        match: {
          id: match.id,
          title: match.title,
          status: match.status as string,
          startsAt: match.startsAt.toISOString(),
        },
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              body: lastMsg.body,
              senderUsername: lastMsg.sender.username,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        updatedAt: conv.updatedAt.toISOString(),
      };
    });

    // Sort by last message time (or conversation updatedAt) descending
    items.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
      const bTime = b.lastMessage?.createdAt ?? b.updatedAt;
      return bTime < aTime ? -1 : bTime > aTime ? 1 : 0;
    });

    return items;
  }
}
