import { NotFoundException } from '@nestjs/common';
import { AdminVenueService } from './admin-venue.service';
import { AdminPitchService } from './admin-pitch.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

// ── Helpers ──

function buildVenuePrisma(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      venue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        ...overrides,
      },
    },
  } as unknown as PrismaService;
}

function buildPitchPrisma(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      venue: { findUnique: jest.fn() },
      venuePitch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        ...overrides,
      },
    },
  } as unknown as PrismaService;
}

const MOCK_VENUE = {
  id: 'venue-1',
  name: 'Predio Norte',
  addressText: 'Av. Test 123',
  mapsUrl: null,
  latitude: null,
  longitude: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  _count: { pitches: 2 },
};

const MOCK_PITCH = {
  id: 'pitch-1',
  venueId: 'venue-1',
  name: 'Cancha A',
  pitchType: 'F5',
  price: 3000,
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

// ── AdminVenueService ──

describe('AdminVenueService', () => {
  describe('listVenues', () => {
    it('returns all venues including inactive ones', async () => {
      const prisma = buildVenuePrisma();
      const inactiveVenue = {
        ...MOCK_VENUE,
        id: 'venue-2',
        isActive: false,
        _count: { pitches: 0 },
      };
      (prisma.client.venue.findMany as jest.Mock).mockResolvedValue([
        MOCK_VENUE,
        inactiveVenue,
      ]);
      const service = new AdminVenueService(prisma);

      const result = await service.listVenues();

      expect(result).toHaveLength(2);
      expect(result.find((v) => v.id === 'venue-2')?.isActive).toBe(false);
    });

    it('exposes pitchCount from _count', async () => {
      const prisma = buildVenuePrisma();
      (prisma.client.venue.findMany as jest.Mock).mockResolvedValue([
        MOCK_VENUE,
      ]);
      const service = new AdminVenueService(prisma);

      const result = await service.listVenues();

      expect(result[0].pitchCount).toBe(2);
    });
  });

  describe('createVenue', () => {
    it('creates and returns venue', async () => {
      const prisma = buildVenuePrisma();
      (prisma.client.venue.create as jest.Mock).mockResolvedValue(MOCK_VENUE);
      const service = new AdminVenueService(prisma);

      const result = await service.createVenue({
        name: 'Predio Norte',
        addressText: 'Av. Test 123',
      });

      expect(result.name).toBe('Predio Norte');
      expect(prisma.client.venue.create).toHaveBeenCalled();
    });
  });

  describe('updateVenue', () => {
    it('throws 404 when venue not found', async () => {
      const prisma = buildVenuePrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue(null);
      const service = new AdminVenueService(prisma);

      await expect(
        service.updateVenue('missing', { name: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deactivates venue when isActive: false is sent', async () => {
      const prisma = buildVenuePrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue(
        MOCK_VENUE,
      );
      (prisma.client.venue.update as jest.Mock).mockResolvedValue({
        ...MOCK_VENUE,
        isActive: false,
      });
      const service = new AdminVenueService(prisma);

      const result = await service.updateVenue('venue-1', { isActive: false });

      expect(result.isActive).toBe(false);
      const updateCall = (prisma.client.venue.update as jest.Mock).mock
        .calls[0][0];
      expect(updateCall.data).toMatchObject({ isActive: false });
    });

    it('only updates fields that are explicitly provided', async () => {
      const prisma = buildVenuePrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue(
        MOCK_VENUE,
      );
      (prisma.client.venue.update as jest.Mock).mockResolvedValue(MOCK_VENUE);
      const service = new AdminVenueService(prisma);

      await service.updateVenue('venue-1', { name: 'Updated' });

      const updateCall = (prisma.client.venue.update as jest.Mock).mock
        .calls[0][0];
      expect(updateCall.data).toEqual({ name: 'Updated' });
      expect(updateCall.data).not.toHaveProperty('isActive');
    });
  });
});

// ── AdminPitchService ──

describe('AdminPitchService', () => {
  describe('listPitches', () => {
    it('throws 404 when venue not found', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue(null);
      const service = new AdminPitchService(prisma);

      await expect(service.listPitches('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns pitches for the venue', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue({
        id: 'venue-1',
      });
      (prisma.client.venuePitch.findMany as jest.Mock).mockResolvedValue([
        MOCK_PITCH,
      ]);
      const service = new AdminPitchService(prisma);

      const result = await service.listPitches('venue-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Cancha A');
    });
  });

  describe('createPitch', () => {
    it('throws 404 when venue not found', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue(null);
      const service = new AdminPitchService(prisma);

      await expect(
        service.createPitch('missing', { name: 'A', pitchType: 'F5' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates pitch with correct data', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venue.findUnique as jest.Mock).mockResolvedValue({
        id: 'venue-1',
      });
      (prisma.client.venuePitch.create as jest.Mock).mockResolvedValue(
        MOCK_PITCH,
      );
      const service = new AdminPitchService(prisma);

      const result = await service.createPitch('venue-1', {
        name: 'Cancha A',
        pitchType: 'F5',
        price: 3000,
      });

      expect(result.pitchType).toBe('F5');
      expect(result.price).toBe(3000);
      const createCall = (prisma.client.venuePitch.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.venueId).toBe('venue-1');
    });
  });

  describe('updatePitch', () => {
    it('throws 404 when pitch not found', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venuePitch.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      const service = new AdminPitchService(prisma);

      await expect(
        service.updatePitch('venue-1', 'missing', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 when pitch belongs to a different venue', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venuePitch.findUnique as jest.Mock).mockResolvedValue({
        ...MOCK_PITCH,
        venueId: 'other-venue',
      });
      const service = new AdminPitchService(prisma);

      await expect(
        service.updatePitch('venue-1', 'pitch-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deactivates pitch when isActive: false is sent', async () => {
      const prisma = buildPitchPrisma();
      (prisma.client.venuePitch.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PITCH,
      );
      (prisma.client.venuePitch.update as jest.Mock).mockResolvedValue({
        ...MOCK_PITCH,
        isActive: false,
      });
      const service = new AdminPitchService(prisma);

      const result = await service.updatePitch('venue-1', 'pitch-1', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });
  });
});
