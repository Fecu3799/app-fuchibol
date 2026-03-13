import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';
import { autoAssignTeamSlot } from '../teams/team-slot-sync';

export interface ConfirmInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class ConfirmParticipationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: ConfirmInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/confirm',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
      },
      execute: () => this.run(input),
    });
  }

  private async run(input: ConfirmInput): Promise<MatchSnapshot> {
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

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      const existing = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: { matchId: input.matchId, userId: input.actorId },
        },
      });

      // Idempotent: already in a terminal participation state → return snapshot
      // (bypass lock check — no state change needed)
      if (existing?.status === 'CONFIRMED') {
        return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
      }

      if (existing?.status === 'WAITLISTED') {
        return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
      }

      // Spectators must use the toggle-spectator endpoint to re-enter as a participant.
      // Allowing a direct confirm would skip the SPECTATOR→INVITED transition and
      // bypass team-slot release/reassignment logic.
      if (existing?.status === 'SPECTATOR') {
        throw new ConflictException('SPECTATOR_MUST_TOGGLE');
      }

      // Locked: only INVITED participants may confirm their invitation.
      // New sign-ups (null) are blocked until unlock.
      if (match.isLocked && existing?.status !== 'INVITED') {
        throw new ConflictException('MATCH_LOCKED');
      }

      const confirmedCount = await tx.matchParticipant.count({
        where: { matchId: input.matchId, status: 'CONFIRMED' },
      });

      const hasCapacity = confirmedCount < match.capacity;
      const newStatus = hasCapacity ? 'CONFIRMED' : 'WAITLISTED';

      let waitlistPosition: number | null = null;
      if (newStatus === 'WAITLISTED') {
        const maxPos = await tx.matchParticipant.aggregate({
          where: { matchId: input.matchId, status: 'WAITLISTED' },
          _max: { waitlistPosition: true },
        });
        waitlistPosition = (maxPos._max.waitlistPosition ?? 0) + 1;
      }

      if (existing) {
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: {
            status: newStatus,
            waitlistPosition,
            confirmedAt: newStatus === 'CONFIRMED' ? new Date() : null,
          },
        });
      } else {
        await tx.matchParticipant.create({
          data: {
            matchId: input.matchId,
            userId: input.actorId,
            status: newStatus,
            waitlistPosition,
            confirmedAt: newStatus === 'CONFIRMED' ? new Date() : null,
          },
        });
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.PARTICIPANT_CONFIRMED,
        {
          newStatus,
        },
      );

      if (newStatus === 'CONFIRMED' && match.teamsConfigured) {
        await autoAssignTeamSlot(
          tx,
          input.matchId,
          input.actorId,
          input.actorId,
          this.audit,
        );
      }

      return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
    });
  }
}
