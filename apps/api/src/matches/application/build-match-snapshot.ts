import type { PrismaClient } from '@prisma/client';
import { computeMatchStatusView } from '../domain/compute-match-status-view';
import type { MatchStatusView } from '../domain/compute-match-status-view';
import { computeMatchGender } from '../domain/compute-match-gender';
import type { MatchGender } from '../domain/compute-match-gender';
import type { VenueSnapshot, PitchSnapshot } from './create-match.use-case';

export type { VenueSnapshot, PitchSnapshot };

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export interface ParticipantView {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: string;
  waitlistPosition: number | null;
  isMatchAdmin: boolean;
}

export interface SpectatorView {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export interface MatchSnapshot {
  id: string;
  title: string;
  startsAt: Date;
  location: string | null;
  capacity: number;
  status: string;
  matchStatus: MatchStatusView;
  matchGender: MatchGender;
  revision: number;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedBy: string | null;
  createdById: string;
  confirmedCount: number;
  participants: ParticipantView[];
  waitlist: ParticipantView[];
  spectators: SpectatorView[];
  spectatorCount: number;
  myStatus: string | null;
  actionsAllowed: string[];
  venueId: string | null;
  venuePitchId: string | null;
  venueSnapshot: VenueSnapshot | null;
  pitchSnapshot: PitchSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function buildMatchSnapshot(
  prisma: PrismaClient | TransactionClient,
  matchId: string,
  actorId: string,
  urlBuilder?: (key: string) => string,
): Promise<MatchSnapshot> {
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
  });

  const participants = await prisma.matchParticipant.findMany({
    where: { matchId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          username: true,
          gender: true,
          avatar: { select: { key: true } },
        },
      },
    },
  });

  const confirmed = participants.filter((p) => p.status === 'CONFIRMED');
  const waitlisted = participants
    .filter((p) => p.status === 'WAITLISTED')
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const spectatorRows = participants.filter((p) => p.status === 'SPECTATOR');

  const myParticipant = participants.find((p) => p.userId === actorId);
  const myStatus = myParticipant?.status ?? null;

  const isCreator = match.createdById === actorId;
  const isAdmin = isCreator || myParticipant?.isMatchAdmin === true;
  // Matches are immutable (no actions) when DB status is canceled, played, or in_progress.
  const isImmutable =
    match.status === 'canceled' ||
    match.status === 'played' ||
    match.status === 'in_progress';

  const actionsAllowed: string[] = [];

  if (!isImmutable) {
    if (!match.isLocked) {
      if (!myStatus) {
        actionsAllowed.push('confirm');
      }
      if (myStatus === 'INVITED') {
        actionsAllowed.push('confirm', 'reject');
      }
      if (isAdmin) {
        actionsAllowed.push('invite');
      }
    } else {
      // Locked: INVITED users can still respond to their invitation
      if (myStatus === 'INVITED') {
        actionsAllowed.push('confirm', 'reject');
      }
    }

    // Spectator toggle: always available
    // Not shown when SPECTATOR — instead 'confirm' is hidden and 'spectator' becomes "Participate"
    actionsAllowed.push('spectator');

    // Leave is always allowed for any participant (hard delete)
    // Creator can also leave even without a participation row (triggers admin transfer)
    if (myStatus || isCreator) {
      actionsAllowed.push('leave');
    }

    if (isAdmin) {
      actionsAllowed.push(match.isLocked ? 'unlock' : 'lock');
    }

    // Creator-only actions
    if (isCreator) {
      actionsAllowed.push('update', 'cancel', 'manage_admins', 'manage_kick');
    }
  }

  // Participants: exclude SPECTATOR (spectators shown separately)
  const buildAvatarUrl = (key: string | null | undefined): string | null => {
    if (!key || !urlBuilder) return null;
    return urlBuilder(key);
  };

  const participantViews: ParticipantView[] = participants
    .filter((p) => p.status !== 'SPECTATOR')
    .map((p) => ({
      userId: p.userId,
      username: p.user.username,
      avatarUrl: buildAvatarUrl(p.user.avatar?.key),
      status: p.status,
      waitlistPosition: p.waitlistPosition,
      isMatchAdmin: p.isMatchAdmin,
    }));

  const waitlistViews: ParticipantView[] = waitlisted.map((p, i) => ({
    userId: p.userId,
    username: p.user.username,
    avatarUrl: buildAvatarUrl(p.user.avatar?.key),
    status: p.status,
    waitlistPosition: i + 1,
    isMatchAdmin: p.isMatchAdmin,
  }));

  const spectatorViews: SpectatorView[] = spectatorRows.map((p) => ({
    userId: p.userId,
    username: p.user.username,
    avatarUrl: buildAvatarUrl(p.user.avatar?.key),
  }));

  return {
    id: match.id,
    title: match.title,
    startsAt: match.startsAt,
    location: match.location,
    capacity: match.capacity,
    status: match.status,
    matchStatus: computeMatchStatusView(match),
    matchGender: computeMatchGender(
      confirmed
        .map((p) => p.user.gender)
        .filter((g): g is NonNullable<typeof g> => g !== null),
    ),
    revision: match.revision,
    isLocked: match.isLocked,
    lockedAt: match.lockedAt,
    lockedBy: match.lockedBy,
    createdById: match.createdById,
    confirmedCount: confirmed.length,
    participants: participantViews,
    waitlist: waitlistViews,
    spectators: spectatorViews,
    spectatorCount: spectatorRows.length,
    myStatus,
    actionsAllowed: [...new Set(actionsAllowed)],
    venueId: match.venueId ?? null,
    venuePitchId: match.venuePitchId ?? null,
    venueSnapshot: (match.venueSnapshot as VenueSnapshot | null) ?? null,
    pitchSnapshot: (match.pitchSnapshot as PitchSnapshot | null) ?? null,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  };
}
