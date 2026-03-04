import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { lockMatchRow } from './lock-match-row';
import { MatchAuditService, AuditLogType } from './match-audit.service';
import { MatchNotificationService } from './match-notification.service';
import { MatchRealtimePublisher } from '../realtime/match-realtime.publisher';

type MatchWithParticipants = {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  status: string;
  revision: number;
  isLocked: boolean;
  createdById: string;
  participants: Array<{
    userId: string;
    status: string;
    isMatchAdmin: boolean;
  }>;
};

@Injectable()
export class MatchLifecycleJob {
  private readonly logger = new Logger(MatchLifecycleJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
    private readonly realtimePublisher: MatchRealtimePublisher,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runTick(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000); // now - 5min
    const windowEnd = new Date(now.getTime() + 60 * 60 * 1000); // now + 60min

    const matches = await this.prisma.client.match.findMany({
      where: {
        startsAt: { gte: windowStart, lte: windowEnd },
        status: { notIn: ['canceled', 'played'] },
      },
      include: {
        participants: {
          select: { userId: true, status: true, isMatchAdmin: true },
        },
      },
    });

    await Promise.allSettled(
      matches.map((match) => this.processMatch(match as MatchWithParticipants)),
    );
  }

  private async processMatch(match: MatchWithParticipants): Promise<void> {
    const now = Date.now();
    const minutesToStart = (match.startsAt.getTime() - now) / 60_000;
    const confirmedCount = match.participants.filter(
      (p) => p.status === 'CONFIRMED',
    ).length;

    const isFull = confirmedCount >= match.capacity;
    const isBeforeStart = minutesToStart > 0;

    // Rule 1: Auto-lock — match is full and not yet locked
    if (isBeforeStart && minutesToStart <= 60 && isFull && !match.isLocked) {
      await this.autoLock(match);
    }

    // Rule 2: Reminder — not full, within 60min, before start (even if just auto-locked)
    if (isBeforeStart && minutesToStart <= 60 && !isFull) {
      await this.sendReminder(match, confirmedCount, minutesToStart);
    }

    // Rule 3: Auto-cancel — past start time, not full
    if (!isBeforeStart && !isFull) {
      await this.autoCancel(match);
    }
  }

  private async autoLock(match: MatchWithParticipants): Promise<void> {
    try {
      const newRevision = await this.prisma.client.$transaction(async (tx) => {
        await lockMatchRow(tx, match.id);

        // Re-read inside tx to prevent double-lock
        const fresh = await tx.match.findUnique({ where: { id: match.id } });
        if (!fresh || fresh.isLocked || fresh.status === 'canceled') return null;

        const confirmedCount = await tx.matchParticipant.count({
          where: { matchId: match.id, status: 'CONFIRMED' },
        });
        if (confirmedCount < match.capacity) return null;

        const updated = await tx.match.update({
          where: { id: match.id },
          data: {
            isLocked: true,
            lockedAt: new Date(),
            lockedBy: null,
            revision: fresh.revision + 1,
          },
        });

        await this.audit.log(
          tx,
          match.id,
          null,
          AuditLogType.MATCH_AUTO_LOCKED,
          { confirmedCount },
        );

        return updated.revision;
      });

      if (newRevision !== null) {
        this.realtimePublisher.notifyMatchUpdated(match.id, newRevision);
        this.logger.log(`[MatchLifecycle] Auto-locked match ${match.id}`);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[MatchLifecycle] Auto-lock failed for match ${match.id}: ${(err as Error)?.message}`,
      );
    }
  }

  private async sendReminder(
    match: MatchWithParticipants,
    confirmedCount: number,
    minutesToStart: number,
  ): Promise<void> {
    try {
      const missingCount = match.capacity - confirmedCount;
      // bucket: 0-14 min = b0, 15-29 = b1, 30-44 = b2, 45-60 = b3
      const bucket = `b${Math.floor(minutesToStart / 15)}`;

      const adminUserIds = match.participants
        .filter((p) => p.isMatchAdmin)
        .map((p) => p.userId);
      const recipientIds = [
        ...new Set([match.createdById, ...adminUserIds]),
      ];

      await this.matchNotification.onReminderMissingPlayers({
        matchId: match.id,
        matchTitle: match.title,
        userIds: recipientIds,
        missingCount,
        minutesToStart,
        bucket,
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[MatchLifecycle] Reminder failed for match ${match.id}: ${(err as Error)?.message}`,
      );
    }
  }

  private async autoCancel(match: MatchWithParticipants): Promise<void> {
    try {
      let newRevision: number | null = null;
      let participantUserIds: string[] = [];

      await this.prisma.client.$transaction(async (tx) => {
        await lockMatchRow(tx, match.id);

        const fresh = await tx.match.findUnique({ where: { id: match.id } });
        if (!fresh || fresh.status === 'canceled' || fresh.status === 'played')
          return;

        const confirmedCount = await tx.matchParticipant.count({
          where: { matchId: match.id, status: 'CONFIRMED' },
        });
        if (confirmedCount >= match.capacity) return;

        const updated = await tx.match.update({
          where: { id: match.id },
          data: { status: 'canceled', revision: fresh.revision + 1 },
        });

        await this.audit.log(
          tx,
          match.id,
          null,
          AuditLogType.MATCH_AUTO_CANCELED,
          { confirmedCount },
        );

        const rows = await tx.matchParticipant.findMany({
          where: {
            matchId: match.id,
            status: { in: ['CONFIRMED', 'WAITLISTED', 'INVITED', 'SPECTATOR'] },
          },
          select: { userId: true },
        });

        newRevision = updated.revision;
        participantUserIds = rows.map((r) => r.userId);
      });

      if (newRevision !== null) {
        this.realtimePublisher.notifyMatchUpdated(match.id, newRevision);
        this.logger.log(`[MatchLifecycle] Auto-canceled match ${match.id}`);

        void this.matchNotification
          .onCanceled({
            matchId: match.id,
            matchTitle: match.title,
            userIds: participantUserIds,
            actorId: null,
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `[MatchLifecycle] onCanceled notification failed for match ${match.id}: ${(err as Error)?.message}`,
            ),
          );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `[MatchLifecycle] Auto-cancel failed for match ${match.id}: ${(err as Error)?.message}`,
      );
    }
  }
}
