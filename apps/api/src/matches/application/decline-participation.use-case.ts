import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';

export interface DeclineInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class DeclineParticipationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: DeclineInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/decline',
      matchId: input.matchId,
      execute: () => this.run(input),
    });
  }

  private async run(input: DeclineInput): Promise<MatchSnapshot> {
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

      if (existing?.status === 'DECLINED') {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      if (existing?.status === 'CONFIRMED') {
        throw new ConflictException(
          'Cannot decline while confirmed. Use withdraw first.',
        );
      }

      if (existing) {
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: { status: 'DECLINED', waitlistPosition: null },
        });
      } else {
        await tx.matchParticipant.create({
          data: {
            matchId: input.matchId,
            userId: input.actorId,
            status: 'DECLINED',
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
