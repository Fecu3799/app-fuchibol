import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Actor } from '../decorators/actor.decorator';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { ListSessionsQuery } from '../application/list-sessions.query';
import { RevokeSessionCommand } from '../application/revoke-session.command';

@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(
    private readonly listSessionsQuery: ListSessionsQuery,
    private readonly revokeSessionCommand: RevokeSessionCommand,
  ) {}

  @Get()
  async listSessions(@Actor() actor: ActorPayload) {
    return this.listSessionsQuery.execute(actor.userId, actor.sessionId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('id') sessionId: string,
    @Actor() actor: ActorPayload,
  ) {
    await this.revokeSessionCommand.execute(sessionId, actor.userId);
  }
}
