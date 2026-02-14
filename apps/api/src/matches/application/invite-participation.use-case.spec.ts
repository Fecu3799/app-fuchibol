/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InviteParticipationUseCase } from './invite-participation.use-case';
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
      update: jest.fn().mockResolvedValue({ ...mockMatch, revision: 2 }),
    },
    matchParticipant: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'p-1' }),
    },
  };

  const prisma = {
    client: {
      ...tx,
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      user: {
        findFirst: jest.fn(),
      },
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

describe('InviteParticipationUseCase', () => {
  it('invite by userId works (backward compat)', async () => {
    const { prisma, tx } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      targetUserId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-1',
    });

    expect(tx.matchParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', status: 'INVITED' }),
      }),
    );
  });

  it('invite by username resolves user and invites', async () => {
    const { prisma, tx } = buildTxPrisma();
    (prisma.client.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-2',
      username: 'johndoe',
      email: 'john@test.com',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      identifier: 'johndoe',
      expectedRevision: 1,
      idempotencyKey: 'key-2',
    });

    expect(prisma.client.user.findFirst).toHaveBeenCalledWith({
      where: { username: 'johndoe' },
    });
    expect(tx.matchParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-2' }),
      }),
    );
  });

  it('invite by @username strips @ prefix', async () => {
    const { prisma } = buildTxPrisma();
    (prisma.client.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-3',
      username: 'janedoe',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      identifier: '@janedoe',
      expectedRevision: 1,
      idempotencyKey: 'key-3',
    });

    expect(prisma.client.user.findFirst).toHaveBeenCalledWith({
      where: { username: 'janedoe' },
    });
  });

  it('invite by email resolves user', async () => {
    const { prisma } = buildTxPrisma();
    (prisma.client.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-4',
      email: 'mike@test.com',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      identifier: 'mike@test.com',
      expectedRevision: 1,
      idempotencyKey: 'key-4',
    });

    expect(prisma.client.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'mike@test.com' },
    });
  });

  it('throws 404 USER_NOT_FOUND for unknown identifier', async () => {
    const { prisma } = buildTxPrisma();
    (prisma.client.user.findFirst as jest.Mock).mockResolvedValue(null);
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        identifier: 'nobody',
        expectedRevision: 1,
        idempotencyKey: 'key-5',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 409 SELF_INVITE when inviting self', async () => {
    const { prisma } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        targetUserId: 'admin-1',
        expectedRevision: 1,
        idempotencyKey: 'key-6',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws 409 ALREADY_PARTICIPANT when user is CONFIRMED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'CONFIRMED',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1',
        targetUserId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-7',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('idempotent: re-inviting already INVITED user returns snapshot', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'INVITED',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new InviteParticipationUseCase(prisma, idempotency);

    const result = await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1',
      targetUserId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-8',
    });

    expect(tx.matchParticipant.create).not.toHaveBeenCalled();
    expect(result.id).toBe('match-1');
  });
});
