import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { StorageModule } from '../infra/storage/storage.module';
import { ChatRealtimeModule } from './realtime/chat-realtime.module';
import { ChatController } from './api/chat.controller';
import { MatchChatAccessService } from './application/match-chat-access.service';
import { GetMatchConversationUseCase } from './application/get-match-conversation.use-case';
import { ListMessagesUseCase } from './application/list-messages.use-case';
import { SendMessageUseCase } from './application/send-message.use-case';
import { ListUserConversationsUseCase } from './application/list-user-conversations.use-case';
import { GroupChatAccessService } from './application/group-chat-access.service';
import { GetGroupConversationUseCase } from './application/get-group-conversation.use-case';
import { ListGroupConversationsUseCase } from './application/list-group-conversations.use-case';
import { DirectChatAccessService } from './application/direct-chat-access.service';
import { GetOrCreateDirectConversationUseCase } from './application/get-or-create-direct-conversation.use-case';
import { ListDirectConversationsUseCase } from './application/list-direct-conversations.use-case';

@Module({
  imports: [PrismaModule, StorageModule, ChatRealtimeModule],
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
  ],
})
export class ChatModule {}
