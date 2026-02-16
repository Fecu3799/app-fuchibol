import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CancelMatchUseCase } from './cancel-match.use-case';
import { ConfirmParticipationUseCase } from './confirm-participation.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

const mockMatch = {
  id: 'match-1',
  title: 'Test',
  startsAt: new Date(),
  location: null,
  capacity: 10,
  status: 'scheduled',
  revision: 1,
  isLocked: false,
  lockedAt: null,
  lockedBy: null,
  createdById: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildTxPrisma() {
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn().mockResolvedValue(mockMatch),
      findUniqueOrThrow: jest.fn().mockResolvedValue(mockMatch),
      update: jest
        .fn()
        .mockResolvedValue({ ...mockMatch, status: 'canceled', revision: 2 }),
    },
    matchParticipant: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'p-1' }),
      update: jest.fn().mockResolvedValue({ id: 'p-1' }),
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

function buildIdempotency(prisma: PrismaService) {
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
  return new IdempotencyService(prisma, config);
}

describe('CancelMatchUseCase', () => {
  it('cancels a match successfully', async () => {
    const { prisma, tx } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new CancelMatchUseCase(prisma, idempotency);

    const result = await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      idempotencyKey: 'key-cancel-1',
    });

    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceled' }),
      }),
    );
    expect(result).toBeDefined();
  });

  it('is idempotent when already canceled', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.match.findUnique = jest
      .fn()
      .mockResolvedValue({ ...mockMatch, status: 'canceled' });
    tx.match.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ ...mockMatch, status: 'canceled' });
    const idempotency = buildIdempotency(prisma);
    const useCase = new CancelMatchUseCase(prisma, idempotency);

    const result = await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      expectedRevision: 1,
      idempotencyKey: 'key-cancel-2',
    });

    expect(tx.match.update).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('throws ForbiddenException for non-admin', async () => {
    const { prisma } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new CancelMatchUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-99',
        expectedRevision: 1,
        idempotencyKey: 'key-cancel-3',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws REVISION_CONFLICT on mismatch', async () => {
    const { prisma } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new CancelMatchUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        expectedRevision: 999,
        idempotencyKey: 'key-cancel-4',
      }),
    ).rejects.toThrow('REVISION_CONFLICT');
  });
});

describe('MATCH_CANCELLED guard', () => {
  it('confirm on canceled match throws MATCH_CANCELLED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.match.findUnique = jest
      .fn()
      .mockResolvedValue({ ...mockMatch, status: 'canceled' });
    const idempotency = buildIdempotency(prisma);
    const useCase = new ConfirmParticipationUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-confirm-cancelled',
      }),
    ).rejects.toThrow('MATCH_CANCELLED');
  });
});
