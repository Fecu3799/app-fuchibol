import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { GroupChatAccessService } from '../access/group-chat-access.service';
import type { ConversationInfo } from './get-match-conversation.use-case';

@Injectable()
export class GetGroupConversationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GroupChatAccessService,
  ) {}

  async execute(groupId: string, userId: string): Promise<ConversationInfo> {
    const allowed = await this.access.checkAccess(groupId, userId);
    if (!allowed) throw new ForbiddenException('CHAT_ACCESS_DENIED');

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { groupId },
      select: { id: true, type: true },
    });

    if (!conversation) throw new NotFoundException('CONVERSATION_NOT_FOUND');

    return { id: conversation.id, type: conversation.type, isReadOnly: false };
  }
}
