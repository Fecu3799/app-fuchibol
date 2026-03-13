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

export interface GenerateBalancedTeamsInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
}

const SKILL_ORDER: Record<string, number> = {
  PRO: 5,
  SEMIPRO: 4,
  REGULAR: 3,
  AMATEUR: 2,
  BEGINNER: 1,
};

@Injectable()
export class GenerateBalancedTeamsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: GenerateBalancedTeamsInput): Promise<MatchSnapshot> {
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
        include: { user: { select: { skillLevel: true } } },
      });

      if (confirmedRows.length === 0) {
        throw new UnprocessableEntityException('NO_CONFIRMED_PLAYERS');
      }

      // Sort by skill desc; players without skill go last
      const sorted = [...confirmedRows].sort((a, b) => {
        const aSkill = SKILL_ORDER[a.user.skillLevel ?? ''] ?? 0;
        const bSkill = SKILL_ORDER[b.user.skillLevel ?? ''] ?? 0;
        return bSkill - aSkill;
      });

      // Snake draft: alternating assignment A, B, B, A, A, B, ...
      // Index 0 → A, 1 → B, 2 → B, 3 → A, 4 → A, 5 → B ...
      // Pattern repeats every 4: [A, B, B, A]
      const teamAPlayers: string[] = [];
      const teamBPlayers: string[] = [];
      sorted.forEach((row, i) => {
        const pos = i % 4;
        if (pos === 0 || pos === 3) {
          teamAPlayers.push(row.userId);
        } else {
          teamBPlayers.push(row.userId);
        }
      });

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
        AuditLogType.TEAMS_GENERATED_BALANCED,
        {
          confirmedCount: confirmedRows.length,
          slotsPerTeam,
        },
      );
    });

    return buildMatchSnapshot(this.prisma.client, matchId, actorId);
  }
}
