import { SearchVenuePitchesQuery } from './search-venue-pitches.query';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockVenue = {
  id: 'venue-1',
  name: 'Predio Norte',
  addressText: 'Av. Test 123',
  mapsUrl: null,
  latitude: null,
  longitude: null,
};

const mockPitch = {
  id: 'pitch-1',
  name: 'Cancha A',
  pitchType: 'F5',
  price: 5000,
  isActive: true,
  venue: mockVenue,
};

function buildPrisma(findMany: jest.Mock) {
  return {
    client: { venuePitch: { findMany } },
  } as unknown as PrismaService;
}

describe('SearchVenuePitchesQuery', () => {
  it('returns only active pitches of the requested type', async () => {
    const findMany = jest.fn().mockResolvedValue([mockPitch]);
    const query = new SearchVenuePitchesQuery(buildPrisma(findMany));

    const result = await query.execute({ pitchType: 'F5' });

    expect(result).toHaveLength(1);
    expect(result[0].venuePitchId).toBe('pitch-1');
    expect(result[0].pitchType).toBe('F5');
    expect(result[0].venueName).toBe('Predio Norte');
  });

  it('excludes venues with isActive: false via where clause', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const query = new SearchVenuePitchesQuery(buildPrisma(findMany));

    await query.execute({ pitchType: 'F5' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          venue: { isActive: true },
        }),
      }),
    );
  });

  it('filters by pitchType in the where clause', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const query = new SearchVenuePitchesQuery(buildPrisma(findMany));

    await query.execute({ pitchType: 'F11' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pitchType: 'F11' }),
      }),
    );
  });

  it('returns empty array when no pitches match', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const query = new SearchVenuePitchesQuery(buildPrisma(findMany));

    const result = await query.execute({ pitchType: 'F9' });

    expect(result).toEqual([]);
  });
});
