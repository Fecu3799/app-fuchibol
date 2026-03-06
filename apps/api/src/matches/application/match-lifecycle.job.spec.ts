import { MatchLifecycleJob } from './match-lifecycle.job';
import type { PrismaService } from '../../infra/prisma/prisma.service';

const MATCH_ID = 'match-1';
const CREATOR_ID = 'creator-1';
const ADMIN_ID = 'admin-1';

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) } as any;
const mockRealtimePublisher = {
  notifyMatchUpdated: jest.fn(),
} as any;

function buildMockNotification() {
  return {
    onReminderMissingPlayers: jest.fn().mockResolvedValue(undefined),
    onMissingPlayersAlert: jest.fn().mockResolvedValue(undefined),
    onCanceled: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeMatch(
  overrides: Partial<{
    id: string;
    title: string;
    startsAt: Date;
    capacity: number;
    status: string;
    revision: number;
    isLocked: boolean;
    createdById: string;
    participants: Array<{
      userId: string;
      status: string;
      isMatchAdmin: boolean;
    }>;
  }> = {},
) {
  return {
    id: MATCH_ID,
    title: 'Test Match',
    startsAt: new Date(Date.now() + 30 * 60 * 1000), // now + 30min
    capacity: 10,
    status: 'scheduled',
    revision: 1,
    isLocked: false,
    createdById: CREATOR_ID,
    participants: [],
    ...overrides,
  };
}

function buildJob(prismaOverrides: Record<string, unknown> = {}) {
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve({ revision: (args.data?.revision as number) ?? 2 }),
        ),
    },
    matchParticipant: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const prisma = {
    client: {
      match: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      matchParticipant: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...prismaOverrides,
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  } as unknown as PrismaService;

  // Make the tx's match.findUnique return same as top-level by default
  const topLevelFindMany = (prisma.client as any).match.findMany;
  const topLevelFindUnique = jest.fn();
  (tx.match as any).findUnique = topLevelFindUnique;

  return { prisma, tx, topLevelFindUnique, topLevelFindMany };
}

// ── Auto-lock ───────────────────────────────────────────────────────────────

describe('MatchLifecycleJob — Auto-lock rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks match when full within 60min and not yet locked', async () => {
    const match = makeMatch({
      capacity: 2,
      isLocked: false,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob({
      match: { findMany: jest.fn().mockResolvedValue([match]) },
    });

    // Inside tx, re-read returns unlocked match
    topLevelFindUnique.mockResolvedValue({ ...match, isLocked: false });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2); // capacity = 2

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );

    await job.runTick();

    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isLocked: true }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      null,
      'match.auto_locked',
      expect.anything(),
    );
    expect(mockRealtimePublisher.notifyMatchUpdated).toHaveBeenCalledWith(
      MATCH_ID,
      expect.any(Number),
    );
  });

  it('does NOT lock when match is already locked (idempotency)', async () => {
    const match = makeMatch({
      capacity: 2,
      isLocked: true,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob({
      match: { findMany: jest.fn().mockResolvedValue([match]) },
    });

    // In tx, match is already locked
    topLevelFindUnique.mockResolvedValue({ ...match, isLocked: true });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );

    await job.runTick();

    expect(tx.match.update).not.toHaveBeenCalled();
  });
});

// ── Reminder ────────────────────────────────────────────────────────────────

describe('MatchLifecycleJob — Reminder rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends reminder with bucket b3 when match starts in ~45min, not full, no prior delivery', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() + 45 * 60 * 1000),
      capacity: 10,
      participants: [
        { userId: CREATOR_ID, status: 'CONFIRMED', isMatchAdmin: false },
        { userId: ADMIN_ID, status: 'CONFIRMED', isMatchAdmin: true },
      ],
    });

    const { prisma } = buildJob({
      match: { findMany: jest.fn().mockResolvedValue([match]) },
    });

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );

    await job.runTick();

    expect(notification.onReminderMissingPlayers).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: MATCH_ID,
        bucket: 'b3',
        missingCount: 8,
        userIds: expect.arrayContaining([CREATOR_ID, ADMIN_ID]),
      }),
    );
  });

  it('does NOT send reminder when confirmed count equals capacity (full)', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() + 45 * 60 * 1000),
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob({
      match: { findMany: jest.fn().mockResolvedValue([match]) },
    });

    topLevelFindUnique.mockResolvedValue({ ...match, isLocked: false });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );

    await job.runTick();

    expect(notification.onReminderMissingPlayers).not.toHaveBeenCalled();
  });
});

// ── Auto-cancel ─────────────────────────────────────────────────────────────

describe('MatchLifecycleJob — Auto-cancel rule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels match that already started and is not full', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
      status: 'scheduled',
      capacity: 10,
      participants: [
        { userId: CREATOR_ID, status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob({
      match: { findMany: jest.fn().mockResolvedValue([match]) },
    });

    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled' });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(1);
    tx.matchParticipant.findMany = jest
      .fn()
      .mockResolvedValue([{ userId: CREATOR_ID }]);

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );

    await job.runTick();

    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceled' }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      null,
      'match.auto_canceled',
      expect.anything(),
    );
    expect(mockRealtimePublisher.notifyMatchUpdated).toHaveBeenCalledWith(
      MATCH_ID,
      expect.any(Number),
    );
    // onCanceled called fire-and-forget (may not be awaited synchronously)
  });

  it('does NOT cancel match that already started but IS full', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 2 * 60 * 1000),
      status: 'scheduled',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob({
      match: { findMany: jest.fn().mockResolvedValue([match]) },
    });

    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled' });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );

    await job.runTick();

    expect(tx.match.update).not.toHaveBeenCalled();
  });
});
