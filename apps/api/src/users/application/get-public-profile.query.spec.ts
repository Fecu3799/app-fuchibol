import { NotFoundException } from '@nestjs/common';
import { GetPublicProfileQuery } from './get-public-profile.query';

const mockUser = {
  id: 'user-1',
  username: 'pepe',
  firstName: 'Pepe',
  lastName: 'García',
  birthDate: new Date('1990-01-15'),
  gender: 'MALE',
  preferredPosition: 'MIDFIELDER',
  skillLevel: 'REGULAR',
  reliabilityScore: 85,
  avatar: { key: 'avatars/user-1/photo.jpg' },
};

const mockPrisma = {
  client: {
    user: {
      findUnique: jest.fn(),
    },
  },
};

const mockStorage = {
  buildPublicUrl: jest.fn((key: string) => `http://cdn/${key}`),
};

function buildQuery() {
  return new GetPublicProfileQuery(mockPrisma as any, mockStorage as any);
}

describe('GetPublicProfileQuery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns public profile with age and avatarUrl, no email or birthDate', async () => {
    mockPrisma.client.user.findUnique.mockResolvedValue(mockUser);
    const query = buildQuery();
    const result = await query.execute('user-1');

    expect(result.id).toBe('user-1');
    expect(result.username).toBe('pepe');
    expect(result.avatarUrl).toBe('http://cdn/avatars/user-1/photo.jpg');
    expect(result.age).toBeGreaterThan(0);
    expect(result.reliabilityLabel).toBe('Cumplidor');

    // Must NOT expose email or birthDate
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('birthDate');
    expect(result).not.toHaveProperty('suspendedUntil');
    expect(result).not.toHaveProperty('termsAcceptedAt');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.client.user.findUnique.mockResolvedValue(null);
    const query = buildQuery();
    await expect(query.execute('ghost')).rejects.toThrow(NotFoundException);
  });

  it('returns null avatarUrl when user has no avatar', async () => {
    mockPrisma.client.user.findUnique.mockResolvedValue({
      ...mockUser,
      avatar: null,
    });
    const query = buildQuery();
    const result = await query.execute('user-1');
    expect(result.avatarUrl).toBeNull();
  });
});
