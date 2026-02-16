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

export interface InviteInput {
  matchId: string;
  actorId: string;
  targetUserId?: string;
  identifier?: string;
  expectedRevision: number;
  idempotencyKey: string;
}

@Injectable()
export class InviteParticipationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(input: InviteInput): Promise<MatchSnapshot> {
    // Resolve identifier -> userId before entering idempotency/transaction
    const targetUserId = await this.resolveTargetUser(input);

    // Self-invite check
    if (targetUserId === input.actorId) {
      throw new ConflictException('SELF_INVITE');
    }

    return this.idempotency.run({
      key: input.idempotencyKey,
      actorId: input.actorId,
      route: 'POST /matches/:id/invite',
      matchId: input.matchId,
      requestBody: {
        matchId: input.matchId,
        expectedRevision: input.expectedRevision,
        targetUserId,
      },
      execute: () => this.run(input, targetUserId),
    });
  }

  /** Resolve identifier (username/email) or direct userId to a user ID. */
  private async resolveTargetUser(input: InviteInput): Promise<string> {
    if (input.targetUserId) {
      return input.targetUserId;
    }

    const raw = input.identifier!.trim();
    let where: { username: string } | { email: string };

    if (raw.startsWith('@')) {
      // @username -> strip leading @
      where = { username: raw.slice(1).toLowerCase() };
    } else if (raw.includes('@')) {
      // email
      where = { email: raw.toLowerCase() };
    } else {
      // plain username
      where = { username: raw.toLowerCase() };
    }

    const user = await this.prisma.client.user.findFirst({ where });
    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }
    return user.id;
  }

  private async run(
    input: InviteInput,
    targetUserId: string,
  ): Promise<MatchSnapshot> {
    return this.prisma.client.$transaction(async (tx) => {
      await lockMatchRow(tx, input.matchId);

      const match = await tx.match.findUnique({
        where: { id: input.matchId },
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.createdById !== input.actorId) {
        throw new ForbiddenException('Only match admin can invite');
      }

      if (match.status === 'canceled') {
        throw new ConflictException('MATCH_CANCELLED');
      }

      if (match.revision !== input.expectedRevision) {
        throw new ConflictException('REVISION_CONFLICT');
      }

      if (match.isLocked) {
        throw new ConflictException('MATCH_LOCKED');
      }

      const existing = await tx.matchParticipant.findUnique({
        where: {
          matchId_userId: {
            matchId: input.matchId,
            userId: targetUserId,
          },
        },
      });

      if (existing) {
        // Already a participant — idempotent for INVITED, conflict for others
        if (existing.status === 'INVITED') {
          return buildMatchSnapshot(tx, input.matchId, input.actorId);
        }
        throw new ConflictException('ALREADY_PARTICIPANT');
      }

      await tx.matchParticipant.create({
        data: {
          matchId: input.matchId,
          userId: targetUserId,
          status: 'INVITED',
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
