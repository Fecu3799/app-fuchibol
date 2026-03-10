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
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { GetMatchConversationUseCase } from '../application/get-match-conversation.use-case';
import { ListMessagesUseCase } from '../application/list-messages.use-case';
import { SendMessageUseCase } from '../application/send-message.use-case';
import { ChatRealtimePublisher } from '../realtime/chat-realtime.publisher';
import { SendMessageDto } from './dto/send-message.dto';

@Controller()
export class ChatController {
  constructor(
    private readonly getMatchConversation: GetMatchConversationUseCase,
    private readonly listMessages: ListMessagesUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly realtimePublisher: ChatRealtimePublisher,
  ) {}

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
