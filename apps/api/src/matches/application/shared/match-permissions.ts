import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export function isCreator(
  match: { createdById: string },
  actorId: string,
): boolean {
  return match.createdById === actorId;
}

export async function isCreatorOrMatchAdmin(
  match: { createdById: string },
  tx: PrismaClient | TransactionClient,
  matchId: string,
  actorId: string,
): Promise<boolean> {
  if (match.createdById === actorId) return true;

  const participant = await tx.matchParticipant.findUnique({
    where: { matchId_userId: { matchId, userId: actorId } },
    select: { isMatchAdmin: true },
  });

  return participant?.isMatchAdmin === true;
}
