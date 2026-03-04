import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpdateMatchUseCase } from './update-match.use-case';
import { LockMatchUseCase } from './lock-match.use-case';
import { UnlockMatchUseCase } from './unlock-match.use-case';
import { ConfirmParticipationUseCase } from './confirm-participation.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

const mockAudit = { log: jest.fn() } as any;
const mockMatchNotification = {
  onInvited: jest.fn().mockResolvedValue(undefined),
  onPromoted: jest.fn().mockResolvedValue(undefined),
  onReconfirmRequired: jest.fn().mockResolvedValue(undefined),
  onCanceled: jest.fn().mockResolvedValue(undefined),
} as any;

const now = new Date();
// Must be > 60 min in the future so update-match doesn't throw MATCH_EDIT_FROZEN
const futureStartsAt = new Date(now.getTime() + 90 * 60 * 1000);

const baseMockMatch = {
  id: 'match-1',
  title: 'Futbol 5',
  startsAt: futureStartsAt,
  location: 'Cancha Norte',
  capacity: 10,
  status: 'scheduled',
  revision: 1,
  isLocked: false,
  lockedAt: null,
  lockedBy: null,
  createdById: 'admin-1',
  createdAt: now,
  updatedAt: now,
};


function buildTxPrisma(matchOverrides: Record<string, unknown> = {}) {
  const match = { ...baseMockMatch, ...matchOverrides };
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn().mockResolvedValue(match),
      findUniqueOrThrow: jest.fn().mockResolvedValue(match),
      update: jest
        .fn()
        .mockResolvedValue({ ...match, revision: match.revision + 1 }),
    },
    matchParticipant: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'p-1' }),
      update: jest.fn().mockResolvedValue({ id: 'p-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { waitlistPosition: null } }),
    },
  };

  const prisma = {
    client: {
      ...tx,
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        delete: jest.fn(),
      },
    },
  } as unknown as PrismaService;

  return { prisma, tx };
}

// ---------- UpdateMatchUseCase ----------

describe('UpdateMatchUseCase', () => {
  it('rejects wrong expectedRevision -> 409', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        expectedRevision: 99,
        title: 'New Title',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects non-admin -> 403', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'not-admin',
        expectedRevision: 1,
        title: 'New Title',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('major change (startsAt) resets CONFIRMED -> INVITED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2);
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      startsAt: '2026-12-01T20:00:00Z',
    });

    expect(tx.matchParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match-1',
        status: 'CONFIRMED',
        userId: { not: 'admin-1' },
      },
      data: { status: 'INVITED', confirmedAt: null },
    });
  });

  it('major change (location) resets CONFIRMED -> INVITED', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      location: 'Cancha Sur',
    });

    expect(tx.matchParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match-1',
        status: 'CONFIRMED',
        userId: { not: 'admin-1' },
      },
      data: { status: 'INVITED', confirmedAt: null },
    });
  });

  it('capacity reduction triggers reconfirmation (is a major change)', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      capacity: 8, // 8 < 10 → decreased
    });

    // Capacity decrease is a major change → CONFIRMED → INVITED
    expect(tx.matchParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match-1',
        status: 'CONFIRMED',
        userId: { not: 'admin-1' },
      },
      data: { status: 'INVITED', confirmedAt: null },
    });
  });

  it('capacity increase does NOT trigger reconfirmation', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      capacity: 12, // 12 > 10 → increased, not a major change
    });

    expect(tx.matchParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('capacity unchanged does NOT trigger reconfirmation', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      capacity: 10, // same as current → no change
    });

    // No actual change → early return, nothing updated
    expect(tx.matchParticipant.updateMany).not.toHaveBeenCalled();
    expect(tx.match.update).not.toHaveBeenCalled();
  });

  it('title-only change does NOT reset participants', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      title: 'New Title',
    });

    expect(tx.matchParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('same startsAt value does NOT trigger reconfirmation', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      startsAt: futureStartsAt.toISOString(),
    });

    // No actual change → no update at all (early return)
    expect(tx.matchParticipant.updateMany).not.toHaveBeenCalled();
    expect(tx.match.update).not.toHaveBeenCalled();
  });

  it('same location value does NOT trigger reconfirmation', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      location: 'Cancha Norte',
    });

    expect(tx.matchParticipant.updateMany).not.toHaveBeenCalled();
    expect(tx.match.update).not.toHaveBeenCalled();
  });

  it('rejects update on locked match -> 409 MATCH_LOCKED', async () => {
    const { prisma } = buildTxPrisma({ isLocked: true });
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        expectedRevision: 1,
        title: 'New Title',
      }),
    ).rejects.toThrow('MATCH_LOCKED');
  });

  it('capacity reduction + major change → reconfirmation (no overflow)', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    // Both startsAt (major) and capacity change → major change reconfirmation wins
    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      capacity: 3,
      startsAt: '2026-12-01T20:00:00Z',
    });

    // Reconfirmation via updateMany (major change)
    expect(tx.matchParticipant.updateMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match-1',
        status: 'CONFIRMED',
        userId: { not: 'admin-1' },
      },
      data: { status: 'INVITED', confirmedAt: null },
    });
    // No overflow-specific participant.update calls (major change already handled it)
    expect(tx.matchParticipant.update).not.toHaveBeenCalled();
  });

  it('increments revision on real update', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      title: 'Updated',
    });

    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revision: 2 }),
      }),
    );
  });
});

