import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { isCreatorOrMatchAdmin } from '../shared/match-permissions';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';

export interface LockMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
}

@Injectable()
export class LockMatchUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: LockMatchInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (
        !(await isCreatorOrMatchAdmin(match, tx, input.matchId, input.actorId))
      ) {
        throw new ForbiddenException('Only match admin can lock');
      }

      if (['canceled', 'in_progress', 'played'].includes(match.status)) {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      // Idempotent: already locked -> return snapshot without changing anything
      if (match.isLocked) {
        return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: input.actorId,
          revision: match.revision + 1,
        },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.MATCH_LOCKED,
        {},
      );

      return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
    });
  }
}
