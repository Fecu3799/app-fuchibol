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

export interface GenerateRandomTeamsInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
}

@Injectable()
export class GenerateRandomTeamsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: GenerateRandomTeamsInput): Promise<MatchSnapshot> {
    const { matchId, actorId, expectedRevision } = input;

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

      const confirmedRows = await tx.matchParticipant.findMany({
        where: { matchId, status: 'CONFIRMED' },
        select: { userId: true },
      });

      if (confirmedRows.length === 0) {
        throw new UnprocessableEntityException('NO_CONFIRMED_PLAYERS');
      }

      // Fisher-Yates shuffle
      const players = confirmedRows.map((r) => r.userId);
      for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
      }

      // Fill slots: first slotsPerTeam go to A, next slotsPerTeam go to B
      const teamAPlayers = players.slice(0, slotsPerTeam);
      const teamBPlayers = players.slice(slotsPerTeam, slotsPerTeam * 2);

      const slotData = [
        ...Array.from({ length: slotsPerTeam }, (_, i) => ({
          matchId,
          team: 'A',
          slotIndex: i,
          userId: teamAPlayers[i] ?? null,
        })),
        ...Array.from({ length: slotsPerTeam }, (_, i) => ({
          matchId,
          team: 'B',
          slotIndex: i,
          userId: teamBPlayers[i] ?? null,
        })),
      ];

      await tx.matchTeamSlot.deleteMany({ where: { matchId } });
      await tx.matchTeamSlot.createMany({ data: slotData });

      await tx.match.update({
        where: { id: matchId },
        data: { teamsConfigured: true, revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        matchId,
        actorId,
        AuditLogType.TEAMS_GENERATED_RANDOM,
        {
          confirmedCount: confirmedRows.length,
          slotsPerTeam,
        },
      );
    });

    return buildMatchSnapshot(this.prisma.client, matchId, actorId);
  }
}
