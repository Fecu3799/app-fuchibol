import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';

export interface LeaveMatchInput {
  matchId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class LeaveMatchUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: LeaveMatchInput): Promise<MatchSnapshot> {
    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/leave',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
      },
      execute: () => this.run(input),
    });
  }

  private async run(input: LeaveMatchInput): Promise<MatchSnapshot> {
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

      // Idempotent: already gone
      if (!existing) {
        return buildMatchSnapshot(tx, input.matchId, input.actorId);
      }

      const isCreator = match.createdById === input.actorId;

      if (isCreator) {
        // Transfer creator to first matchAdmin by adminGrantedAt
        const candidate = await tx.matchParticipant.findFirst({
          where: {
            matchId: input.matchId,
            isMatchAdmin: true,
            userId: { not: input.actorId },
            status: { notIn: ['WITHDRAWN', 'DECLINED'] },
          },
          orderBy: { adminGrantedAt: 'asc' },
        });

        if (!candidate) {
          throw new UnprocessableEntityException('CREATOR_TRANSFER_REQUIRED');
        }

        await tx.match.update({
          where: { id: input.matchId },
          data: { createdById: candidate.userId },
        });

        // Ensure new creator is CONFIRMED
        if (candidate.status !== 'CONFIRMED') {
          await tx.matchParticipant.update({
            where: { id: candidate.id },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
          });
        }
      }

      const wasConfirmed = existing.status === 'CONFIRMED';

      // Hard delete the participation row
      await tx.matchParticipant.delete({
        where: { id: existing.id },
      });

      // Promote from waitlist if the leaving user was confirmed
      if (wasConfirmed) {
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
      }

      await tx.match.update({
        where: { id: input.matchId },
        data: { revision: match.revision + 1 },
      });

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
