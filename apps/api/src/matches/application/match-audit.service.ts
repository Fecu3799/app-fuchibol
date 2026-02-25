import { Injectable } from '@nestjs/common';
import type { PrismaClient, Prisma } from '@prisma/client';

export const AuditLogType = {
  PARTICIPANT_CONFIRMED: 'participant.confirmed',
  PARTICIPANT_DECLINED: 'participant.declined',
  PARTICIPANT_LEFT: 'participant.left',
  PARTICIPANT_SPECTATOR_ON: 'participant.spectator_on',
  PARTICIPANT_SPECTATOR_OFF: 'participant.spectator_off',
  WAITLIST_PROMOTED: 'waitlist.promoted',
  WAITLIST_DEMOTED: 'waitlist.demoted',
  MATCH_LOCKED: 'match.locked',
  MATCH_UNLOCKED: 'match.unlocked',
  MATCH_CANCELED: 'match.canceled',
  MATCH_UPDATED_MAJOR: 'match.updated_major',
  INVITE_SENT: 'invite.sent',
  ADMIN_PROMOTED: 'admin.promoted',
  ADMIN_DEMOTED: 'admin.demoted',
} as const;

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

@Injectable()
export class MatchAuditService {
  async log(
    tx: PrismaClient | TransactionClient,
    matchId: string,
    actorId: string | null,
    type: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await tx.matchAuditLog.create({
      data: {
        matchId,
        actorId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
