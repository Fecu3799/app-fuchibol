import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';

export interface LockMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
}

@Injectable()
export class LockMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: LockMatchInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can lock');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      // Idempotent: already locked -> return snapshot without changing anything
      if (match.isLocked) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: input.actorId,
          revision: match.revision + 1,
        },
      });

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
