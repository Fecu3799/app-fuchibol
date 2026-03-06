import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { MatchRealtimeModule } from './realtime/match-realtime.module';
import { PushModule } from '../push/push.module';
import { MatchesController } from './api/matches.controller';
import { CreateMatchUseCase } from './application/create-match.use-case';
import { GetMatchUseCase } from './application/get-match.use-case';
import { ListMatchesQuery } from './application/list-matches.query';
import { UpdateMatchUseCase } from './application/update-match.use-case';
import { LockMatchUseCase } from './application/lock-match.use-case';
import { UnlockMatchUseCase } from './application/unlock-match.use-case';
import { CancelMatchUseCase } from './application/cancel-match.use-case';
import { ConfirmParticipationUseCase } from './application/confirm-participation.use-case';
import { RejectInviteUseCase } from './application/reject-invite.use-case';
import { ToggleSpectatorUseCase } from './application/toggle-spectator.use-case';
import { InviteParticipationUseCase } from './application/invite-participation.use-case';
import { LeaveMatchUseCase } from './application/leave-match.use-case';
import { PromoteAdminUseCase } from './application/promote-admin.use-case';
import { DemoteAdminUseCase } from './application/demote-admin.use-case';
import { MatchAuditService } from './application/match-audit.service';
import { GetMatchAuditLogsQuery } from './application/get-match-audit-logs.query';
import { MatchNotificationService } from './application/match-notification.service';
import { GetInviteCandidatesQuery } from './application/get-invite-candidates.query';
import { KickParticipantUseCase } from './application/kick-participant.use-case';
import { MatchLifecycleJob } from './application/match-lifecycle.job';
import { UserReliabilityService } from './application/user-reliability.service';

@Module({
  imports: [PrismaModule, IdempotencyModule, MatchRealtimeModule, PushModule],
  controllers: [MatchesController],
  providers: [
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
    MatchLifecycleJob,
    UserReliabilityService,
  ],
})
export class MatchesModule {}
