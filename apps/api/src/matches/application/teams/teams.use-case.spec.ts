import {
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SaveTeamsUseCase } from './save-teams.use-case';
import { GenerateRandomTeamsUseCase } from './generate-random-teams.use-case';
import { GenerateBalancedTeamsUseCase } from './generate-balanced-teams.use-case';
import { MoveTeamPlayerUseCase } from './move-team-player.use-case';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { MatchAuditService } from '../audit/match-audit.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    title: 'Futbol 5',
    startsAt: new Date('2026-06-01T18:00:00Z'),
    capacity: 10,
    status: 'scheduled',
    revision: 1,
    isLocked: false,
    lockedAt: null,
    lockedBy: null,
    createdById: 'creator-1',
    teamsConfigured: false,
    ...overrides,
  };
}

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    revision: 2,
    teamsConfigured: true,
    teams: { teamA: [], teamB: [] },
    ...overrides,
  } as any;
}

function makeParticipant(
  userId: string,
  status = 'CONFIRMED',
  skillLevel: string | null = null,
) {
  return {
    id: `p-${userId}`,
    matchId: 'match-1',
    userId,
    status,
    user: { skillLevel },
  };
}

function buildPrisma(
  match: ReturnType<typeof makeMatch>,
  participants: ReturnType<typeof makeParticipant>[] = [],
  extraMocks: Record<string, unknown> = {},
) {
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(match),
      update: jest
        .fn()
        .mockResolvedValue({ ...match, revision: match.revision + 1 }),
    },
    matchParticipant: {
      findMany: jest.fn().mockResolvedValue(participants),
      count: jest
        .fn()
        .mockResolvedValue(
          participants.filter((p) => p.status === 'CONFIRMED').length,
        ),
    },
    matchTeamSlot: {
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    matchAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    ...extraMocks,
  };

  const prisma = {
    client: {
      $transaction: jest
        .fn()
        .mockImplementation(async (fn: (tx: any) => unknown) => fn(tx)),
      match: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ ...match, teamsConfigured: true }),
      },
      matchParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      matchTeamSlot: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  } as unknown as PrismaService;

  // Expose tx for assertions
  (prisma as any)._tx = tx;

  return prisma;
}

function buildAudit(): MatchAuditService {
  return {
    log: jest.fn().mockResolvedValue(undefined),
  } as unknown as MatchAuditService;
}

// ---------------------------------------------------------------------------
// SaveTeamsUseCase
// ---------------------------------------------------------------------------

