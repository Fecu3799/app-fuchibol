import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';
import { MatchNotificationService } from '../notifications/match-notification.service';
import { UserReliabilityService } from '../shared/user-reliability.service';
import { releaseTeamSlot, autoAssignTeamSlot } from '../teams/team-slot-sync';
import { MetricsService } from '../../../metrics/metrics.service';

const LATE_LEAVE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export interface LeaveMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

interface RunResult {
  snapshot: MatchSnapshot;
  promotedUserId: string | null;
  wasConfirmed: boolean;
  isLocked: boolean;
  minutesToStart: number;
  confirmedCount: number;
}

@Injectable()
export class LeaveMatchUseCase {
  private readonly logger = new Logger(LeaveMatchUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
    private readonly userReliability: UserReliabilityService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(input: LeaveMatchInput): Promise<MatchSnapshot> {
    const result = await this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/leave',
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

    if (result.wasConfirmed && result.isLocked && result.minutesToStart <= 60) {
      void this.matchNotification
        .onMissingPlayersAlertWithLookup({
          matchId: input.matchId,
          matchTitle: result.snapshot.title,
          creatorId: result.snapshot.createdById,
          confirmedCount: result.confirmedCount,
          capacity: result.snapshot.capacity,
          minutesToStart: result.minutesToStart,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `[MatchNotification] onMissingPlayersAlert failed: ${(err as Error)?.message}`,
            { matchId: input.matchId },
          ),
        );
    }

    return result.snapshot;
  }

  private async run(input: LeaveMatchInput): Promise<RunResult> {
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

      const isCreator = match.createdById === input.actorId;
      const minutesToStart = (match.startsAt.getTime() - Date.now()) / 60_000;

      // Creator transfer must happen even if creator has no participation row
      if (isCreator) {
        // Transfer creator to first matchAdmin by adminGrantedAt
        // Exclude SPECTATOR from candidates
        const candidate = await tx.matchParticipant.findFirst({
          where: {
            matchId: input.matchId,
            isMatchAdmin: true,
            userId: { not: input.actorId },
            status: { notIn: ['SPECTATOR'] },
          },
          orderBy: { adminGrantedAt: 'asc' },
        });

        if (!candidate) {
          throw new UnprocessableEntityException('CREATOR_TRANSFER_REQUIRED');
        }

        await tx.match.update({
          where: { id: input.matchId },
          data: { createdById: candidate.userId },
        });

        // Ensure new creator is CONFIRMED
        if (candidate.status !== 'CONFIRMED') {
          await tx.matchParticipant.update({
            where: { id: candidate.id },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
          });
        }
      }

      // Idempotent: already gone (or creator had no participation row)
      if (!existing) {
        // Still increment revision if a creator transfer happened
        if (isCreator) {
          await tx.match.update({
            where: { id: input.matchId },
            data: { revision: match.revision + 1 },
          });
        }
        return {
          snapshot: await this.snapshot.buildInTx(
            tx,
            input.matchId,
            input.actorId,
          ),
          promotedUserId: null,
          wasConfirmed: false,
          isLocked: match.isLocked,
          minutesToStart,
          confirmedCount: 0,
        };
      }

      const wasConfirmed = existing.status === 'CONFIRMED';

      const confirmedCountBefore = await tx.matchParticipant.count({
        where: { matchId: input.matchId, status: 'CONFIRMED' },
      });
      const waitlistCountBefore = await tx.matchParticipant.count({
        where: { matchId: input.matchId, status: 'WAITLISTED' },
      });

      // Late-leave penalty: if leaving within 1 hour of match start
      const timeUntilMatchMs = match.startsAt.getTime() - Date.now();
      const isLateleave =
        timeUntilMatchMs > 0 && timeUntilMatchMs <= LATE_LEAVE_THRESHOLD_MS;
      if (isLateleave) {
        const minutesToStart = timeUntilMatchMs / 60_000;
        await tx.user.update({
          where: { id: input.actorId },
          data: { lateLeaveCount: { increment: 1 } },
        });
        await this.userReliability.applyLateLeavePenalty(
          tx,
          input.actorId,
          minutesToStart,
        );
      }

      // Hard delete the participation row
      await tx.matchParticipant.delete({
        where: { id: existing.id },
      });

      if (wasConfirmed && match.teamsConfigured) {
        await releaseTeamSlot(
          tx,
          input.matchId,
          input.actorId,
          input.actorId,
          this.audit,
        );
      }

      // Promote from waitlist if the leaving user was confirmed
      let promotedUserId: string | null = null;
      if (wasConfirmed) {
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
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.PARTICIPANT_LEFT,
        { wasConfirmed },
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

      // Count confirmed after deletion (promotion may have changed the count)
      const confirmedCountAfter = await tx.matchParticipant.count({
        where: { matchId: input.matchId, status: 'CONFIRMED' },
      });
      const waitlistCountAfter = await tx.matchParticipant.count({
        where: { matchId: input.matchId, status: 'WAITLISTED' },
      });

      this.logger.log({
        op: 'leaveMatch',
        matchId: input.matchId,
        actorUserId: input.actorId,
        wasConfirmed,
        isLateLeave: isLateleave,
        promotedUserId,
        confirmedCountBefore,
        confirmedCountAfter,
        waitlistCountBefore,
        waitlistCountAfter,
      });
      this.metrics?.incCounter('match_leave_total');
      if (promotedUserId) {
        this.metrics?.incCounter('match_waitlist_promotions_total');
      }

      return {
        snapshot: await this.snapshot.buildInTx(
          tx,
          input.matchId,
          input.actorId,
        ),
        promotedUserId,
        wasConfirmed,
        isLocked: match.isLocked,
        minutesToStart,
        confirmedCount: confirmedCountAfter,
      };
    });
  }
}
