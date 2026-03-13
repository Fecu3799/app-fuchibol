import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { KickParticipantUseCase } from './kick-participant.use-case';
import type { PrismaService } from '../../../infra/prisma/prisma.service';

const MATCH_ID = 'match-1';
const CREATOR_ID = 'creator-1';
const TARGET_ID = 'target-1';
const WAITLISTED_ID = 'waitlisted-1';

const mockMatch = {
  id: MATCH_ID,
  title: 'Test Match',
  startsAt: new Date(Date.now() + 86400000),
  location: null,
  capacity: 10,
  status: 'scheduled',
  revision: 1,
  isLocked: false,
  lockedAt: null,
  lockedBy: null,
  createdById: CREATOR_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockParticipant = {
  id: 'p-target',
  userId: TARGET_ID,
  matchId: MATCH_ID,
  status: 'INVITED',
  isMatchAdmin: false,
  waitlistPosition: null,
  confirmedAt: null,
  adminGrantedAt: null,
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) } as any;
const mockSnapshot = {
  build: jest.fn().mockResolvedValue({
    id: 'match-1',
    revision: 2,
    title: 'Test',
    confirmedCount: 0,
    participants: [],
    waitlist: [],
    spectators: [],
    spectatorCount: 0,
    myStatus: null,
    actionsAllowed: [],
    teamsConfigured: false,
    teams: null,
    capacity: 10,
    status: 'scheduled',
    matchStatus: 'scheduled',
    matchGender: 'MIXED',
    isLocked: false,
    lockedAt: null,
    lockedBy: null,
    createdById: 'admin-1',
    venueId: null,
    venuePitchId: null,
    venueSnapshot: null,
    pitchSnapshot: null,
    location: null,
    startsAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  buildInTx: jest.fn().mockResolvedValue({
    id: 'match-1',
    revision: 2,
    title: 'Test',
    confirmedCount: 0,
    participants: [],
    waitlist: [],
    spectators: [],
    spectatorCount: 0,
    myStatus: null,
    actionsAllowed: [],
    teamsConfigured: false,
    teams: null,
    capacity: 10,
    status: 'scheduled',
    matchStatus: 'scheduled',
    matchGender: 'MIXED',
    isLocked: false,
    lockedAt: null,
    lockedBy: null,
    createdById: 'admin-1',
    venueId: null,
    venuePitchId: null,
    venueSnapshot: null,
    pitchSnapshot: null,
    location: null,
    startsAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
} as any;
const mockNotification = {
  onMissingPlayersAlert: jest.fn().mockResolvedValue(undefined),
} as any;

function buildTxPrisma(
  overrides: {
    match?: unknown;
    participant?: unknown;
    nextWaitlisted?: unknown;
  } = {},
) {
  const match = overrides.match ?? mockMatch;
  const participant = overrides.participant ?? mockParticipant;
  const nextWaitlisted = overrides.nextWaitlisted ?? null;

  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn().mockResolvedValue(match),
      findUniqueOrThrow: jest.fn().mockResolvedValue(match),
      update: jest.fn().mockResolvedValue({ ...mockMatch, revision: 2 }),
    },
    matchParticipant: {
      findUnique: jest.fn().mockResolvedValue(participant),
      findFirst: jest.fn().mockResolvedValue(nextWaitlisted),
      count: jest.fn().mockResolvedValue(5),
      findMany: jest.fn().mockResolvedValue(
        participant
          ? [
              {
                ...(participant as Record<string, unknown>),
                user: { username: 'target', gender: null },
              },
            ]
          : [],
      ),
      delete: jest.fn().mockResolvedValue(participant),
      update: jest.fn().mockResolvedValue({ id: 'p-waitlisted' }),
    },
  };

  const prisma = {
    client: {
      ...tx,
      matchParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  } as unknown as PrismaService;

  return { prisma, tx };
}

describe('KickParticipantUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creator kicks an INVITED participant — row deleted, revision incremented', async () => {
    const { prisma, tx } = buildTxPrisma();
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await useCase.execute({
      matchId: MATCH_ID,
      actorId: CREATOR_ID,
      targetUserId: TARGET_ID,
      expectedRevision: 1,
    });

    expect(tx.matchParticipant.delete).toHaveBeenCalledWith({
      where: { id: mockParticipant.id },
    });
    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: MATCH_ID },
      data: { revision: 2 },
    });
    expect(mockAudit.log).toHaveBeenCalledWith(
      tx,
      MATCH_ID,
      CREATOR_ID,
      'participant.kicked',
      expect.objectContaining({ targetUserId: TARGET_ID }),
    );
  });

  it('creator kicks a CONFIRMED participant — promotes first WAITLISTED', async () => {
    const confirmedParticipant = { ...mockParticipant, status: 'CONFIRMED' };
    const nextWaitlisted = {
      id: 'p-waitlisted',
      userId: WAITLISTED_ID,
      status: 'WAITLISTED',
      waitlistPosition: 1,
    };
    const { prisma, tx } = buildTxPrisma({
      participant: confirmedParticipant,
      nextWaitlisted,
    });
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await useCase.execute({
      matchId: MATCH_ID,
      actorId: CREATOR_ID,
      targetUserId: TARGET_ID,
      expectedRevision: 1,
    });

    expect(tx.matchParticipant.update).toHaveBeenCalledWith({
      where: { id: nextWaitlisted.id },
      data: {
        status: 'CONFIRMED',
        waitlistPosition: null,
        confirmedAt: expect.any(Date),
      },
    });
  });

  it('throws ForbiddenException ONLY_CREATOR_CAN_KICK if actor is a matchAdmin (not creator)', async () => {
    const { prisma } = buildTxPrisma({
      match: { ...mockMatch, createdById: 'other-user' },
    });
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await expect(
      useCase.execute({
        matchId: MATCH_ID,
        actorId: CREATOR_ID,
        targetUserId: TARGET_ID,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws UnprocessableEntityException CANNOT_KICK_SELF if target is actor', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await expect(
      useCase.execute({
        matchId: MATCH_ID,
        actorId: CREATOR_ID,
        targetUserId: CREATOR_ID,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws NotFoundException NOT_A_PARTICIPANT if target has no row', async () => {
    const { prisma } = buildTxPrisma({ participant: null });
    // findMany also needs to return empty for snapshot
    (prisma.client as any).$transaction = jest.fn(
      (cb: (t: unknown) => Promise<unknown>) => {
        const tx = {
          $queryRawUnsafe: jest.fn().mockResolvedValue([]),
          match: {
            findUnique: jest.fn().mockResolvedValue(mockMatch),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockMatch),
            update: jest.fn(),
          },
          matchParticipant: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            update: jest.fn(),
          },
        };
        return cb(tx);
      },
    );
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await expect(
      useCase.execute({
        matchId: MATCH_ID,
        actorId: CREATOR_ID,
        targetUserId: TARGET_ID,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException MATCH_CANCELLED for canceled match', async () => {
    const { prisma } = buildTxPrisma({
      match: { ...mockMatch, status: 'canceled' },
    });
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await expect(
      useCase.execute({
        matchId: MATCH_ID,
        actorId: CREATOR_ID,
        targetUserId: TARGET_ID,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException REVISION_CONFLICT on revision mismatch', async () => {
    const { prisma } = buildTxPrisma();
    const useCase = new KickParticipantUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockNotification,
    );

    await expect(
      useCase.execute({
        matchId: MATCH_ID,
        actorId: CREATOR_ID,
        targetUserId: TARGET_ID,
        expectedRevision: 99,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
