import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export interface ParticipantView {
  userId: string;
  status: string;
  waitlistPosition: number | null;
}

export interface MatchSnapshot {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  status: string;
  revision: number;
  createdById: string;
  confirmedCount: number;
  participants: ParticipantView[];
  waitlist: ParticipantView[];
  myStatus: string | null;
  actionsAllowed: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function buildMatchSnapshot(
  prisma: PrismaClient | TransactionClient,
  matchId: string,
  actorId: string,
): Promise<MatchSnapshot> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
  });

  const participants = await prisma.matchParticipant.findMany({
    where: { matchId },
    orderBy: { createdAt: 'asc' },
  });

  const confirmed = participants.filter((p) => p.status === 'CONFIRMED');
  const waitlisted = participants
    .filter((p) => p.status === 'WAITLISTED')
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));

  const myParticipant = participants.find((p) => p.userId === actorId);
  const myStatus = myParticipant?.status ?? null;

  const isAdmin = match.createdById === actorId;

  const actionsAllowed: string[] = [];
  if (!myStatus || myStatus === 'DECLINED' || myStatus === 'WITHDRAWN') {
    actionsAllowed.push('confirm');
  }
  if (myStatus === 'INVITED') {
    actionsAllowed.push('confirm', 'decline');
  }
  if (myStatus === 'CONFIRMED' || myStatus === 'WAITLISTED') {
    actionsAllowed.push('withdraw');
  }
  if (isAdmin) {
    actionsAllowed.push('invite');
  }

  const participantViews: ParticipantView[] = participants
    .filter((p) => p.status !== 'WITHDRAWN')
    .map((p) => ({
      userId: p.userId,
      status: p.status,
      waitlistPosition: p.waitlistPosition,
    }));

  const waitlistViews: ParticipantView[] = waitlisted.map((p, i) => ({
    userId: p.userId,
    status: p.status,
    waitlistPosition: i + 1,
  }));

  return {
    id: match.id,
    title: match.title,
    startsAt: match.startsAt,
    capacity: match.capacity,
    status: match.status,
    revision: match.revision,
    createdById: match.createdById,
    confirmedCount: confirmed.length,
    participants: participantViews,
    waitlist: waitlistViews,
    myStatus,
    actionsAllowed: [...new Set(actionsAllowed)],
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}
