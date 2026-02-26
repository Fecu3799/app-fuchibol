import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';
import { MatchAuditService, AuditLogType } from './match-audit.service';
import { MatchNotificationService } from './match-notification.service';

export interface UpdateMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  title?: string;
  startsAt?: string;
  location?: string;
  capacity?: number;
}

@Injectable()
export class UpdateMatchUseCase {
  private readonly logger = new Logger(UpdateMatchUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
  ) {}

  async execute(input: UpdateMatchInput): Promise<MatchSnapshot> {
    let reconfirmUserIds: string[] = [];

    const snapshot = await this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can update');
      }

      if (match.status === 'canceled') {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      if (match.isLocked) {
        throw new ConflictException('MATCH_LOCKED');
      }

      // Build data to update (only fields that actually changed)
      const data: Record<string, unknown> = {};
      if (input.title !== undefined && input.title !== match.title)
        data.title = input.title;
      if (input.startsAt !== undefined) {
        const newStartsAt = new Date(input.startsAt);
        if (newStartsAt.getTime() !== match.startsAt.getTime())
          data.startsAt = newStartsAt;
      }
      if (input.location !== undefined && input.location !== match.location)
        data.location = input.location;
      if (input.capacity !== undefined && input.capacity !== match.capacity)
        data.capacity = input.capacity;

      // Nothing actually changed
      if (Object.keys(data).length === 0) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      const capacityDecreased =
        data.capacity !== undefined &&
        (data.capacity as number) < match.capacity;

      // Detect major change (startsAt, location, or capacity reduction).
      const isMajorChange =
        data.startsAt !== undefined ||
        data.location !== undefined ||
        capacityDecreased;

      // Apply update + increment revision
      data.revision = match.revision + 1;
      await tx.match.update({
        where: { id: input.matchId },
        data,
      });

      if (isMajorChange) {
        // Capture confirmed user IDs before resetting them (for post-commit notifications)
        const confirmedRows = await tx.matchParticipant.findMany({
          where: {
            matchId: input.matchId,
            status: 'CONFIRMED',
            userId: { not: match.createdById },
          },
          select: { userId: true },
        });
        reconfirmUserIds = confirmedRows.map((r) => r.userId);

        // CONFIRMED -> INVITED (reconfirmation), except creator stays CONFIRMED
        const reconfirmResult = await tx.matchParticipant.updateMany({
          where: {
            matchId: input.matchId,
            status: 'CONFIRMED',
            userId: { not: match.createdById },
          },
          data: {
            status: 'INVITED',
            confirmedAt: null,
          },
        });

        await this.audit.log(
          tx,
          input.matchId,
          input.actorId,
          AuditLogType.MATCH_UPDATED_MAJOR,
          {
            fieldsChanged: Object.keys(data).filter((k) => k !== 'revision'),
            reconfirmationCount: reconfirmResult.count,
          },
        );
      }

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });

    if (reconfirmUserIds.length > 0) {
      void this.matchNotification
        .onReconfirmRequired({
          matchId: input.matchId,
          matchTitle: snapshot.title,
          userIds: reconfirmUserIds,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `[MatchNotification] onReconfirmRequired failed: ${(err as Error)?.message}`,
            { matchId: input.matchId },
          ),
        );
    }

    return snapshot;
  }
}
