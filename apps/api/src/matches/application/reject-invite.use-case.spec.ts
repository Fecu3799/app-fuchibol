import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RejectInviteUseCase } from './reject-invite.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

const mockAudit = { log: jest.fn() } as any;

const mockMatch = {
  id: 'match-1',
  title: 'Fuchibol',
  startsAt: new Date(Date.now() + 86_400_000), // tomorrow
  location: null,
  capacity: 10,
  status: 'scheduled',
  revision: 1,
  isLocked: false,
  lockedAt: null,
  lockedBy: null,
  createdById: 'creator-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildTxPrisma(matchOverrides: Partial<typeof mockMatch> = {}) {
  const match = { ...mockMatch, ...matchOverrides };
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
      findUnique: jest.fn().mockResolvedValue({ id: 'p-1', status: 'INVITED' }),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ id: 'p-1' }),
    },
    matchAuditLog: {
      create: jest.fn().mockResolvedValue({}),
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

describe('RejectInviteUseCase', () => {
  it('deletes the INVITED row and increments revision', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new RejectInviteUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      idempotencyKey: 'idem-1',
    });

    expect(tx.matchParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'p-1' },
    });
    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { revision: 2 },
    });
  });

  it('throws 404 when match not found', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.match.findUnique = jest.fn().mockResolvedValue(null);
    const useCase = new RejectInviteUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        idempotencyKey: 'idem-2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 409 MATCH_CANCELLED when match is canceled', async () => {
    const { prisma } = buildTxPrisma({ status: 'canceled' });
    const useCase = new RejectInviteUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        idempotencyKey: 'idem-3',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws 422 NOT_INVITED when actor has no INVITED row', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue(null);
    const useCase = new RejectInviteUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        idempotencyKey: 'idem-4',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws 422 NOT_INVITED when actor is CONFIRMED (not INVITED)', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', status: 'CONFIRMED' });
    const useCase = new RejectInviteUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        idempotencyKey: 'idem-5',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('succeeds on a locked match (lock does not block reject)', async () => {
    const { prisma, tx } = buildTxPrisma({ isLocked: true });
    tx.matchParticipant.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'p-1', status: 'INVITED' });
    const useCase = new RejectInviteUseCase(
      prisma,
      buildIdempotency(prisma),
      mockAudit,
    );

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      idempotencyKey: 'idem-6',
    });

    expect(tx.matchParticipant.delete).toHaveBeenCalledWith({
      where: { id: 'p-1' },
    });
  });
});
