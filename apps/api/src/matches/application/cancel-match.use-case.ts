import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';
import { MatchAuditService, AuditLogType } from './match-audit.service';
import { MatchNotificationService } from './match-notification.service';

export interface CancelMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class CancelMatchUseCase {
  private readonly logger = new Logger(CancelMatchUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
  ) {}

  async execute(input: CancelMatchInput): Promise<MatchSnapshot> {
    const snapshot = await this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/cancel',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
      },
      execute: () => this.run(input),
    });

    void this.notifyCanceled(
      input.matchId,
      snapshot.title,
      input.actorId,
    ).catch((err: unknown) =>
      this.logger.warn(
        `[MatchNotification] onCanceled failed: ${(err as Error)?.message}`,
        { matchId: input.matchId },
      ),
    );

    return snapshot;
  }

  private async notifyCanceled(
    matchId: string,
    matchTitle: string,
    actorId: string,
  ): Promise<void> {
    const participants = await this.prisma.client.matchParticipant.findMany({
      where: {
        matchId,
        status: { in: ['CONFIRMED', 'WAITLISTED', 'INVITED', 'SPECTATOR'] },
      },
      select: { userId: true },
    });

    await this.matchNotification.onCanceled({
      matchId,
      matchTitle,
      userIds: participants.map((p) => p.userId),
      actorId,
    });
  }

  private async run(input: CancelMatchInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can cancel');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      // Idempotent: already canceled -> return snapshot
      if (match.status === 'canceled') {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      // Cannot cancel a match that has already started
      if (match.status === 'in_progress' || match.status === 'played') {
        throw new ConflictException('MATCH_CANCELLED');
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: {
          status: 'canceled',
          revision: match.revision + 1,
        },
      });

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.MATCH_CANCELED,
        {},
      );

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
