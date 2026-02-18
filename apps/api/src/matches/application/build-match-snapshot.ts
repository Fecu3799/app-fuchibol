import type { PrismaClient } from '@prisma/client';
import { computeMatchStatusView } from '../domain/compute-match-status-view';
import type { MatchStatusView } from '../domain/compute-match-status-view';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export interface ParticipantView {
  userId: string;
  username: string;
  status: string;
  waitlistPosition: number | null;
  isMatchAdmin: boolean;
}

export interface MatchSnapshot {
  id: string;
  title: string;
  startsAt: Date;
  location: string | null;
  capacity: number;
  status: string;
  matchStatus: MatchStatusView;
  revision: number;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedBy: string | null;
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
    include: { user: { select: { username: true } } },
  });

  const confirmed = participants.filter((p) => p.status === 'CONFIRMED');
  const waitlisted = participants
    .filter((p) => p.status === 'WAITLISTED')
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));

  const myParticipant = participants.find((p) => p.userId === actorId);
  const myStatus = myParticipant?.status ?? null;

  const isCreator = match.createdById === actorId;
  const isAdmin = isCreator || myParticipant?.isMatchAdmin === true;
  const isCanceled = match.status === 'canceled';

  const actionsAllowed: string[] = [];

  if (!isCanceled) {
    if (!match.isLocked) {
      if (!myStatus || myStatus === 'DECLINED' || myStatus === 'WITHDRAWN') {
        actionsAllowed.push('confirm');
      }
      if (myStatus === 'INVITED') {
        actionsAllowed.push('confirm', 'decline');
      }
      if (isAdmin) {
        actionsAllowed.push('invite');
      }
    }

    // Withdraw is always allowed (even when locked), but not when canceled
    if (myStatus === 'CONFIRMED' || myStatus === 'WAITLISTED') {
      actionsAllowed.push('withdraw');
    }

    if (isAdmin) {
      actionsAllowed.push(match.isLocked ? 'unlock' : 'lock');
    }

    // Creator-only actions
    if (isCreator) {
      actionsAllowed.push('update', 'cancel', 'manage_admins');
    }
  }

  const participantViews: ParticipantView[] = participants
    .filter((p) => p.status !== 'WITHDRAWN')
    .map((p) => ({
      userId: p.userId,
      username: p.user.username,
      status: p.status,
      waitlistPosition: p.waitlistPosition,
      isMatchAdmin: p.isMatchAdmin,
    }));

  const waitlistViews: ParticipantView[] = waitlisted.map((p, i) => ({
    userId: p.userId,
    username: p.user.username,
    status: p.status,
    waitlistPosition: i + 1,
    isMatchAdmin: p.isMatchAdmin,
  }));

  return {
    id: match.id,
    title: match.title,
    startsAt: match.startsAt,
    location: match.location,
    capacity: match.capacity,
    status: match.status,
    matchStatus: computeMatchStatusView(match),
    revision: match.revision,
    isLocked: match.isLocked,
    lockedAt: match.lockedAt,
    lockedBy: match.lockedBy,
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
