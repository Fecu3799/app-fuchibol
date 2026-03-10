import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { buildMatchSnapshot } from './build-match-snapshot';
import type { MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';
import { MatchAuditService, AuditLogType } from './match-audit.service';

export interface SaveTeamsInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  teamA: (string | null)[];
  teamB: (string | null)[];
}

@Injectable()
export class SaveTeamsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: SaveTeamsInput): Promise<MatchSnapshot> {
    const { matchId, actorId, expectedRevision, teamA, teamB } = input;

    await this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, matchId);

      const match = await tx.match.findUniqueOrThrow({
        where: { id: matchId },
      });

      if (match.createdById !== actorId) {
        throw new ForbiddenException('FORBIDDEN');
      }

      if (
        match.status === 'canceled' ||
        match.status === 'played' ||
        match.status === 'in_progress'
      ) {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      const slotsPerTeam = Math.floor(match.capacity / 2);
      if (teamA.length !== slotsPerTeam || teamB.length !== slotsPerTeam) {
        throw new UnprocessableEntityException('INVALID_TEAM_SIZE');
      }

      // All non-null userIds must be CONFIRMED in this match, no duplicates
      const allUserIds = [...teamA, ...teamB].filter(
        (id): id is string => id !== null,
      );
      const uniqueIds = new Set(allUserIds);
      if (uniqueIds.size !== allUserIds.length) {
        throw new UnprocessableEntityException('DUPLICATE_PLAYER_IN_TEAMS');
      }

      if (allUserIds.length > 0) {
        const confirmedCount = await tx.matchParticipant.count({
          where: {
            matchId,
            userId: { in: allUserIds },
            status: 'CONFIRMED',
          },
        });
        if (confirmedCount !== allUserIds.length) {
          throw new UnprocessableEntityException('PLAYER_NOT_CONFIRMED');
        }
      }

      // Replace all slots atomically
      await tx.matchTeamSlot.deleteMany({ where: { matchId } });

      const slotData = [
        ...teamA.map((userId, i) => ({
          matchId,
          team: 'A',
          slotIndex: i,
          userId: userId ?? null,
        })),
        ...teamB.map((userId, i) => ({
          matchId,
          team: 'B',
          slotIndex: i,
          userId: userId ?? null,
        })),
      ];

      await tx.matchTeamSlot.createMany({ data: slotData });

      await tx.match.update({
        where: { id: matchId },
        data: { teamsConfigured: true, revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        matchId,
        actorId,
        AuditLogType.TEAMS_CONFIGURED,
        {
          slotsPerTeam,
          filledSlots: allUserIds.length,
        },
      );
    });

    return buildMatchSnapshot(this.prisma.client, matchId, actorId);
  }
}
