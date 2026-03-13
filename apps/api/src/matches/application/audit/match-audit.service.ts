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
  INVITE_REJECTED: 'invite.rejected',
  ADMIN_PROMOTED: 'admin.promoted',
  ADMIN_DEMOTED: 'admin.demoted',
  PARTICIPANT_KICKED: 'participant.kicked',
  MATCH_AUTO_LOCKED: 'match.auto_locked',
  MATCH_AUTO_CANCELED: 'match.auto_canceled',
  MATCH_STARTED: 'match.started',
  MATCH_PLAYED: 'match.played',
  TEAMS_CONFIGURED: 'teams.configured',
  TEAMS_GENERATED_RANDOM: 'teams.generated_random',
  TEAMS_GENERATED_BALANCED: 'teams.generated_balanced',
  TEAM_PLAYER_MOVED: 'teams.player_moved',
  TEAM_SLOT_RELEASED: 'teams.slot_released',
  TEAM_SLOT_AUTO_ASSIGNED: 'teams.slot_auto_assigned',
  MATCH_AUTO_TEAMS_GENERATED: 'match.auto_teams_generated',
  TEAMS_RESET: 'teams.reset',
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
