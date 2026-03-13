import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MatchChatAccessService } from '../access/match-chat-access.service';
import { GroupChatAccessService } from '../access/group-chat-access.service';
import { DirectChatAccessService } from '../access/direct-chat-access.service';
import { StorageService } from '../../../infra/storage/storage.service';

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  senderAvatarUrl: string | null;
  body: string;
  clientMsgId: string;
  createdAt: Date;
}

export interface ListMessagesResult {
  items: MessageView[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ListMessagesInput {
  conversationId: string;
  actorId: string;
  limit?: number;
  before?: string; // message id cursor
}

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

@Injectable()
export class ListMessagesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MatchChatAccessService,
    private readonly groupAccess: GroupChatAccessService,
    private readonly directAccess: DirectChatAccessService,
    private readonly storage: StorageService,
  ) {}

  async execute(input: ListMessagesInput): Promise<ListMessagesResult> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { id: input.conversationId },
      select: { type: true, matchId: true, groupId: true },
    });

    if (!conversation) {
      throw new NotFoundException('CONVERSATION_NOT_FOUND');
    }

    if (conversation.type === 'MATCH' && conversation.matchId) {
      const { allowed } = await this.access.checkAccess(
        conversation.matchId,
        input.actorId,
      );
      if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');
    }

    if (conversation.type === 'GROUP' && conversation.groupId) {
      const allowed = await this.groupAccess.checkAccess(
        conversation.groupId,
        input.actorId,
      );
      if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');
    }

    if (conversation.type === 'DIRECT') {
      const allowed = await this.directAccess.checkAccess(
        input.conversationId,
        input.actorId,
      );
      if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');
    }

    const rows = await this.prisma.client.message.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'desc' },
      cursor: input.before ? { id: input.before } : undefined,
      skip: input.before ? 1 : 0,
      take: limit + 1,
      include: {
        sender: {
          select: {
            username: true,
            avatar: { select: { key: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    const items: MessageView[] = rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderUsername: m.sender.username,
      senderAvatarUrl: m.sender.avatar?.key
        ? this.storage.buildPublicUrl(m.sender.avatar.key)
        : null,
      body: m.body,
      clientMsgId: m.clientMsgId,
      createdAt: m.createdAt,
    }));

    return {
      items,
      hasMore,
      nextCursor: hasMore ? (rows[rows.length - 1]?.id ?? null) : null,
    };
  }
}
