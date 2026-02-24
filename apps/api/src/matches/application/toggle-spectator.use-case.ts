import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';

export interface ToggleSpectatorInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class ToggleSpectatorUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: ToggleSpectatorInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/spectator',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
      },
      execute: () => this.run(input),
    });
  }

  private async run(input: ToggleSpectatorInput): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.status === 'canceled') {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      const existing = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: { matchId: input.matchId, userId: input.actorId },
        },
      });

      if (!existing) {
        // No participation → create as SPECTATOR
        await tx.matchParticipant.create({
          data: {
            matchId: input.matchId,
            userId: input.actorId,
            status: 'SPECTATOR',
          },
        });
      } else if (existing.status === 'SPECTATOR') {
        // SPECTATOR → INVITED (toggle back to participant)
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: { status: 'INVITED' },
        });
      } else if (existing.status === 'CONFIRMED') {
        // CONFIRMED → SPECTATOR: promote first waitlisted
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'SPECTATOR',
            waitlistPosition: null,
            confirmedAt: null,
          },
        });

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
      } else {
        // INVITED / WAITLISTED / DECLINED / WITHDRAWN → SPECTATOR
        await tx.matchParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'SPECTATOR',
            waitlistPosition: null,
            confirmedAt: null,
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
