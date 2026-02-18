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

export interface DemoteAdminInput {
  matchId: string;
  actorId: string;
  targetUserId: string;
  expectedRevision: number;
}

@Injectable()
export class DemoteAdminUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: DemoteAdminInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only creator can manage admins');
      }

      if (match.status === 'canceled') {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      if (input.targetUserId === match.createdById) {
        throw new UnprocessableEntityException('CANNOT_DEMOTE_CREATOR');
      }

      const participant = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: {
            matchId: input.matchId,
            userId: input.targetUserId,
          },
        },
      });

      // Idempotent: not a participant or not admin → return snapshot
      if (!participant || !participant.isMatchAdmin) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      await tx.matchParticipant.update({
        where: { id: participant.id },
        data: {
          isMatchAdmin: false,
          adminGrantedAt: null,
        },
      });

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
