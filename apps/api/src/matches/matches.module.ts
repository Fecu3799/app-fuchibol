import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { MatchesController } from './api/matches.controller';
import { CreateMatchUseCase } from './application/create-match.use-case';
import { GetMatchUseCase } from './application/get-match.use-case';
import { ListMatchesQuery } from './application/list-matches.query';
import { UpdateMatchUseCase } from './application/update-match.use-case';
import { LockMatchUseCase } from './application/lock-match.use-case';
import { UnlockMatchUseCase } from './application/unlock-match.use-case';
import { CancelMatchUseCase } from './application/cancel-match.use-case';
import { ConfirmParticipationUseCase } from './application/confirm-participation.use-case';
import { DeclineParticipationUseCase } from './application/decline-participation.use-case';
import { WithdrawParticipationUseCase } from './application/withdraw-participation.use-case';
import { InviteParticipationUseCase } from './application/invite-participation.use-case';
import { PromoteAdminUseCase } from './application/promote-admin.use-case';
import { DemoteAdminUseCase } from './application/demote-admin.use-case';

@Module({
  imports: [PrismaModule, IdempotencyModule],
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
    DeclineParticipationUseCase,
    WithdrawParticipationUseCase,
    InviteParticipationUseCase,
    PromoteAdminUseCase,
    DemoteAdminUseCase,
  ],
})
export class MatchesModule {}
