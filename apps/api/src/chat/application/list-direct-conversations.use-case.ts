import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

export interface DirectConversationListItem {
  id: string;
  type: string;
  otherUser: {
    id: string;
    username: string;
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
export class ListDirectConversationsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(userId: string): Promise<DirectConversationListItem[]> {
    const conversations = await this.prisma.client.conversation.findMany({
      where: {
        type: 'DIRECT',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: {
          select: {
            id: true,
            username: true,
            avatar: { select: { key: true } },
          },
        },
        userB: {
          select: {
            id: true,
            username: true,
            avatar: { select: { key: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { username: true } } },
        },
      },
    });

    const items: DirectConversationListItem[] = conversations.map((conv) => {
      const other = conv.userAId === userId ? conv.userB! : conv.userA!;
      const lastMsg = conv.messages[0] ?? null;
      return {
        id: conv.id,
        type: conv.type,
        otherUser: {
          id: other.id,
          username: other.username,
          avatarUrl: other.avatar?.key
            ? this.storage.buildPublicUrl(other.avatar.key)
            : null,
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

    items.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.updatedAt;
      const bTime = b.lastMessage?.createdAt ?? b.updatedAt;
      return bTime < aTime ? -1 : bTime > aTime ? 1 : 0;
    });

    return items;
  }
}
