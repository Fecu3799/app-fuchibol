import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { StorageModule } from '../infra/storage/storage.module';
import { ChatRealtimeModule } from './realtime/chat-realtime.module';
import { ChatController } from './api/chat.controller';
import { MatchChatAccessService } from './application/match-chat-access.service';
import { GetMatchConversationUseCase } from './application/get-match-conversation.use-case';
import { ListMessagesUseCase } from './application/list-messages.use-case';
import { SendMessageUseCase } from './application/send-message.use-case';

@Module({
  imports: [PrismaModule, StorageModule, ChatRealtimeModule],
  controllers: [ChatController],
  providers: [
    MatchChatAccessService,
    GetMatchConversationUseCase,
    ListMessagesUseCase,
    SendMessageUseCase,
  ],
})
export class ChatModule {}
