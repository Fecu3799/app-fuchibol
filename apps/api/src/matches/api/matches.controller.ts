import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { CreateMatchUseCase } from '../application/create-match.use-case';
import { GetMatchUseCase } from '../application/get-match.use-case';
import { ConfirmParticipationUseCase } from '../application/confirm-participation.use-case';
import { DeclineParticipationUseCase } from '../application/decline-participation.use-case';
import { WithdrawParticipationUseCase } from '../application/withdraw-participation.use-case';
import { InviteParticipationUseCase } from '../application/invite-participation.use-case';
import { CreateMatchDto } from './dto/create-match.dto';
import { CreateMatchResponseDto } from './dto/create-match-response.dto';
import { GetMatchResponseDto } from './dto/match-snapshot.dto';
import {
  ParticipationCommandDto,
  InviteCommandDto,
} from './dto/participation-command.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly createMatchUseCase: CreateMatchUseCase,
    private readonly getMatchUseCase: GetMatchUseCase,
    private readonly confirmUseCase: ConfirmParticipationUseCase,
    private readonly declineUseCase: DeclineParticipationUseCase,
    private readonly withdrawUseCase: WithdrawParticipationUseCase,
    private readonly inviteUseCase: InviteParticipationUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: CreateMatchDto,
    @Actor() actor: ActorPayload,
  ): Promise<CreateMatchResponseDto> {
    return this.createMatchUseCase.execute({
      ...body,
      createdById: actor.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Actor() actor: ActorPayload,
  ): Promise<GetMatchResponseDto> {
    const match = await this.getMatchUseCase.execute(id, actor.userId);
    return { match };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirm')
  async confirm(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    return this.confirmUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/decline')
  async decline(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    return this.declineUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/withdraw')
  async withdraw(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    return this.withdrawUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/invite')
  async invite(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: InviteCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    return this.inviteUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: body.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  private requireIdempotencyKey(
    key: string | undefined,
  ): asserts key is string {
    if (!key) {
      throw new UnprocessableEntityException(
        'Idempotency-Key header is required',
      );
    }
  }
}