// ---------- LockMatchUseCase ----------

describe('LockMatchUseCase', () => {
  it('locks match and increments revision', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new LockMatchUseCase(prisma, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
    });

    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isLocked: true,
          revision: 2,
        }),
      }),
    );
  });

  it('already locked -> idempotent (no update)', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true });
    const useCase = new LockMatchUseCase(prisma, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
    });

    expect(tx.match.update).not.toHaveBeenCalled();
  });

  it('rejects wrong expectedRevision -> 409', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new LockMatchUseCase(prisma, mockAudit);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        expectedRevision: 99,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects non-admin -> 403', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new LockMatchUseCase(prisma, mockAudit);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'not-admin',
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ---------- UnlockMatchUseCase ----------

describe('UnlockMatchUseCase', () => {
  it('unlocks match and increments revision', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true });
    const useCase = new UnlockMatchUseCase(prisma, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
    });

    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isLocked: false,
          revision: 2,
        }),
      }),
    );
  });

  it('already unlocked -> idempotent (no update)', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: false });
    const useCase = new UnlockMatchUseCase(prisma, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
    });

    expect(tx.match.update).not.toHaveBeenCalled();
  });
});

// ---------- Lock + confirm ----------

function buildIdempotency(prisma: PrismaService) {
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
  return new IdempotencyService(prisma, config);
}

describe('Confirm on locked match', () => {
  it('actor with no participation row -> 409 MATCH_LOCKED', async () => {
    // findUnique returns null (no row) → blocked
    const { prisma } = buildTxPrisma({ isLocked: true });
    const useCase = new ConfirmParticipationUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-lock-null',
      }),
    ).rejects.toThrow('MATCH_LOCKED');
  });

  it('actor SPECTATOR on locked match -> 409 MATCH_LOCKED', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true });
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', status: 'SPECTATOR' });
    const useCase = new ConfirmParticipationUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-lock-dec',
      }),
    ).rejects.toThrow('MATCH_LOCKED');
  });

  it('actor SPECTATOR on locked match -> 409 MATCH_LOCKED', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true });
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', status: 'SPECTATOR' });
    const useCase = new ConfirmParticipationUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-lock-spec',
      }),
    ).rejects.toThrow('MATCH_LOCKED');
  });

  it('actor INVITED on locked match -> confirm succeeds (CONFIRMED)', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true });
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', status: 'INVITED' });
    // capacity not full (count = 0, capacity = 10)
    tx.matchParticipant.count = jest.fn().mockResolvedValue(0);
    const useCase = new ConfirmParticipationUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-lock-inv',
    });

    // Participant updated to CONFIRMED
    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
    // Revision incremented
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revision: 2 }),
      }),
    );
  });

  it('actor INVITED on locked match, capacity full -> confirm succeeds (WAITLISTED)', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true, capacity: 1 });
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', status: 'INVITED' });
    // capacity full
    tx.matchParticipant.count = jest.fn().mockResolvedValue(1);
    const useCase = new ConfirmParticipationUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-lock-inv-wl',
    });

    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'WAITLISTED' }),
      }),
    );
  });
});
