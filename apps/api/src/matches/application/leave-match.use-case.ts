import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';
import { MatchAuditService, AuditLogType } from './match-audit.service';
import { MatchNotificationService } from './match-notification.service';

const LATE_LEAVE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export interface LeaveMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class LeaveMatchUseCase {
  private readonly logger = new Logger(LeaveMatchUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
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

    return result.snapshot;
  }

  private async run(
    input: LeaveMatchInput,
  ): Promise<{ snapshot: MatchSnapshot; promotedUserId: string | null }> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.status === 'canceled') {
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

      // Creator transfer must happen even if creator has no participation row
      if (isCreator) {
        // Transfer creator to first matchAdmin by adminGrantedAt
        // Exclude DECLINED and SPECTATOR from candidates
        const candidate = await tx.matchParticipant.findFirst({
          where: {
            matchId: input.matchId,
            isMatchAdmin: true,
            userId: { not: input.actorId },
            status: { notIn: ['DECLINED', 'SPECTATOR'] },
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
          snapshot: await buildMatchSnapshot(tx, input.matchId, input.actorId),
          promotedUserId: null,
        };
      }

      const wasConfirmed = existing.status === 'CONFIRMED';

      // Late-leave penalty: if leaving within 1 hour of match start
      const timeUntilMatchMs = match.startsAt.getTime() - Date.now();
      if (timeUntilMatchMs > 0 && timeUntilMatchMs <= LATE_LEAVE_THRESHOLD_MS) {
        await tx.user.update({
          where: { id: input.actorId },
          data: { lateLeaveCount: { increment: 1 } },
        });
      }

      // Hard delete the participation row
      await tx.matchParticipant.delete({
        where: { id: existing.id },
      });

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

      return {
        snapshot: await buildMatchSnapshot(tx, input.matchId, input.actorId),
        promotedUserId,
      };
    });
  }
}
