import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmParticipationUseCase } from './confirm-participation.use-case';
import { WithdrawParticipationUseCase } from './withdraw-participation.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  IdempotencyService,
  computeRequestHash,
} from '../../common/idempotency/idempotency.service';

const mockMatch = {
  id: 'match-1',
  title: 'Test',
  startsAt: new Date(),
  location: null,
  capacity: 2,
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
      update: jest.fn().mockResolvedValue({ ...mockMatch, revision: 2 }),
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

describe('ConfirmParticipationUseCase', () => {
  it('confirms with capacity -> CONFIRMED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.count = jest.fn().mockResolvedValue(0);
    const idempotency = buildIdempotency(prisma);
    const useCase = new ConfirmParticipationUseCase(prisma, idempotency);

    const result = await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-1',
    });

    expect(tx.matchParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
    expect(result.confirmedCount).toBeDefined();
  });

  it('confirms when full -> WAITLISTED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.count = jest.fn().mockResolvedValue(2); // capacity=2, full
    const idempotency = buildIdempotency(prisma);
    const useCase = new ConfirmParticipationUseCase(prisma, idempotency);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-2',
    });

    expect(tx.matchParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'WAITLISTED' }),
      }),
    );
  });

  it('rejects wrong expectedRevision -> 409', async () => {
    const { prisma } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new ConfirmParticipationUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 99,
        idempotencyKey: 'key-3',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('idempotent: same key returns cached response', async () => {
    const { prisma, tx } = buildTxPrisma();
    const cachedResponse = { id: 'match-1', confirmedCount: 1 };
    prisma.client.idempotencyRecord.findUnique = jest.fn().mockResolvedValue({
      responseJson: cachedResponse,
      requestHash: computeRequestHash({
        matchId: 'match-1',
        expectedRevision: 1,
      }),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new ConfirmParticipationUseCase(prisma, idempotency);

    const result = await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-cached',
    });

    expect(result).toEqual(cachedResponse);
    expect(tx.match.findUnique).not.toHaveBeenCalled();
  });
});

describe('WithdrawParticipationUseCase', () => {
  it('withdraw CONFIRMED promotes first WAITLISTED', async () => {
    const { prisma, tx } = buildTxPrisma();
    const existingConfirmed = {
      id: 'p-1',
      matchId: 'match-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      waitlistPosition: null,
    };
    const waitlisted = {
      id: 'p-2',
      matchId: 'match-1',
      userId: 'user-2',
      status: 'WAITLISTED',
      waitlistPosition: 1,
    };
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue(existingConfirmed);
    tx.matchParticipant.findFirst = jest.fn().mockResolvedValue(waitlisted);
    // After withdraw, return updated participants for snapshot
    tx.matchParticipant.findMany = jest.fn().mockResolvedValue([
      {
        ...existingConfirmed,
        status: 'WITHDRAWN',
        user: { username: 'user1' },
      },
      {
        ...waitlisted,
        status: 'CONFIRMED',
        waitlistPosition: null,
        user: { username: 'user2' },
      },
    ]);

    const idempotency = buildIdempotency(prisma);
    const useCase = new WithdrawParticipationUseCase(prisma, idempotency);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-w1',
    });

    // Verify the confirmed user was withdrawn
    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'WITHDRAWN' }),
      }),
    );

    // Verify waitlisted user was promoted
    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-2' },
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
  });
});
