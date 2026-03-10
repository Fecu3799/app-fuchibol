import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { GetMatchConversationUseCase } from '../application/get-match-conversation.use-case';
import { GetGroupConversationUseCase } from '../application/get-group-conversation.use-case';
import { ListMessagesUseCase } from '../application/list-messages.use-case';
import { SendMessageUseCase } from '../application/send-message.use-case';
import { ListUserConversationsUseCase } from '../application/list-user-conversations.use-case';
import { ListGroupConversationsUseCase } from '../application/list-group-conversations.use-case';
import { GetOrCreateDirectConversationUseCase } from '../application/get-or-create-direct-conversation.use-case';
import { ListDirectConversationsUseCase } from '../application/list-direct-conversations.use-case';
import { ChatRealtimePublisher } from '../realtime/chat-realtime.publisher';
import { SendMessageDto } from './dto/send-message.dto';

class StartDirectConversationDto {
  @IsUUID()
  targetUserId!: string;
}

@Controller()
export class ChatController {
  constructor(
    private readonly getMatchConversation: GetMatchConversationUseCase,
    private readonly getGroupConversationUC: GetGroupConversationUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly listUserConversations: ListUserConversationsUseCase,
    private readonly listGroupConversations: ListGroupConversationsUseCase,
    private readonly getOrCreateDirectConv: GetOrCreateDirectConversationUseCase,
    private readonly listDirectConversations: ListDirectConversationsUseCase,
    private readonly realtimePublisher: ChatRealtimePublisher,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  async getConversations(@Actor() actor: ActorPayload) {
    return this.listUserConversations.execute(actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/groups')
  async getGroupConversations(@Actor() actor: ActorPayload) {
    return this.listGroupConversations.execute(actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/direct')
  async getDirectConversations(@Actor() actor: ActorPayload) {
    return this.listDirectConversations.execute(actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/direct')
  async startDirectConversation(
    @Body() body: StartDirectConversationDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.getOrCreateDirectConv.execute(actor.userId, body.targetUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('groups/:groupId/conversation')
  async getGroupConversation(
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Actor() actor: ActorPayload,
  ) {
    return this.getGroupConversationUC.execute(groupId, actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('matches/:matchId/conversation')
  async getConversation(
    @Param('matchId', new ParseUUIDPipe()) matchId: string,
    @Actor() actor: ActorPayload,
  ) {
    return this.getMatchConversation.execute(matchId, actor.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Actor() actor?: ActorPayload,
  ) {
    return this.listMessages.execute({
      conversationId: id,
      actorId: actor!.userId,
      limit: limit ? parseInt(limit, 10) : undefined,
      before,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post('conversations/:id/messages')
  async postMessage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SendMessageDto,
    @Actor() actor: ActorPayload,
  ) {
    const message = await this.sendMessage.execute({
      conversationId: id,
      senderId: actor.userId,
      body: body.body,
      clientMsgId: body.clientMsgId,
    });

    void this.realtimePublisher.notifyNewMessage(id, message);

    return message;
  }
}
