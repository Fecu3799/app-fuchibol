import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';

export interface WithdrawInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class WithdrawParticipationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: WithdrawInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/withdraw',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
      },
      execute: () => this.run(input),
    });
  }

  private async run(input: WithdrawInput): Promise<MatchSnapshot> {
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

      const existing = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: { matchId: input.matchId, userId: input.actorId },
        },
      });

      if (
        !existing ||
        existing.status === 'INVITED' ||
        existing.status === 'DECLINED' ||
        existing.status === 'WITHDRAWN'
      ) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      const wasConfirmed = existing.status === 'CONFIRMED';

      await tx.matchParticipant.update({
        where: { id: existing.id },
        data: {
          status: 'WITHDRAWN',
          waitlistPosition: null,
          confirmedAt: null,
        },
      });

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
        }
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
