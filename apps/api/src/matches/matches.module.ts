import { Module } from '@nestjs/common';
import { PrismaModule } from '../infra/prisma/prisma.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { MatchesController } from './api/matches.controller';
import { CreateMatchUseCase } from './application/create-match.use-case';
import { GetMatchUseCase } from './application/get-match.use-case';
import { UpdateMatchUseCase } from './application/update-match.use-case';
import { LockMatchUseCase } from './application/lock-match.use-case';
import { UnlockMatchUseCase } from './application/unlock-match.use-case';
import { ConfirmParticipationUseCase } from './application/confirm-participation.use-case';
import { DeclineParticipationUseCase } from './application/decline-participation.use-case';
import { WithdrawParticipationUseCase } from './application/withdraw-participation.use-case';
import { InviteParticipationUseCase } from './application/invite-participation.use-case';

@Module({
  imports: [PrismaModule, IdempotencyModule],
  controllers: [MatchesController],
  providers: [
    CreateMatchUseCase,
    GetMatchUseCase,
    UpdateMatchUseCase,
    LockMatchUseCase,
    UnlockMatchUseCase,
    ConfirmParticipationUseCase,
    DeclineParticipationUseCase,
    WithdrawParticipationUseCase,
    InviteParticipationUseCase,
  ],
})
export class MatchesModule {}
