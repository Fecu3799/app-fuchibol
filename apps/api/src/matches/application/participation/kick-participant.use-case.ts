import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';
import { MatchNotificationService } from '../notifications/match-notification.service';
import { releaseTeamSlot, autoAssignTeamSlot } from '../teams/team-slot-sync';

export interface KickParticipantInput {
  matchId: string;
  actorId: string;
  targetUserId: string;
  expectedRevision: number;
}

@Injectable()
export class KickParticipantUseCase {
  private readonly logger = new Logger(KickParticipantUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
  ) {}

  async execute(input: KickParticipantInput): Promise<MatchSnapshot> {
    let alertContext: {
      isLocked: boolean;
      minutesToStart: number;
      confirmedCount: number;
      matchTitle: string;
    } | null = null;

    const snapshot = await this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) throw new NotFoundException('Match not found');

      if (['canceled', 'in_progress', 'played'].includes(match.status)) {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('ONLY_CREATOR_CAN_KICK');
      }

      if (input.targetUserId === input.actorId) {
        throw new UnprocessableEntityException('CANNOT_KICK_SELF');
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

      if (!participant) throw new NotFoundException('NOT_A_PARTICIPANT');

      const wasConfirmed = participant.status === 'CONFIRMED';

      await tx.matchParticipant.delete({
        where: { id: participant.id },
      });

      if (wasConfirmed && match.teamsConfigured) {
        await releaseTeamSlot(
          tx,
          input.matchId,
          input.targetUserId,
          input.actorId,
          this.audit,
        );
      }

      // Promote FIFO from waitlist if a confirmed participant was kicked
      if (wasConfirmed) {
        const next = await tx.matchParticipant.findFirst({
          where: { matchId: input.matchId, status: 'WAITLISTED' },
          orderBy: { waitlistPosition: 'asc' },
        });
        if (next) {
          await tx.matchParticipant.update({
            where: { id: next.id },
            data: {
              status: 'CONFIRMED',
              waitlistPosition: null,
              confirmedAt: new Date(),
            },
          });
          await this.audit.log(
            tx,
            input.matchId,
            input.actorId,
            AuditLogType.WAITLIST_PROMOTED,
            { promotedUserId: next.userId },
          );

          if (match.teamsConfigured) {
            await autoAssignTeamSlot(
              tx,
              input.matchId,
              next.userId,
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
        AuditLogType.PARTICIPANT_KICKED,
        { targetUserId: input.targetUserId, wasConfirmed },
      );

      const minutesToStart = (match.startsAt.getTime() - Date.now()) / 60_000;

      if (wasConfirmed && match.isLocked && minutesToStart <= 60) {
        const confirmedCount = await tx.matchParticipant.count({
          where: { matchId: input.matchId, status: 'CONFIRMED' },
        });
        alertContext = {
          isLocked: match.isLocked,
          minutesToStart,
          confirmedCount,
          matchTitle: match.title,
        };
      }

      return this.snapshot.buildInTx(tx, input.matchId, input.actorId);
    });

    if (alertContext) {
      const { matchTitle, confirmedCount, minutesToStart } = alertContext;
      void this.matchNotification
        .onMissingPlayersAlertWithLookup({
          matchId: input.matchId,
          matchTitle,
          creatorId: snapshot.createdById,
          confirmedCount,
          capacity: snapshot.capacity,
          minutesToStart,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `[MatchNotification] onMissingPlayersAlert (kick) failed: ${(err as Error)?.message}`,
            { matchId: input.matchId },
          ),
        );
    }

    return snapshot;
  }
}
