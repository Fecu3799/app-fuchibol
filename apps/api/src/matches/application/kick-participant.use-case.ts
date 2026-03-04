import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';
import { MatchAuditService, AuditLogType } from './match-audit.service';

export interface KickParticipantInput {
  matchId: string;
  actorId: string;
  targetUserId: string;
  expectedRevision: number;
}

@Injectable()
export class KickParticipantUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: KickParticipantInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) throw new NotFoundException('Match not found');

      if (match.status === 'canceled') {
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

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
