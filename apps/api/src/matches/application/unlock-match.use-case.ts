import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';

export interface UnlockMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
}

@Injectable()
export class UnlockMatchUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UnlockMatchInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can unlock');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      // Idempotent: already unlocked -> return snapshot without changing anything
      if (!match.isLocked) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: {
          isLocked: false,
          lockedAt: null,
          lockedBy: null,
          revision: match.revision + 1,
        },
      });

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
