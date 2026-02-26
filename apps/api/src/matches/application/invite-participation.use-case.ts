import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { resolveUser } from '../../common/helpers/resolve-user.helper';
import { buildMatchSnapshot, type MatchSnapshot } from './build-match-snapshot';
import { lockMatchRow } from './lock-match-row';
import { isCreatorOrMatchAdmin } from './match-permissions';
import { MatchAuditService, AuditLogType } from './match-audit.service';
import { MatchNotificationService } from './match-notification.service';

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
  private readonly logger = new Logger(InviteParticipationUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: MatchAuditService,
    private readonly matchNotification: MatchNotificationService,
  ) {}

  async execute(input: InviteInput): Promise<MatchSnapshot> {
    // Resolve identifier -> userId before entering idempotency/transaction
    const targetUserId = await resolveUser(this.prisma.client, input);

    // Self-invite check
    if (targetUserId === input.actorId) {
      throw new ConflictException('SELF_INVITE');
    }

    const snapshot = await this.idempotency.run({
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

    void this.matchNotification
      .onInvited({
        matchId: input.matchId,
        matchTitle: snapshot.title,
        invitedUserId: targetUserId,
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `[MatchNotification] onInvited failed: ${(err as Error)?.message}`,
          { matchId: input.matchId },
        ),
      );

    return snapshot;
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

      if (
        !(await isCreatorOrMatchAdmin(match, tx, input.matchId, input.actorId))
      ) {
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
        // Already a participant — idempotent for INVITED, reinvite spectators, conflict for others
        if (existing.status === 'INVITED') {
          return buildMatchSnapshot(tx, input.matchId, input.actorId);
        }
        if (existing.status === 'SPECTATOR') {
          await tx.matchParticipant.update({
            where: { id: existing.id },
            data: { status: 'INVITED' },
          });
          await tx.match.update({
            where: { id: input.matchId },
            data: { revision: match.revision + 1 },
          });
          await this.audit.log(
            tx,
            input.matchId,
            input.actorId,
            AuditLogType.INVITE_SENT,
            { targetUserId, identifier: input.identifier },
          );
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

      await this.audit.log(
        tx,
        input.matchId,
        input.actorId,
        AuditLogType.INVITE_SENT,
        { targetUserId, identifier: input.identifier },
      );

      return buildMatchSnapshot(tx, input.matchId, input.actorId);
    });
  }
}
