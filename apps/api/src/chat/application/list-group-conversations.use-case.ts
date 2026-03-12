import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface GroupConversationListItem {
  id: string;
  type: string;
  hasUnread: boolean;
  group: {
    id: string;
    name: string;
    avatarUrl: string | null;
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
export class ListGroupConversationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<GroupConversationListItem[]> {
    const conversations = await this.prisma.client.conversation.findMany({
      where: {
        type: 'GROUP',
        group: {
          members: { some: { userId } },
        },
      },
      include: {
        group: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { username: true } } },
        },
      },
    });

    if (conversations.length === 0) return [];

    const readStates = await this.prisma.client.conversationReadState.findMany({
      where: { userId, conversationId: { in: conversations.map((c) => c.id) } },
      select: { conversationId: true, lastReadAt: true },
    });
    const readStateMap = new Map(
      readStates.map((s) => [s.conversationId, s.lastReadAt]),
    );

    const items: GroupConversationListItem[] = conversations.map((conv) => {
      const group = conv.group!;
      const lastMsg = conv.messages[0] ?? null;
      const lastReadAt = readStateMap.get(conv.id) ?? null;
      const hasUnread =
        lastMsg !== null &&
        lastMsg.senderId !== userId &&
        (lastReadAt === null || lastMsg.createdAt > lastReadAt);

      return {
        id: conv.id,
        type: conv.type,
        hasUnread,
        group: {
          id: group.id,
          name: group.name,
          avatarUrl: group.avatarUrl ?? null,
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
