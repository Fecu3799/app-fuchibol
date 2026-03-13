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
import { CreateMatchUseCase } from '../application/editing/create-match.use-case';
import { GetMatchUseCase } from '../application/queries/get-match.use-case';
import { ListMatchesQuery } from '../application/queries/list-matches.query';
import { UpdateMatchUseCase } from '../application/editing/update-match.use-case';
import { LockMatchUseCase } from '../application/lifecycle/lock-match.use-case';
import { UnlockMatchUseCase } from '../application/lifecycle/unlock-match.use-case';
import { CancelMatchUseCase } from '../application/lifecycle/cancel-match.use-case';
import { ConfirmParticipationUseCase } from '../application/participation/confirm-participation.use-case';
import { RejectInviteUseCase } from '../application/participation/reject-invite.use-case';
import { ToggleSpectatorUseCase } from '../application/participation/toggle-spectator.use-case';
import { InviteParticipationUseCase } from '../application/participation/invite-participation.use-case';
import { LeaveMatchUseCase } from '../application/participation/leave-match.use-case';
import { PromoteAdminUseCase } from '../application/participation/promote-admin.use-case';
import { DemoteAdminUseCase } from '../application/participation/demote-admin.use-case';
import { GetMatchAuditLogsQuery } from '../application/queries/get-match-audit-logs.query';
import { GetInviteCandidatesQuery } from '../application/queries/get-invite-candidates.query';
import { KickParticipantUseCase } from '../application/participation/kick-participant.use-case';
import { SaveTeamsUseCase } from '../application/teams/save-teams.use-case';
import { GenerateRandomTeamsUseCase } from '../application/teams/generate-random-teams.use-case';
import { GenerateBalancedTeamsUseCase } from '../application/teams/generate-balanced-teams.use-case';
import { MoveTeamPlayerUseCase } from '../application/teams/move-team-player.use-case';
import { BlockTeamAutoGenUseCase } from '../application/teams/block-team-autogen.use-case';
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
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { InviteCandidatesQueryDto } from './dto/invite-candidates-query.dto';
import { KickParticipantDto } from './dto/kick-participant.dto';
import {
  SaveTeamsDto,
  GenerateTeamsDto,
  MoveTeamPlayerDto,
} from './dto/team-command.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Actor } from '../../auth/decorators/actor.decorator';
import type { ActorPayload } from '../../auth/interfaces/actor-payload.interface';
import { MatchRealtimePublisher } from '../realtime/match-realtime.publisher';
import type { MatchSnapshot } from '../application/shared/match-snapshot.service';

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
    private readonly rejectInviteUseCase: RejectInviteUseCase,
    private readonly toggleSpectatorUseCase: ToggleSpectatorUseCase,
    private readonly inviteUseCase: InviteParticipationUseCase,
    private readonly leaveMatchUseCase: LeaveMatchUseCase,
    private readonly promoteAdminUseCase: PromoteAdminUseCase,
    private readonly demoteAdminUseCase: DemoteAdminUseCase,
    private readonly realtimePublisher: MatchRealtimePublisher,
    private readonly getMatchAuditLogsQuery: GetMatchAuditLogsQuery,
    private readonly getInviteCandidatesQuery: GetInviteCandidatesQuery,
    private readonly kickParticipantUseCase: KickParticipantUseCase,
    private readonly saveTeamsUseCase: SaveTeamsUseCase,
    private readonly generateRandomTeamsUseCase: GenerateRandomTeamsUseCase,
    private readonly generateBalancedTeamsUseCase: GenerateBalancedTeamsUseCase,
    private readonly moveTeamPlayerUseCase: MoveTeamPlayerUseCase,
    private readonly blockTeamAutoGenUseCase: BlockTeamAutoGenUseCase,
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
    const snapshot: MatchSnapshot = await this.updateMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision,
      ...fields,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/lock')
  async lock(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot = await this.lockMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/unlock')
  async unlock(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot = await this.unlockMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
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
    const snapshot: MatchSnapshot = await this.cancelMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
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
    const snapshot: MatchSnapshot = await this.confirmUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  /** @deprecated Use POST :id/reject — kept for mobile backwards compat until PR 3. */
  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/decline')
  async decline(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const snapshot: MatchSnapshot = await this.rejectInviteUseCase.execute({
      matchId,
      actorId: actor.userId,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/reject')
  async reject(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const snapshot: MatchSnapshot = await this.rejectInviteUseCase.execute({
      matchId,
      actorId: actor.userId,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/spectator')
  async toggleSpectator(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: ParticipationCommandDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Actor() actor: ActorPayload,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const snapshot: MatchSnapshot = await this.toggleSpectatorUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
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
    const snapshot: MatchSnapshot = await this.inviteUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: body.userId,
      identifier: body.identifier,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
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
    const snapshot: MatchSnapshot = await this.leaveMatchUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      idempotencyKey,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/admins')
  async promoteAdmin(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: PromoteAdminDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot = await this.promoteAdminUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: body.userId,
      expectedRevision: body.expectedRevision,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
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
    const snapshot: MatchSnapshot = await this.demoteAdminUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: userId,
      expectedRevision: body.expectedRevision,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/audit-logs')
  async getAuditLogs(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Query() query: AuditLogsQueryDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.getMatchAuditLogsQuery.execute({
      matchId,
      actorId: actor.userId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/invite-candidates')
  async getInviteCandidates(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Query() query: InviteCandidatesQueryDto,
    @Actor() actor: ActorPayload,
  ) {
    return this.getInviteCandidatesQuery.execute({
      matchId,
      groupId: query.groupId,
      actorId: actor.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/kick')
  async kick(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: KickParticipantDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot = await this.kickParticipantUseCase.execute({
      matchId,
      actorId: actor.userId,
      targetUserId: body.userId,
      expectedRevision: body.expectedRevision,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/teams')
  async saveTeams(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: SaveTeamsDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot = await this.saveTeamsUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      teamA: body.teamA,
      teamB: body.teamB,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/teams/generate-random')
  async generateRandomTeams(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: GenerateTeamsDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot =
      await this.generateRandomTeamsUseCase.execute({
        matchId,
        actorId: actor.userId,
        expectedRevision: body.expectedRevision,
      });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/teams/generate-balanced')
  async generateBalancedTeams(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: GenerateTeamsDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot =
      await this.generateBalancedTeamsUseCase.execute({
        matchId,
        actorId: actor.userId,
        expectedRevision: body.expectedRevision,
      });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/teams/move-player')
  async moveTeamPlayer(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Body() body: MoveTeamPlayerDto,
    @Actor() actor: ActorPayload,
  ) {
    const snapshot: MatchSnapshot = await this.moveTeamPlayerUseCase.execute({
      matchId,
      actorId: actor.userId,
      expectedRevision: body.expectedRevision,
      fromTeam: body.fromTeam,
      fromSlotIndex: body.fromSlotIndex,
      toTeam: body.toTeam,
      toSlotIndex: body.toSlotIndex,
    });
    this.realtimePublisher.notifyMatchUpdated(snapshot.id, snapshot.revision);
    return snapshot;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ mutations: {} })
  @Post(':id/teams/block-autogen')
  async blockTeamAutoGen(
    @Param('id', new ParseUUIDPipe()) matchId: string,
    @Actor() actor: ActorPayload,
  ): Promise<{ ok: boolean }> {
    await this.blockTeamAutoGenUseCase.execute(matchId, actor.userId);
    return { ok: true };
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
