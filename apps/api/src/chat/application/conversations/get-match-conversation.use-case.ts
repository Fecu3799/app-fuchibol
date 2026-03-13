import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MatchChatAccessService } from '../access/match-chat-access.service';

export interface ConversationInfo {
  id: string;
  type: string;
  isReadOnly: boolean;
}

@Injectable()
export class GetMatchConversationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MatchChatAccessService,
  ) {}

  async execute(matchId: string, actorId: string): Promise<ConversationInfo> {
    const { allowed, isReadOnly } = await this.access.checkAccess(
      matchId,
      actorId,
    );

    if (!allowed) {
      throw new ForbiddenException('CHAT_ACCESS_DENIED');
    }

    const conversation = await this.prisma.client.conversation.findUnique({
      where: { matchId },
      select: { id: true, type: true },
    });

    if (!conversation) {
      throw new NotFoundException('CONVERSATION_NOT_FOUND');
    }

    return { id: conversation.id, type: conversation.type, isReadOnly };
  }
}
