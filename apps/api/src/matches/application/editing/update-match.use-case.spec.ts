import { UnprocessableEntityException } from '@nestjs/common';
import { UpdateMatchUseCase } from './update-match.use-case';
import { PrismaService } from '../../../infra/prisma/prisma.service';

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
const mockMatchNotification = {
  onReconfirmRequired: jest.fn().mockResolvedValue(undefined),
} as any;

const MOCK_MATCH = {
  id: 'match-1',
  title: 'F5 en Club Test',
  startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
  location: null,
  capacity: 10,
  status: 'scheduled',
  revision: 1,
  isLocked: false,
  lockedAt: null,
  lockedBy: null,
  createdById: 'creator-1',
  venueId: 'venue-1',
  venuePitchId: 'pitch-1',
  venueSnapshot: null,
  pitchSnapshot: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_PITCH = {
  id: 'pitch-2',
  name: 'Cancha B',
  pitchType: 'F7',
  price: 5000,
  isActive: true,
  venueId: 'venue-2',
  venue: {
    id: 'venue-2',
    name: 'Club Sur',
    addressText: 'Av. Sur 456',
    mapsUrl: null,
    latitude: -34.7,
    longitude: -58.5,
    isActive: true,
  },
};

function buildPrisma() {
  const tx = {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    match: {
      findUnique: jest.fn().mockResolvedValue(MOCK_MATCH),
      findUniqueOrThrow: jest.fn().mockResolvedValue(MOCK_MATCH),
      update: jest.fn().mockResolvedValue({ ...MOCK_MATCH, revision: 2 }),
    },
    matchParticipant: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    matchAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  return {
    client: {
      ...tx,
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      venuePitch: {
        findUnique: jest.fn().mockResolvedValue(MOCK_PITCH),
      },
    },
  } as unknown as PrismaService;
}

const BASE_INPUT = {
  matchId: 'match-1',
  actorId: 'creator-1',
  expectedRevision: 1,
};

describe('UpdateMatchUseCase — venue/pitch validation', () => {
  it('throws 422 when venueId provided without venuePitchId', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({ ...BASE_INPUT, venueId: 'venue-2' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.venuePitch.findUnique).not.toHaveBeenCalled();
  });

  it('throws 422 when venuePitchId provided without venueId', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({ ...BASE_INPUT, venuePitchId: 'pitch-2' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.venuePitch.findUnique).not.toHaveBeenCalled();
  });

  it('throws 422 when pitch is not found', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue(null);
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        ...BASE_INPUT,
        venueId: 'venue-2',
        venuePitchId: 'pitch-2',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws 422 when pitch is inactive', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      isActive: false,
    });
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        ...BASE_INPUT,
        venueId: 'venue-2',
        venuePitchId: 'pitch-2',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws 422 when venue is inactive', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      venue: { ...MOCK_PITCH.venue, isActive: false },
    });
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        ...BASE_INPUT,
        venueId: 'venue-2',
        venuePitchId: 'pitch-2',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('throws 422 when pitch does not belong to the provided venue', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      venueId: 'other-venue',
    });
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await expect(
      useCase.execute({
        ...BASE_INPUT,
        venueId: 'venue-2',
        venuePitchId: 'pitch-2',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('updates snapshots in DB when venue/pitch changes', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    // pitch-2 is different from MOCK_MATCH.venuePitchId ('pitch-1') → triggers update
    await useCase.execute({
      ...BASE_INPUT,
      venueId: 'venue-2',
      venuePitchId: 'pitch-2',
    });

    const updateCall = (prisma.client.match.update as jest.Mock).mock
      .calls[0][0];
    expect(updateCall.data.venueId).toBe('venue-2');
    expect(updateCall.data.venuePitchId).toBe('pitch-2');
    expect(updateCall.data.venueSnapshot).toMatchObject({ name: 'Club Sur' });
    expect(updateCall.data.pitchSnapshot).toMatchObject({
      name: 'Cancha B',
      pitchType: 'F7',
    });
  });

  it('does not update snapshots when the same pitch is re-selected', async () => {
    const prisma = buildPrisma();
    // Return a pitch with id matching MOCK_MATCH.venuePitchId so no change is detected
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      id: 'pitch-1',
      venueId: 'venue-1',
      venue: { ...MOCK_PITCH.venue, id: 'venue-1', name: 'Club Test' },
    });
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      ...BASE_INPUT,
      venueId: 'venue-1',
      venuePitchId: 'pitch-1',
    });

    // Nothing changed → early return, match.update not called
    expect(prisma.client.match.update).not.toHaveBeenCalled();
  });

  it('venue change is treated as a major change (reconfirms participants)', async () => {
    const prisma = buildPrisma();
    // Simulate one confirmed participant (not the creator)
    (prisma.client as any).matchParticipant.findMany = jest
      .fn()
      .mockResolvedValueOnce([{ userId: 'user-99' }]) // reconfirm query
      .mockResolvedValue([]); // buildMatchSnapshot query
    const useCase = new UpdateMatchUseCase(
      prisma,
      mockSnapshot,
      mockAudit,
      mockMatchNotification,
    );

    await useCase.execute({
      ...BASE_INPUT,
      venueId: 'venue-2',
      venuePitchId: 'pitch-2',
    });

    expect(
      (prisma.client as any).matchParticipant.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INVITED' }),
      }),
    );
  });
});
