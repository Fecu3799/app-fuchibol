import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MatchSnapshotService } from '../shared/match-snapshot.service';
import type { MatchSnapshot } from '../shared/match-snapshot.service';
import { lockMatchRow } from '../shared/lock-match-row';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';

export interface MoveTeamPlayerInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  fromTeam: string;
  fromSlotIndex: number;
  toTeam: string;
  toSlotIndex: number;
}

@Injectable()
export class MoveTeamPlayerUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshot: MatchSnapshotService,
    private readonly audit: MatchAuditService,
  ) {}

  async execute(input: MoveTeamPlayerInput): Promise<MatchSnapshot> {
    const {
      matchId,
      actorId,
      expectedRevision,
      fromTeam,
      fromSlotIndex,
      toTeam,
      toSlotIndex,
    } = input;

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

      if (!match.teamsConfigured) {
        throw new UnprocessableEntityException('TEAMS_NOT_CONFIGURED');
      }

      const fromSlot = await tx.matchTeamSlot.findUnique({
        where: {
          matchId_team_slotIndex: {
            matchId,
            team: fromTeam,
            slotIndex: fromSlotIndex,
          },
        },
      });
      const toSlot = await tx.matchTeamSlot.findUnique({
        where: {
          matchId_team_slotIndex: {
            matchId,
            team: toTeam,
            slotIndex: toSlotIndex,
          },
        },
      });

      if (!fromSlot || !toSlot) {
        throw new UnprocessableEntityException('SLOT_NOT_FOUND');
      }

      // Swap userIds between the two slots
      await tx.matchTeamSlot.update({
        where: {
          matchId_team_slotIndex: {
            matchId,
            team: fromTeam,
            slotIndex: fromSlotIndex,
          },
        },
        data: { userId: toSlot.userId },
      });
      await tx.matchTeamSlot.update({
        where: {
          matchId_team_slotIndex: {
            matchId,
            team: toTeam,
            slotIndex: toSlotIndex,
          },
        },
        data: { userId: fromSlot.userId },
      });

      await tx.match.update({
        where: { id: matchId },
        data: { revision: match.revision + 1 },
      });

      await this.audit.log(
        tx,
        matchId,
        actorId,
        AuditLogType.TEAM_PLAYER_MOVED,
        {
          fromTeam,
          fromSlotIndex,
          toTeam,
          toSlotIndex,
          movedUserId: fromSlot.userId,
          swappedWithUserId: toSlot.userId,
        },
      );
    });

    return this.snapshot.build(matchId, actorId);
  }
}
