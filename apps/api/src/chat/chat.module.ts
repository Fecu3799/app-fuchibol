import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { StorageModule } from '../infra/storage/storage.module';
import { ChatRealtimeModule } from './realtime/chat-realtime.module';
import { PushModule } from '../push/push.module';
import { ChatController } from './api/chat.controller';
import { MatchChatAccessService } from './application/access/match-chat-access.service';
import { GetMatchConversationUseCase } from './application/conversations/get-match-conversation.use-case';
import { ListMessagesUseCase } from './application/messages/list-messages.use-case';
import { SendMessageUseCase } from './application/messages/send-message.use-case';
import { ListUserConversationsUseCase } from './application/conversations/list-user-conversations.use-case';
import { GroupChatAccessService } from './application/access/group-chat-access.service';
import { GetGroupConversationUseCase } from './application/conversations/get-group-conversation.use-case';
import { ListGroupConversationsUseCase } from './application/conversations/list-group-conversations.use-case';
import { DirectChatAccessService } from './application/access/direct-chat-access.service';
import { GetOrCreateDirectConversationUseCase } from './application/conversations/get-or-create-direct-conversation.use-case';
import { ListDirectConversationsUseCase } from './application/conversations/list-direct-conversations.use-case';
import { FindDirectConversationUseCase } from './application/conversations/find-direct-conversation.use-case';
import { SendFirstDirectMessageUseCase } from './application/conversations/send-first-direct-message.use-case';
import { ChatNotificationService } from './application/notifications/chat-notification.service';
import { MarkConversationReadUseCase } from './application/read/mark-conversation-read.use-case';
import { GetUnreadCountUseCase } from './application/read/get-unread-count.use-case';

@Module({
  imports: [PrismaModule, StorageModule, ChatRealtimeModule, PushModule],
  controllers: [ChatController],
  providers: [
    MatchChatAccessService,
    GroupChatAccessService,
    GetMatchConversationUseCase,
    GetGroupConversationUseCase,
    ListMessagesUseCase,
    SendMessageUseCase,
    ListUserConversationsUseCase,
    ListGroupConversationsUseCase,
    DirectChatAccessService,
    GetOrCreateDirectConversationUseCase,
    ListDirectConversationsUseCase,
    FindDirectConversationUseCase,
    SendFirstDirectMessageUseCase,
    ChatNotificationService,
    MarkConversationReadUseCase,
    GetUnreadCountUseCase,
  ],
})
export class ChatModule {}
