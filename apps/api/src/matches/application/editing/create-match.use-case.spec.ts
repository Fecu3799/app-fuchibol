import { UnprocessableEntityException } from '@nestjs/common';
import { CreateMatchUseCase } from './create-match.use-case';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const buildPrisma = () => {
  const prisma = {
    client: {
      match: {
        create: jest.fn().mockResolvedValue({
          id: 'match-default',
          revision: 1,
          status: 'scheduled',
        }),
      },
      conversation: { create: jest.fn().mockResolvedValue({}) },
      venuePitch: { findUnique: jest.fn() },
    },
  } as unknown as PrismaService;
  (prisma.client as unknown as Record<string, unknown>)['$transaction'] = jest.fn(
    (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        match: prisma.client.match,
        conversation: prisma.client.conversation,
      }),
  );
  return prisma;
};

const FUTURE_STARTS_AT = new Date(Date.now() + 70_000).toISOString();

const MOCK_PITCH = {
  id: 'pitch-1',
  name: 'Cancha A',
  pitchType: 'F5',
  price: 3000,
  isActive: true,
  venueId: 'venue-1',
  venue: {
    id: 'venue-1',
    name: 'Predio Norte',
    addressText: 'Av. Siempre Viva 123',
    mapsUrl: 'https://maps.google.com/?q=1,2',
    latitude: -34.6,
    longitude: -58.4,
    isActive: true,
  },
};

describe('CreateMatchUseCase', () => {
  it('throws when startsAt is too soon', async () => {
    const prisma = buildPrisma();
    const useCase = new CreateMatchUseCase(prisma);
    const startsAt = new Date(Date.now() + 30_000).toISOString();

    await expect(
      useCase.execute({
        title: 'Morning match',
        startsAt,
        capacity: 10,
        createdById: 'dev-user-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('creates a match with scheduled status (no venue)', async () => {
    const prisma = buildPrisma();
    prisma.client.match.create = jest.fn().mockResolvedValue({
      id: 'match-1',
      revision: 1,
      status: 'scheduled',
    });

    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Morning match',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'dev-user-1',
      }),
    ).resolves.toEqual({ id: 'match-1', revision: 1, status: 'scheduled' });
    expect(prisma.client.match.create).toHaveBeenCalled();
  });

  it('throws 422 when venueId provided without venuePitchId', async () => {
    const prisma = buildPrisma();
    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Test',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'user-1',
        venueId: 'venue-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('throws 422 when venuePitchId provided without venueId', async () => {
    const prisma = buildPrisma();
    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Test',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'user-1',
        venuePitchId: 'pitch-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('throws 422 when pitch is not found', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue(null);
    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Test',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'user-1',
        venueId: 'venue-1',
        venuePitchId: 'pitch-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('throws 422 when pitch is inactive', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      isActive: false,
    });
    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Test',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'user-1',
        venueId: 'venue-1',
        venuePitchId: 'pitch-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('throws 422 when venue is inactive', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      venue: { ...MOCK_PITCH.venue, isActive: false },
    });
    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Test',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'user-1',
        venueId: 'venue-1',
        venuePitchId: 'pitch-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('throws 422 when pitch does not belong to the provided venue', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      venueId: 'other-venue',
    });
    const useCase = new CreateMatchUseCase(prisma);

    await expect(
      useCase.execute({
        title: 'Test',
        startsAt: FUTURE_STARTS_AT,
        capacity: 10,
        createdById: 'user-1',
        venueId: 'venue-1',
        venuePitchId: 'pitch-1',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.client.match.create).not.toHaveBeenCalled();
  });

  it('persists venue and pitch snapshots when valid venue/pitch provided', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest
      .fn()
      .mockResolvedValue(MOCK_PITCH);
    prisma.client.match.create = jest.fn().mockResolvedValue({
      id: 'match-2',
      revision: 1,
      status: 'scheduled',
    });
    const useCase = new CreateMatchUseCase(prisma);

    const result = await useCase.execute({
      title: 'F5 en Predio Norte',
      startsAt: FUTURE_STARTS_AT,
      capacity: 10,
      createdById: 'user-1',
      venueId: 'venue-1',
      venuePitchId: 'pitch-1',
    });

    expect(result).toEqual({ id: 'match-2', revision: 1, status: 'scheduled' });

    const createCall = (prisma.client.match.create as jest.Mock).mock
      .calls[0][0];
    expect(createCall.data.venueSnapshot).toEqual({
      name: 'Predio Norte',
      addressText: 'Av. Siempre Viva 123',
      mapsUrl: 'https://maps.google.com/?q=1,2',
      latitude: -34.6,
      longitude: -58.4,
    });
    expect(createCall.data.pitchSnapshot).toEqual({
      name: 'Cancha A',
      pitchType: 'F5',
      price: 3000,
    });
  });

  it('derives pitchType from the pitch entity, not from client input', async () => {
    const prisma = buildPrisma();
    prisma.client.venuePitch.findUnique = jest.fn().mockResolvedValue({
      ...MOCK_PITCH,
      pitchType: 'F7',
    });
    prisma.client.match.create = jest.fn().mockResolvedValue({
      id: 'match-3',
      revision: 1,
      status: 'scheduled',
    });
    const useCase = new CreateMatchUseCase(prisma);

    await useCase.execute({
      title: 'Test',
      startsAt: FUTURE_STARTS_AT,
      capacity: 14,
      createdById: 'user-1',
      venueId: 'venue-1',
      venuePitchId: 'pitch-1',
    });

    const createCall = (prisma.client.match.create as jest.Mock).mock
      .calls[0][0];
    expect(createCall.data.pitchSnapshot.pitchType).toBe('F7');
  });
});
