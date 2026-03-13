import type { PrismaClient } from '@prisma/client';
import { MatchAuditService, AuditLogType } from '../audit/match-audit.service';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

/**
 * Clears the slot assigned to a specific user.
 * No-op if the user has no slot assigned.
 */
export async function releaseTeamSlot(
  tx: TransactionClient,
  matchId: string,
  userId: string,
  actorId: string,
  audit: MatchAuditService,
): Promise<void> {
  const slot = await tx.matchTeamSlot.findFirst({
    where: { matchId, userId },
  });

  if (!slot) return;

  await tx.matchTeamSlot.update({
    where: { id: slot.id },
    data: { userId: null },
  });

  await audit.log(tx, matchId, actorId, AuditLogType.TEAM_SLOT_RELEASED, {
    releasedUserId: userId,
    team: slot.team,
    slotIndex: slot.slotIndex,
  });
}

/**
 * Clears all slots assigned to any of the given users.
 * Used when a major match change forces multiple players back to INVITED.
 */
export async function releaseTeamSlotsBatch(
  tx: TransactionClient,
  matchId: string,
  userIds: string[],
  actorId: string,
  audit: MatchAuditService,
): Promise<void> {
  if (userIds.length === 0) return;

  const { count } = await tx.matchTeamSlot.updateMany({
    where: { matchId, userId: { in: userIds } },
    data: { userId: null },
  });

  if (count > 0) {
    await audit.log(tx, matchId, actorId, AuditLogType.TEAM_SLOT_RELEASED, {
      releasedUserIds: userIds,
      count,
    });
  }
}

/**
 * Assigns a newly-confirmed player to the first empty slot.
 * Order: team A first, then team B, ascending by slotIndex.
 * No-op if no empty slot exists.
 */
export async function autoAssignTeamSlot(
  tx: TransactionClient,
  matchId: string,
  userId: string,
  actorId: string,
  audit: MatchAuditService,
): Promise<void> {
  const emptySlot = await tx.matchTeamSlot.findFirst({
    where: { matchId, userId: null },
    orderBy: [{ team: 'asc' }, { slotIndex: 'asc' }],
  });

  if (!emptySlot) return;

  await tx.matchTeamSlot.update({
    where: { id: emptySlot.id },
    data: { userId },
  });

  await audit.log(tx, matchId, actorId, AuditLogType.TEAM_SLOT_AUTO_ASSIGNED, {
    assignedUserId: userId,
    team: emptySlot.team,
    slotIndex: emptySlot.slotIndex,
  });
}
