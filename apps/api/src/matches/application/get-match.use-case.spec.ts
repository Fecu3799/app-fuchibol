import { NotFoundException } from '@nestjs/common';
import { GetMatchUseCase } from './get-match.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockMatch = {
  id: 'match-1',
  title: 'Test',
  startsAt: new Date(),
  capacity: 10,
  status: 'scheduled',
  revision: 1,
  createdById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () =>
  ({
    client: {
      match: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      matchParticipant: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    },
  }) as unknown as PrismaService;

describe('GetMatchUseCase', () => {
  it('throws when match does not exist', async () => {
    const prisma = buildPrisma();
    prisma.client.match.findUnique = jest.fn().mockResolvedValue(null);
    const useCase = new GetMatchUseCase(prisma);

    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns match snapshot when found', async () => {
    const prisma = buildPrisma();
    prisma.client.match.findUnique = jest.fn().mockResolvedValue(mockMatch);
    prisma.client.match.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(mockMatch);
    const useCase = new GetMatchUseCase(prisma);

    const result = await useCase.execute('match-1', 'user-1');
    expect(result.id).toBe('match-1');
    expect(result.confirmedCount).toBe(0);
    expect(result.participants).toEqual([]);
    expect(result.actionsAllowed).toContain('confirm');
    expect(result.actionsAllowed).toContain('invite');
  });
});