describe('SaveTeamsUseCase', () => {
  const baseInput = {
    matchId: 'match-1',
    actorId: 'creator-1',
    expectedRevision: 1,
    teamA: ['u1', 'u2', 'u3', 'u4', 'u5'],
    teamB: ['u6', 'u7', 'u8', 'u9', 'u10'],
  };

  it('saves teams and sets teamsConfigured=true', async () => {
    const participants = Array.from({ length: 10 }, (_, i) =>
      makeParticipant(`u${i + 1}`),
    );
    const prisma = buildPrisma(makeMatch(), participants);
    const audit = buildAudit();
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, audit);

    await useCase.execute(baseInput);

    const tx = (prisma as any)._tx;
    expect(tx.matchTeamSlot.deleteMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1' },
    });
    expect(tx.matchTeamSlot.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ team: 'A', slotIndex: 0, userId: 'u1' }),
        expect.objectContaining({ team: 'B', slotIndex: 0, userId: 'u6' }),
      ]),
    });
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamsConfigured: true, revision: 2 }),
      }),
    );
  });

  it('throws FORBIDDEN if actor is not creator', async () => {
    const prisma = buildPrisma(makeMatch({ createdById: 'other-user' }));
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws REVISION_CONFLICT if revision mismatch', async () => {
    const prisma = buildPrisma(makeMatch({ revision: 99 }));
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws MATCH_CANCELLED if match is canceled', async () => {
    const prisma = buildPrisma(makeMatch({ status: 'canceled' }));
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws INVALID_TEAM_SIZE if teamA length does not match capacity/2', async () => {
    const prisma = buildPrisma(makeMatch()); // capacity=10 → slotsPerTeam=5
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());
    await expect(
      useCase.execute({ ...baseInput, teamA: ['u1', 'u2'] }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws DUPLICATE_PLAYER_IN_TEAMS if same userId appears in both teams', async () => {
    const participants = Array.from({ length: 9 }, (_, i) =>
      makeParticipant(`u${i + 1}`),
    );
    const prisma = buildPrisma(makeMatch(), participants);
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());
    await expect(
      useCase.execute({
        ...baseInput,
        teamA: ['u1', 'u1', 'u3', 'u4', 'u5'], // u1 duplicated
        teamB: ['u6', 'u7', 'u8', 'u9', 'u10'],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws PLAYER_NOT_CONFIRMED if userId is not CONFIRMED', async () => {
    // Only 9 confirmed, but we're providing 10 userIds
    const participants = Array.from({ length: 9 }, (_, i) =>
      makeParticipant(`u${i + 1}`),
    );
    const prisma = buildPrisma(makeMatch(), participants);
    const tx = (prisma as any)._tx;
    tx.matchParticipant.count = jest.fn().mockResolvedValue(9); // one short
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('allows null slots (empty slots)', async () => {
    const participants = [makeParticipant('u1')];
    const prisma = buildPrisma(makeMatch(), participants);
    const tx = (prisma as any)._tx;
    tx.matchParticipant.count = jest.fn().mockResolvedValue(1);
    const useCase = new SaveTeamsUseCase(prisma, mockSnapshot, buildAudit());

    await expect(
      useCase.execute({
        ...baseInput,
        teamA: ['u1', null, null, null, null],
        teamB: [null, null, null, null, null],
      }),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GenerateRandomTeamsUseCase
// ---------------------------------------------------------------------------

describe('GenerateRandomTeamsUseCase', () => {
  const baseInput = {
    matchId: 'match-1',
    actorId: 'creator-1',
    expectedRevision: 1,
  };

  it('generates slots for all confirmed players', async () => {
    const participants = Array.from({ length: 10 }, (_, i) =>
      makeParticipant(`u${i + 1}`),
    );
    const prisma = buildPrisma(makeMatch(), participants);
    const useCase = new GenerateRandomTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );

    await useCase.execute(baseInput);

    const tx = (prisma as any)._tx;
    expect(tx.matchTeamSlot.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ team: 'A' }),
          expect.objectContaining({ team: 'B' }),
        ]),
      }),
    );
    const callData = tx.matchTeamSlot.createMany.mock.calls[0][0].data as any[];
    // 5 slots for A and 5 for B
    expect(callData.filter((s: any) => s.team === 'A')).toHaveLength(5);
    expect(callData.filter((s: any) => s.team === 'B')).toHaveLength(5);
  });

  it('throws FORBIDDEN if actor is not creator', async () => {
    const prisma = buildPrisma(makeMatch({ createdById: 'other' }));
    const useCase = new GenerateRandomTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws REVISION_CONFLICT on mismatch', async () => {
    const prisma = buildPrisma(makeMatch({ revision: 5 }));
    const useCase = new GenerateRandomTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NO_CONFIRMED_PLAYERS when no confirmed participants', async () => {
    const prisma = buildPrisma(makeMatch(), []); // empty
    const useCase = new GenerateRandomTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('all slot userIds come from confirmed participants', async () => {
    const participants = Array.from({ length: 6 }, (_, i) =>
      makeParticipant(`u${i + 1}`),
    );
    const prisma = buildPrisma(makeMatch({ capacity: 6 }), participants);
    const useCase = new GenerateRandomTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );

    await useCase.execute(baseInput);

    const tx = (prisma as any)._tx;
    const callData = tx.matchTeamSlot.createMany.mock.calls[0][0].data as any[];
    const filledIds = callData.map((s: any) => s.userId).filter(Boolean);
    const validIds = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
    filledIds.forEach((id: string) => expect(validIds.has(id)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// GenerateBalancedTeamsUseCase
// ---------------------------------------------------------------------------

describe('GenerateBalancedTeamsUseCase', () => {
  const baseInput = {
    matchId: 'match-1',
    actorId: 'creator-1',
    expectedRevision: 1,
  };

  it('distributes players by skill (higher skill to opposite teams)', async () => {
    const participants = [
      { ...makeParticipant('u-pro'), user: { skillLevel: 'PRO' } },
      { ...makeParticipant('u-semipro'), user: { skillLevel: 'SEMIPRO' } },
      { ...makeParticipant('u-regular'), user: { skillLevel: 'REGULAR' } },
      { ...makeParticipant('u-amateur'), user: { skillLevel: 'AMATEUR' } },
    ];
    const prisma = buildPrisma(makeMatch({ capacity: 4 }), participants as any);
    const tx = (prisma as any)._tx;
    tx.matchParticipant.findMany = jest.fn().mockResolvedValue(participants);

    const useCase = new GenerateBalancedTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await useCase.execute(baseInput);

    const callData = tx.matchTeamSlot.createMany.mock.calls[0][0].data as any[];
    const teamA = callData
      .filter((s: any) => s.team === 'A')
      .map((s: any) => s.userId);
    const teamB = callData
      .filter((s: any) => s.team === 'B')
      .map((s: any) => s.userId);

    // PRO (index 0) → A, SEMIPRO (index 1) → B, REGULAR (index 2) → B, AMATEUR (index 3) → A
    expect(teamA).toContain('u-pro');
    expect(teamA).toContain('u-amateur');
    expect(teamB).toContain('u-semipro');
    expect(teamB).toContain('u-regular');
  });

  it('throws NO_CONFIRMED_PLAYERS when empty', async () => {
    const prisma = buildPrisma(makeMatch(), []);
    const useCase = new GenerateBalancedTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws FORBIDDEN if not creator', async () => {
    const prisma = buildPrisma(makeMatch({ createdById: 'other' }));
    const useCase = new GenerateBalancedTeamsUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

// ---------------------------------------------------------------------------
// MoveTeamPlayerUseCase
// ---------------------------------------------------------------------------

describe('MoveTeamPlayerUseCase', () => {
  const baseInput = {
    matchId: 'match-1',
    actorId: 'creator-1',
    expectedRevision: 1,
    fromTeam: 'A',
    fromSlotIndex: 0,
    toTeam: 'B',
    toSlotIndex: 0,
  };

  function buildPrismaForMove(
    match: ReturnType<typeof makeMatch>,
    fromSlot: { userId: string | null },
    toSlot: { userId: string | null },
  ) {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      match: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(match),
        update: jest
          .fn()
          .mockResolvedValue({ ...match, revision: match.revision + 1 }),
      },
      matchTeamSlot: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            matchId: 'match-1',
            team: 'A',
            slotIndex: 0,
            userId: fromSlot.userId,
          })
          .mockResolvedValueOnce({
            matchId: 'match-1',
            team: 'B',
            slotIndex: 0,
            userId: toSlot.userId,
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      matchAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      client: {
        $transaction: jest
          .fn()
          .mockImplementation(async (fn: (tx: any) => unknown) => fn(tx)),
        match: {
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ ...match, teamsConfigured: true }),
        },
        matchParticipant: { findMany: jest.fn().mockResolvedValue([]) },
        matchTeamSlot: { findMany: jest.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    (prisma as any)._tx = tx;
    return prisma;
  }

  it('swaps userIds between two slots', async () => {
    const match = makeMatch({ teamsConfigured: true });
    const prisma = buildPrismaForMove(
      match,
      { userId: 'u1' },
      { userId: 'u2' },
    );
    const useCase = new MoveTeamPlayerUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );

    await useCase.execute(baseInput);

    const tx = (prisma as any)._tx;
    expect(tx.matchTeamSlot.update).toHaveBeenCalledTimes(2);
    // fromSlot gets toSlot's userId
    expect(tx.matchTeamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'u2' } }),
    );
    // toSlot gets fromSlot's userId
    expect(tx.matchTeamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 'u1' } }),
    );
  });

  it('works when one slot is empty (null userId)', async () => {
    const match = makeMatch({ teamsConfigured: true });
    const prisma = buildPrismaForMove(
      match,
      { userId: 'u1' },
      { userId: null },
    );
    const useCase = new MoveTeamPlayerUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );

    await useCase.execute(baseInput);

    const tx = (prisma as any)._tx;
    expect(tx.matchTeamSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: null } }),
    );
  });

  it('throws TEAMS_NOT_CONFIGURED if teamsConfigured=false', async () => {
    const match = makeMatch({ teamsConfigured: false });
    const prisma = buildPrismaForMove(
      match,
      { userId: 'u1' },
      { userId: 'u2' },
    );
    const useCase = new MoveTeamPlayerUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws FORBIDDEN if not creator', async () => {
    const match = makeMatch({ createdById: 'other', teamsConfigured: true });
    const prisma = buildPrismaForMove(
      match,
      { userId: 'u1' },
      { userId: 'u2' },
    );
    const useCase = new MoveTeamPlayerUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws REVISION_CONFLICT on mismatch', async () => {
    const match = makeMatch({ revision: 99, teamsConfigured: true });
    const prisma = buildPrismaForMove(
      match,
      { userId: 'u1' },
      { userId: 'u2' },
    );
    const useCase = new MoveTeamPlayerUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );
    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('increments revision after move', async () => {
    const match = makeMatch({ teamsConfigured: true });
    const prisma = buildPrismaForMove(
      match,
      { userId: 'u1' },
      { userId: 'u2' },
    );
    const useCase = new MoveTeamPlayerUseCase(
      prisma,
      mockSnapshot,
      buildAudit(),
    );

    await useCase.execute(baseInput);

    const tx = (prisma as any)._tx;
    expect(tx.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revision: 2 }),
      }),
    );
  });
});
