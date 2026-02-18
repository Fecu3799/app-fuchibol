import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateMatchUseCase } from '../application/create-match.use-case';
import { GetMatchUseCase } from '../application/get-match.use-case';
import { ListMatchesQuery } from '../application/list-matches.query';
import { UpdateMatchUseCase } from '../application/update-match.use-case';
import { LockMatchUseCase } from '../application/lock-match.use-case';
import { UnlockMatchUseCase } from '../application/unlock-match.use-case';
import { CancelMatchUseCase } from '../application/cancel-match.use-case';
import { ConfirmParticipationUseCase } from '../application/confirm-participation.use-case';
import { DeclineParticipationUseCase } from '../application/decline-participation.use-case';
import { WithdrawParticipationUseCase } from '../application/withdraw-participation.use-case';
import { InviteParticipationUseCase } from '../application/invite-participation.use-case';
import { LeaveMatchUseCase } from '../application/leave-match.use-case';
import { PromoteAdminUseCase } from '../application/promote-admin.use-case';
import { DemoteAdminUseCase } from '../application/demote-admin.use-case';
import { CreateMatchDto } from './dto/create-match.dto';
import { CreateMatchResponseDto } from './dto/create-match-response.dto';
import { GetMatchResponseDto } from './dto/match-snapshot.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { ListMatchesQueryDto } from './dto/list-matches-query.dto';
import {
  ParticipationCommandDto,
  InviteCommandDto,
} from './dto/participation-command.dto';
import { PromoteAdminDto, DemoteAdminDto } from './dto/admin-command.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';

@Controller('matches')
export class MatchesController {
  constructor(
    private readonly createMatchUseCase: CreateMatchUseCase,
    private readonly getMatchUseCase: GetMatchUseCase,
    private readonly listMatchesQuery: ListMatchesQuery,
    private readonly updateMatchUseCase: UpdateMatchUseCase,
    private readonly lockMatchUseCase: LockMatchUseCase,
    private readonly unlockMatchUseCase: UnlockMatchUseCase,
    private readonly cancelMatchUseCase: CancelMatchUseCase,
    private readonly confirmUseCase: ConfirmParticipationUseCase,
    private readonly declineUseCase: DeclineParticipationUseCase,
    private readonly withdrawUseCase: WithdrawParticipationUseCase,
    private readonly inviteUseCase: InviteParticipationUseCase,
    private readonly leaveMatchUseCase: LeaveMatchUseCase,
    private readonly promoteAdminUseCase: PromoteAdminUseCase,
    private readonly demoteAdminUseCase: DemoteAdminUseCase,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
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
  @Get()
  async list(
    @Query() query: ListMatchesQueryDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.listMatchesQuery.execute({
      actorId: actor.userId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      from: query.from,
      to: query.to,
      view: query.view ?? 'upcoming',
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
  @Throttle({ mutations: {} })
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: UpdateMatchDto,
    @Actor() actor: ActorPayload,
  ) {
    const { expectedRevision, ...fields } = body;
    return this.updateMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision,
      ...fields,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/lock')
  async lock(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.lockMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/unlock')
  async unlock(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.unlockMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/cancel')
  async cancel(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    return this.cancelMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
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
  @Throttle({ mutations: {} })
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
  @Throttle({ mutations: {} })
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
  @Throttle({ mutations: {} })
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
      identifier: body.identifier,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/leave')
  async leave(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    return this.leaveMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/admins')
  async promoteAdmin(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: PromoteAdminDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.promoteAdminUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: body.userId,
      expectedRevision: body.expectedRevision,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Delete(':id/admins/:userId')
  async demoteAdmin(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() body: DemoteAdminDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.demoteAdminUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: userId,
      expectedRevision: body.expectedRevision,
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
