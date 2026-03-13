import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { MatchRealtimeModule } from './realtime/match-realtime.module';
import { PushModule } from '../push/push.module';
import { StorageModule } from '../infra/storage/storage.module';
import { MatchesController } from './api/matches.controller';
import { CreateMatchUseCase } from './application/editing/create-match.use-case';
import { GetMatchUseCase } from './application/queries/get-match.use-case';
import { ListMatchesQuery } from './application/queries/list-matches.query';
import { UpdateMatchUseCase } from './application/editing/update-match.use-case';
import { LockMatchUseCase } from './application/lifecycle/lock-match.use-case';
import { UnlockMatchUseCase } from './application/lifecycle/unlock-match.use-case';
import { CancelMatchUseCase } from './application/lifecycle/cancel-match.use-case';
import { ConfirmParticipationUseCase } from './application/participation/confirm-participation.use-case';
import { RejectInviteUseCase } from './application/participation/reject-invite.use-case';
import { ToggleSpectatorUseCase } from './application/participation/toggle-spectator.use-case';
import { InviteParticipationUseCase } from './application/participation/invite-participation.use-case';
import { LeaveMatchUseCase } from './application/participation/leave-match.use-case';
import { PromoteAdminUseCase } from './application/participation/promote-admin.use-case';
import { DemoteAdminUseCase } from './application/participation/demote-admin.use-case';
import { MatchAuditService } from './application/audit/match-audit.service';
import { GetMatchAuditLogsQuery } from './application/queries/get-match-audit-logs.query';
import { MatchNotificationService } from './application/notifications/match-notification.service';
import { GetInviteCandidatesQuery } from './application/queries/get-invite-candidates.query';
import { KickParticipantUseCase } from './application/participation/kick-participant.use-case';
import { SaveTeamsUseCase } from './application/teams/save-teams.use-case';
import { GenerateRandomTeamsUseCase } from './application/teams/generate-random-teams.use-case';
import { GenerateBalancedTeamsUseCase } from './application/teams/generate-balanced-teams.use-case';
import { MoveTeamPlayerUseCase } from './application/teams/move-team-player.use-case';
import { BlockTeamAutoGenUseCase } from './application/teams/block-team-autogen.use-case';
import { MatchLifecycleJob } from './application/lifecycle/match-lifecycle.job';
import { UserReliabilityService } from './application/shared/user-reliability.service';
import { MatchSnapshotService } from './application/shared/match-snapshot.service';

@Module({
  imports: [
    PrismaModule,
    IdempotencyModule,
    MatchRealtimeModule,
    PushModule,
    StorageModule,
  ],
  controllers: [MatchesController],
  providers: [
    MatchSnapshotService,
    CreateMatchUseCase,
    GetMatchUseCase,
    ListMatchesQuery,
    UpdateMatchUseCase,
    LockMatchUseCase,
    UnlockMatchUseCase,
    CancelMatchUseCase,
    ConfirmParticipationUseCase,
    RejectInviteUseCase,
    ToggleSpectatorUseCase,
    InviteParticipationUseCase,
    LeaveMatchUseCase,
    PromoteAdminUseCase,
    DemoteAdminUseCase,
    MatchAuditService,
    GetMatchAuditLogsQuery,
    MatchNotificationService,
    GetInviteCandidatesQuery,
    KickParticipantUseCase,
    SaveTeamsUseCase,
    GenerateRandomTeamsUseCase,
    GenerateBalancedTeamsUseCase,
    MoveTeamPlayerUseCase,
    BlockTeamAutoGenUseCase,
    MatchLifecycleJob,
    UserReliabilityService,
  ],
})
export class MatchesModule {}
