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
    onMatchStarted: jest.fn().mockResolvedValue(undefined),
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

/**
 * Builds a mock job with two separate findMany mocks:
 * - firstCall  → upcomingMatches  (startsAt > now, within 60min)
 * - secondCall → overdueMatches   (startsAt <= now, no lower bound)
 * - thirdCall  → inProgressMatches
 */
function buildJob(
  upcomingMatches: ReturnType<typeof makeMatch>[] = [],
  overdueMatches: ReturnType<typeof makeMatch>[] = [],
  inProgressMatches: ReturnType<typeof makeMatch>[] = [],
) {
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn(),
      update: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve({ revision: (args.data?.revision as number) ?? 2 }),
        ),
    },
    matchParticipant: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const prisma = {
    client: {
      match: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(upcomingMatches)   // upcoming
          .mockResolvedValueOnce(overdueMatches)     // overdue
          .mockResolvedValueOnce(inProgressMatches), // in_progress
      },
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  } as unknown as PrismaService;

  const topLevelFindUnique = jest.fn();
  (tx.match as any).findUnique = topLevelFindUnique;

  return { prisma, tx, topLevelFindUnique };
}

// ── Upcoming: Auto-lock ──────────────────────────────────────────────────────

describe('MatchLifecycleJob — Auto-lock rule (upcoming)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('locks match when full within 60min and not yet locked', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() + 30 * 60 * 1000),
      capacity: 2,
      isLocked: false,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([match]);
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
  });

  it('does NOT lock when match is already locked (idempotency)', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() + 30 * 60 * 1000),
      capacity: 2,
      isLocked: true,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([match]);
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

// ── Upcoming: Reminder ───────────────────────────────────────────────────────

describe('MatchLifecycleJob — Reminder rule (upcoming)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends reminder with bucket b3 when match starts in ~46min and not full', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() + 46 * 60 * 1000),
      capacity: 10,
      participants: [
        { userId: CREATOR_ID, status: 'CONFIRMED', isMatchAdmin: false },
        { userId: ADMIN_ID, status: 'CONFIRMED', isMatchAdmin: true },
      ],
    });

    const { prisma } = buildJob([match]);
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

  it('does NOT send reminder when confirmed equals capacity (full)', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() + 45 * 60 * 1000),
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([match]);
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

  it('does NOT send reminder for overdue matches (startsAt in the past)', async () => {
    // This is the core regression test for the reported bug:
    // overdue matches must NOT generate "Faltan jugadores" reminders.
    const overdueMatch = makeMatch({
      startsAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      capacity: 10,
      participants: [
        { userId: CREATOR_ID, status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    // The overdue match appears in the overdue bucket, NOT the upcoming bucket
    const { prisma, tx, topLevelFindUnique } = buildJob([], [overdueMatch]);
    topLevelFindUnique.mockResolvedValue({
      ...overdueMatch,
      status: 'scheduled',
      revision: 1,
    });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(1); // not full

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );
    await job.runTick();

    expect(notification.onReminderMissingPlayers).not.toHaveBeenCalled();
    // It should have been canceled instead
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceled' }),
      }),
    );
  });
});

// ── Overdue: Cancel ──────────────────────────────────────────────────────────

describe('MatchLifecycleJob — Overdue cancel rule', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels match that started 2 minutes ago and is not full', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 2 * 60 * 1000),
      status: 'scheduled',
      capacity: 10,
      participants: [
        { userId: CREATOR_ID, status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
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
  });

  it('cancels match that started DAYS ago (stale match — core regression test)', async () => {
    // This is the exact scenario reported: a match from days ago still in scheduled
    // state was emitting reminders. The fix ensures it ends up in the overdue bucket
    // and gets canceled, never receiving reminders.
    const match = makeMatch({
      startsAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      status: 'scheduled',
      capacity: 14,
      participants: [
        { userId: CREATOR_ID, status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled', revision: 1 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(1); // not full
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

    // Must be canceled
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceled' }),
      }),
    );
    // Must NOT have sent reminders
    expect(notification.onReminderMissingPlayers).not.toHaveBeenCalled();
  });

  it('does NOT cancel when overdue match is actually full (should start instead)', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 2 * 60 * 1000),
      status: 'scheduled',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled', revision: 1 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);
    tx.matchParticipant.findMany = jest
      .fn()
      .mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );
    await job.runTick();

    // Should transition to in_progress, not canceled
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
    expect(tx.match.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceled' }),
      }),
    );
  });

  it('is idempotent: does NOT cancel a match already canceled (concurrent tick)', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 5 * 60 * 1000),
      status: 'scheduled',
      capacity: 10,
      participants: [],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    // Inside tx: already canceled by another process
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'canceled', revision: 2 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(0);

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

