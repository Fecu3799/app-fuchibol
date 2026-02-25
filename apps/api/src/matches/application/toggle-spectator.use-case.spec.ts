import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ToggleSpectatorUseCase } from './toggle-spectator.use-case';
import { LeaveMatchUseCase } from './leave-match.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockAudit = { log: jest.fn() } as any;
import {
  IdempotencyService,
  computeRequestHash,
} from '../../common/idempotency/idempotency.service';

const mockMatch = {
  id: 'match-1',
  title: 'Test',
  startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h from now
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
      create: jest.fn().mockResolvedValue({ id: 'p-new' }),
      update: jest.fn().mockResolvedValue({ id: 'p-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'p-1' }),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { waitlistPosition: null } }),
    },
    user: {
      update: jest.fn().mockResolvedValue({ id: 'user-1', lateLeaveCount: 1 }),
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

describe('ToggleSpectatorUseCase', () => {
  it('no participation → creates SPECTATOR row', async () => {
    const { prisma, tx } = buildTxPrisma();
    // No existing participation
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue(null);
    const idempotency = buildIdempotency(prisma);
    const useCase = new ToggleSpectatorUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-sp1',
    });

    expect(tx.matchParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SPECTATOR' }),
      }),
    );
  });

  it('SPECTATOR → switches to INVITED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'SPECTATOR',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new ToggleSpectatorUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-sp2',
    });

    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'INVITED' }),
      }),
    );
  });

  it('CONFIRMED → SPECTATOR + promotes first WAITLISTED', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'CONFIRMED',
      waitlistPosition: null,
    });
    const waitlisted = { id: 'p-2', status: 'WAITLISTED', waitlistPosition: 1 };
    tx.matchParticipant.findFirst = jest.fn().mockResolvedValue(waitlisted);
    const idempotency = buildIdempotency(prisma);
    const useCase = new ToggleSpectatorUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-sp3',
    });

    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'SPECTATOR' }),
      }),
    );
    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-2' },
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
  });

  it('INVITED → SPECTATOR', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'INVITED',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new ToggleSpectatorUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-sp4',
    });

    expect(tx.matchParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: expect.objectContaining({ status: 'SPECTATOR' }),
      }),
    );
  });

  it('rejects wrong revision → 409', async () => {
    const { prisma } = buildTxPrisma();
    const idempotency = buildIdempotency(prisma);
    const useCase = new ToggleSpectatorUseCase(prisma, idempotency, mockAudit);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 99,
        idempotencyKey: 'key-sp5',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects canceled match → 409', async () => {
    const { prisma, tx } = buildTxPrisma();
    tx.match.findUnique = jest
      .fn()
      .mockResolvedValue({ ...mockMatch, status: 'canceled' });
    const idempotency = buildIdempotency(prisma);
    const useCase = new ToggleSpectatorUseCase(prisma, idempotency, mockAudit);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'user-1',
        expectedRevision: 1,
        idempotencyKey: 'key-sp6',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('LeaveMatchUseCase — creator without participation row', () => {
  it('creator (no row) with admin candidate → transfers creator, increments revision', async () => {
    const { prisma, tx } = buildTxPrisma();
    // Creator has no participation row
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue(null);
    // Another participant is an admin
    const adminCandidate = {
      id: 'p-admin',
      userId: 'admin-2',
      status: 'CONFIRMED',
      isMatchAdmin: true,
      adminGrantedAt: new Date(),
    };
    tx.matchParticipant.findFirst = jest.fn().mockResolvedValue(adminCandidate);
    const idempotency = buildIdempotency(prisma);
    const useCase = new LeaveMatchUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'admin-1', // creator
      expectedRevision: 1,
      idempotencyKey: 'key-cr1',
    });

    // Should transfer createdById to the admin candidate
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: 'admin-2' }),
      }),
    );
    // Should increment revision even without an existing row
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revision: 2 }),
      }),
    );
    // Should NOT delete any participant row
    expect(tx.matchParticipant.delete).not.toHaveBeenCalled();
  });

  it('creator (no row) with no admin candidate → throws CREATOR_TRANSFER_REQUIRED', async () => {
    const { prisma, tx } = buildTxPrisma();
    // Creator has no participation row
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue(null);
    // No other admin
    tx.matchParticipant.findFirst = jest.fn().mockResolvedValue(null);
    const idempotency = buildIdempotency(prisma);
    const useCase = new LeaveMatchUseCase(prisma, idempotency, mockAudit);

    await expect(
      useCase.execute({
        matchId: 'match-1',
        actorId: 'admin-1', // creator
        expectedRevision: 1,
        idempotencyKey: 'key-cr2',
      }),
    ).rejects.toThrow('CREATOR_TRANSFER_REQUIRED');
  });
});

describe('LeaveMatchUseCase — late-leave penalty', () => {
  it('leave within 1h of match start → increments lateLeaveCount', async () => {
    const { prisma, tx } = buildTxPrisma();
    // Match starts in 30 minutes (late leave)
    tx.match.findUnique = jest.fn().mockResolvedValue({
      ...mockMatch,
      startsAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'CONFIRMED',
      matchId: 'match-1',
      userId: 'user-1',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new LeaveMatchUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-lm1',
    });

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ lateLeaveCount: { increment: 1 } }),
      }),
    );
    expect(tx.matchParticipant.delete).toHaveBeenCalled();
  });

  it('leave more than 1h before match → no late-leave penalty', async () => {
    const { prisma, tx } = buildTxPrisma();
    // Match starts in 2 hours (no late leave)
    tx.match.findUnique = jest.fn().mockResolvedValue({
      ...mockMatch,
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'CONFIRMED',
      matchId: 'match-1',
      userId: 'user-1',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new LeaveMatchUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-lm2',
    });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.matchParticipant.delete).toHaveBeenCalled();
  });

  it('leave after match start → no late-leave penalty (match already started)', async () => {
    const { prisma, tx } = buildTxPrisma();
    // Match started 10 minutes ago (past)
    tx.match.findUnique = jest.fn().mockResolvedValue({
      ...mockMatch,
      startsAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    tx.matchParticipant.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      status: 'CONFIRMED',
      matchId: 'match-1',
      userId: 'user-1',
    });
    const idempotency = buildIdempotency(prisma);
    const useCase = new LeaveMatchUseCase(prisma, idempotency, mockAudit);

    await useCase.execute({
      matchId: 'match-1',
      actorId: 'user-1',
      expectedRevision: 1,
      idempotencyKey: 'key-lm3',
    });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.matchParticipant.delete).toHaveBeenCalled();
  });
});
