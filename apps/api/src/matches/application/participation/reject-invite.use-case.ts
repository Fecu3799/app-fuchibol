import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';

export interface RejectInviteInput {
  matchId: string;
  actorId: string;
  idempotencyKey: string;
}

@Injectable()
export class RejectInviteUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: RejectInviteInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/reject',
      matchId: input.matchId,
      requestBody: { matchId: input.matchId },
      execute: () => this.run(input),
    });
  }

  private async run(input: RejectInviteInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (['canceled', 'in_progress', 'played'].includes(match.status)) {
        throw new ConflictException('MATCH_CANCELLED');
      }

      const existing = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: { matchId: input.matchId, userId: input.actorId },
        },
      });

      if (!existing || existing.status !== 'INVITED') {
        throw new UnprocessableEntityException('NOT_INVITED');
      }

      await tx.matchParticipant.delete({
        where: { id: existing.id },
      });

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.INVITE_REJECTED,
        {},
      );

      return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
    });
  }
}
