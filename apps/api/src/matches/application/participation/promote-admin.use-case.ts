import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';

export interface PromoteAdminInput {
  matchId: string;
  actorId: string;
  targetUserId: string;
  expectedRevision: number;
}

@Injectable()
export class PromoteAdminUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: PromoteAdminInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only creator can manage admins');
      }

      if (['canceled', 'in_progress', 'played'].includes(match.status)) {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      const participant = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: {
            matchId: input.matchId,
            userId: input.targetUserId,
          },
        },
      });

      if (!participant || participant.status === 'SPECTATOR') {
        throw new UnprocessableEntityException('NOT_PARTICIPANT');
      }

      // Idempotent: already admin → return snapshot
      if (participant.isMatchAdmin) {
        return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
      }

      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: {
          isMatchAdmin: true,
          adminGrantedAt: new Date(),
        },
      });

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.ADMIN_PROMOTED,
        { targetUserId: input.targetUserId },
      );

      return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
    });
  }
}
