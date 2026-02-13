import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpdateMatchUseCase } from './update-match.use-case';
import { LockMatchUseCase } from './lock-match.use-case';
import { UnlockMatchUseCase } from './unlock-match.use-case';
import { ConfirmParticipationUseCase } from './confirm-participation.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

const now = new Date();

const baseMockMatch = {
  id: 'match-1',
  title: 'Futbol 5',
  startsAt: now,
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
    const useCase = new UpdateMatchUseCase(prisma);

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
    const useCase = new UpdateMatchUseCase(prisma);

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
    const useCase = new UpdateMatchUseCase(prisma);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      startsAt: '2026-12-01T20:00:00Z',
    });

    expect(tx.matchParticipant.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', status: 'CONFIRMED' },
      data: { status: 'INVITED', confirmedAt: null },
    });
  });

  it('major change (location) resets CONFIRMED -> INVITED', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(prisma);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      location: 'Cancha Sur',
    });

    expect(tx.matchParticipant.updateMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1', status: 'CONFIRMED' },
      data: { status: 'INVITED', confirmedAt: null },
    });
  });

  it('capacity below confirmedCount -> 409', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.count = jest.fn().mockResolvedValue(5);
    const useCase = new UpdateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        expectedRevision: 1,
        capacity: 3,
      }),
    ).rejects.toThrow('CAPACITY_BELOW_CONFIRMED');
  });

  it('title-only change does NOT reset participants', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(prisma);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      title: 'New Title',
    });

    expect(tx.matchParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('increments revision on real update', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new UpdateMatchUseCase(prisma);

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
    const useCase = new LockMatchUseCase(prisma);

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
    const useCase = new LockMatchUseCase(prisma);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
    });

    expect(tx.match.update).not.toHaveBeenCalled();
  });

  it('rejects wrong expectedRevision -> 409', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new LockMatchUseCase(prisma);

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
    const useCase = new LockMatchUseCase(prisma);

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
    const useCase = new UnlockMatchUseCase(prisma);

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
    const useCase = new UnlockMatchUseCase(prisma);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
    });

    expect(tx.match.update).not.toHaveBeenCalled();
  });
});

// ---------- Lock blocks confirm ----------

describe('Confirm blocked by lock', () => {
  it('confirm on locked match -> 409 MATCH_LOCKED', async () => {
    const { prisma } = buildTxPrisma({ isLocked: true });
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const idempotency = new IdempotencyService(prisma, config);
    const useCase = new ConfirmParticipationUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-lock-1',
      }),
    ).rejects.toThrow('MATCH_LOCKED');
  });
});
