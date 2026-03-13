import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { GetMatchConversationUseCase } from '../application/conversations/get-match-conversation.use-case';
import { GetGroupConversationUseCase } from '../application/conversations/get-group-conversation.use-case';
import { ListMessagesUseCase } from '../application/messages/list-messages.use-case';
import { SendMessageUseCase } from '../application/messages/send-message.use-case';
import { ListUserConversationsUseCase } from '../application/conversations/list-user-conversations.use-case';
import { ListGroupConversationsUseCase } from '../application/conversations/list-group-conversations.use-case';
import { GetOrCreateDirectConversationUseCase } from '../application/conversations/get-or-create-direct-conversation.use-case';
import { ListDirectConversationsUseCase } from '../application/conversations/list-direct-conversations.use-case';
import { FindDirectConversationUseCase } from '../application/conversations/find-direct-conversation.use-case';
import { SendFirstDirectMessageUseCase } from '../application/conversations/send-first-direct-message.use-case';
import { ChatRealtimePublisher } from '../realtime/chat-realtime.publisher';
import { ChatNotificationService } from '../application/notifications/chat-notification.service';
import { MarkConversationReadUseCase } from '../application/read/mark-conversation-read.use-case';
import { GetUnreadCountUseCase } from '../application/read/get-unread-count.use-case';
import { SendMessageDto } from './dto/send-message.dto';
import type { MessageView } from '../application/messages/list-messages.use-case';

class StartDirectConversationDto {
  @IsUUID()
  targetUserId!: string;
}

class SendFirstDirectMessageDto {
  @IsUUID()
  targetUserId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @IsUUID()
  clientMsgId!: string;
}

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly getMatchConversation: GetMatchConversationUseCase,
    private readonly getGroupConversationUC: GetGroupConversationUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly listUserConversations: ListUserConversationsUseCase,
    private readonly listGroupConversations: ListGroupConversationsUseCase,
    private readonly getOrCreateDirectConv: GetOrCreateDirectConversationUseCase,
    private readonly listDirectConversations: ListDirectConversationsUseCase,
    private readonly findDirectConv: FindDirectConversationUseCase,
    private readonly sendFirstDirectMsg: SendFirstDirectMessageUseCase,
    private readonly realtimePublisher: ChatRealtimePublisher,
    private readonly chatNotifications: ChatNotificationService,
    private readonly markRead: MarkConversationReadUseCase,
    private readonly getUnreadCount: GetUnreadCountUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('conversations/unread-count')
  async getUnreadConversationCount(
    @Actor() actor: ActorPayload,
  ): Promise<{ total: number }> {
    const total = await this.getUnreadCount.execute(actor.userId);
    return { total };
  }

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
  @Get('conversations/direct/find')
  async findDirectConversation(
    @Query('targetUserId', new ParseUUIDPipe()) targetUserId: string,
    @Actor() actor: ActorPayload,
  ): Promise<{ id: string }> {
    const result = await this.findDirectConv.execute(
      actor.userId,
      targetUserId,
    );
    if (!result) throw new NotFoundException('CONVERSATION_NOT_FOUND');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post('conversations/direct/first-message')
  async sendFirstDirectMessage(
    @Body() body: SendFirstDirectMessageDto,
    @Actor() actor: ActorPayload,
  ): Promise<{ conversationId: string; message: MessageView }> {
    const { conversationId, message, created } =
      await this.sendFirstDirectMsg.execute({
        senderId: actor.userId,
        targetUserId: body.targetUserId,
        body: body.body,
        clientMsgId: body.clientMsgId,
      });

    void this.realtimePublisher.notifyNewMessage(conversationId, message);

    if (created) {
      void this.chatNotifications.onMessageCreated(message).catch((err) =>
        this.logger.warn('chat push notification failed', {
          err,
          conversationId,
        }),
      );
    }

    return { conversationId, message };
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
    const { message, created } = await this.sendMessage.execute({
      conversationId: id,
      senderId: actor.userId,
      body: body.body,
      clientMsgId: body.clientMsgId,
    });

    void this.realtimePublisher.notifyNewMessage(id, message);

    if (created) {
      void this.chatNotifications.onMessageCreated(message).catch((err) =>
        this.logger.warn('chat push notification failed', {
          err,
          conversationId: id,
        }),
      );
    }

    return message;
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/read')
  async markConversationRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Actor() actor: ActorPayload,
  ): Promise<void> {
    await this.markRead.execute(id, actor.userId);
  }
}