// ── Overdue: Auto-start (IN_PROGRESS) ───────────────────────────────────────

describe('MatchLifecycleJob — Overdue auto-start rule (in_progress)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('transitions full match at start time to in_progress and removes waitlist', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 1 * 60 * 1000),
      status: 'scheduled',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled', revision: 1 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);
    tx.matchParticipant.findMany = jest
      .fn()
      .mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

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
        data: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
    expect(tx.matchParticipant.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'WAITLISTED' }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      null,
      'match.started',
      expect.anything(),
    );
  });

  it('sends push notification to confirmed players on start', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 1 * 60 * 1000),
      status: 'scheduled',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled', revision: 1 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);
    tx.matchParticipant.findMany = jest
      .fn()
      .mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

    const notification = buildMockNotification();
    const job = new MatchLifecycleJob(
      prisma,
      mockAudit,
      notification,
      mockRealtimePublisher,
    );
    await job.runTick();

    expect(notification.onMatchStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: MATCH_ID,
        userIds: expect.arrayContaining(['u1', 'u2']),
      }),
    );
  });

  it('is idempotent: does NOT re-transition if already in_progress', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 1 * 60 * 1000),
      status: 'scheduled',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    // Already transitioned inside tx
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'in_progress', revision: 2 });
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
    expect(notification.onMatchStarted).not.toHaveBeenCalled();
  });

  it('reconciles late job: transitions directly to played if >60min past start', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 90 * 60 * 1000), // 90min ago
      status: 'scheduled',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled', revision: 1 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);
    tx.matchParticipant.findMany = jest
      .fn()
      .mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

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
        data: expect.objectContaining({ status: 'played' }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      null,
      'match.started',
      expect.objectContaining({ targetStatus: 'played' }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      null,
      'match.played',
      expect.objectContaining({ lateReconciliation: true }),
    );
  });

  it('reconciles very stale full match (days old) directly to played', async () => {
    const match = makeMatch({
      startsAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      status: 'scheduled',
      capacity: 10,
      participants: Array.from({ length: 10 }, (_, i) => ({
        userId: `u${i}`,
        status: 'CONFIRMED',
        isMatchAdmin: false,
      })),
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'scheduled', revision: 1 });
    tx.matchParticipant.count = jest.fn().mockResolvedValue(10);
    tx.matchParticipant.findMany = jest
      .fn()
      .mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ userId: `u${i}` })));

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
        data: expect.objectContaining({ status: 'played' }),
      }),
    );
  });
});

// ── Finalize (PLAYED) ────────────────────────────────────────────────────────

describe('MatchLifecycleJob — Finalize rule (played)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('transitions in_progress match to played 60min after startsAt', async () => {
    const startsAt = new Date(Date.now() - 61 * 60 * 1000);
    const match = makeMatch({
      startsAt,
      status: 'in_progress',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [], [match]);
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'in_progress', revision: 2 });

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
        data: expect.objectContaining({ status: 'played' }),
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      null,
      'match.played',
      expect.anything(),
    );
  });

  it('does NOT finalize in_progress match before 60min have elapsed', async () => {
    const startsAt = new Date(Date.now() - 30 * 60 * 1000);
    const match = makeMatch({
      startsAt,
      status: 'in_progress',
      capacity: 2,
      participants: [
        { userId: 'u1', status: 'CONFIRMED', isMatchAdmin: false },
        { userId: 'u2', status: 'CONFIRMED', isMatchAdmin: false },
      ],
    });

    const { prisma, tx } = buildJob([], [], [match]);
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

  it('is idempotent: does NOT re-finalize if already played', async () => {
    const startsAt = new Date(Date.now() - 90 * 60 * 1000);
    const match = makeMatch({
      startsAt,
      status: 'in_progress',
      capacity: 2,
      participants: [],
    });

    const { prisma, tx, topLevelFindUnique } = buildJob([], [], [match]);
    // Already finalized by concurrent run
    topLevelFindUnique.mockResolvedValue({ ...match, status: 'played', revision: 3 });

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
