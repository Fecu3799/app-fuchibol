import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';
import { MatchNotificationService } from '../notifications/match-notification.service';
import { releaseTeamSlot, autoAssignTeamSlot } from '../teams/team-slot-sync';

export interface ToggleSpectatorInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class ToggleSpectatorUseCase {
  private readonly logger = new Logger(ToggleSpectatorUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
  ) {}

  async execute(input: ToggleSpectatorInput): Promise<MatchSnapshot> {
    const result = await this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/spectator',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
      },
      execute: () => this.run(input),
    });

    if (result.promotedUserId) {
      void this.matchNotification
        .onPromoted({
          matchId: input.matchId,
          matchTitle: result.snapshot.title,
          promotedUserId: result.promotedUserId,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `[MatchNotification] onPromoted failed: ${(err as Error)?.message}`,
            { matchId: input.matchId },
          ),
        );
    }

    return result.snapshot;
  }

  private async run(
    input: ToggleSpectatorInput,
  ): Promise<{ snapshot: MatchSnapshot; promotedUserId: string | null }> {
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

      let auditType: string;
      let auditMeta: Record<string, unknown> = {};
      let promotedUserId: string | null = null;

      if (!existing) {
        // No participation → create as SPECTATOR
        await tx.matchParticipant.create({
          data: {
            matchId: input.matchId,
            userId: input.actorId,
            status: 'SPECTATOR',
          },
        });
        auditType = AuditLogType.PARTICIPANT_SPECTATOR_ON;
        auditMeta = { fromStatus: 'none' };
      } else if (existing.status === 'SPECTATOR') {
        // SPECTATOR → INVITED (toggle back to participant)
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: { status: 'INVITED' },
        });
        auditType = AuditLogType.PARTICIPANT_SPECTATOR_OFF;
      } else if (existing.status === 'CONFIRMED') {
        // CONFIRMED → SPECTATOR: promote first waitlisted
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'SPECTATOR',
            waitlistPosition: null,
            confirmedAt: null,
          },
        });

        if (match.teamsConfigured) {
          await releaseTeamSlot(
            tx,
            input.matchId,
            input.actorId,
            input.actorId,
            this.audit,
          );
        }

        const nextInWaitlist = await tx.matchParticipant.findFirst({
          where: { matchId: input.matchId, status: 'WAITLISTED' },
          orderBy: { waitlistPosition: 'asc' },
        });

        if (nextInWaitlist) {
          await tx.matchParticipant.update({
            where: { id: nextInWaitlist.id },
            data: {
              status: 'CONFIRMED',
              waitlistPosition: null,
              confirmedAt: new Date(),
            },
          });
          promotedUserId = nextInWaitlist.userId;

          if (match.teamsConfigured) {
            await autoAssignTeamSlot(
              tx,
              input.matchId,
              nextInWaitlist.userId,
              input.actorId,
              this.audit,
            );
          }
        }
        auditType = AuditLogType.PARTICIPANT_SPECTATOR_ON;
        auditMeta = { fromStatus: 'CONFIRMED' };
      } else {
        // INVITED / WAITLISTED → SPECTATOR
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'SPECTATOR',
            waitlistPosition: null,
            confirmedAt: null,
          },
        });
        auditType = AuditLogType.PARTICIPANT_SPECTATOR_ON;
        auditMeta = { fromStatus: existing.status };
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        auditType,
        auditMeta,
      );
      if (promotedUserId) {
        await this.audit.log(
          tx,
          input.matchId,
          input.actorId,
          AuditLogType.WAITLIST_PROMOTED,
          { promotedUserId },
        );
      }

      return {
        snapshot: await this.snapshot.buildInTx(
          tx,
          input.matchId,
          input.actorId,
        ),
        promotedUserId,
      };
    });
  }
}
