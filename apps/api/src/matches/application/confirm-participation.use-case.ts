import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';

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
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: ConfirmInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/confirm',
      matchId: input.matchId,
      execute: () => this.run(input),
    });
  }

  private async run(input: ConfirmInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      if (match.isLocked) {
        throw new ConflictException('MATCH_LOCKED');
      }

      const confirmedCount = await tx.matchParticipant.count({
        where: { matchId: input.matchId, status: 'CONFIRMED' },
      });

      const existing = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: { matchId: input.matchId, userId: input.actorId },
        },
      });

      if (existing?.status === 'CONFIRMED') {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      if (existing?.status === 'WAITLISTED') {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

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

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
