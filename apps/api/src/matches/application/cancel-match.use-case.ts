import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';

export interface CancelMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class CancelMatchUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: CancelMatchInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
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

      await tx.match.update({
        where: { id: input.matchId },
        data: {
          status: 'canceled',
          revision: match.revision + 1,
        },
      });

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
