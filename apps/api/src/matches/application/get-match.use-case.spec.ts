import { NotFoundException } from '@nestjs/common';
import { GetMatchUseCase } from './get-match.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

const buildPrisma = () =>
  ({
    client: {
      match: {
        findUnique: jest.fn(),
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

  it('returns match when found', async () => {
    const prisma = buildPrisma();
    prisma.client.match.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'match-1' });
    const useCase = new GetMatchUseCase(prisma);

    await expect(useCase.execute('match-1')).resolves.toEqual({
      id: 'match-1',
    });
  });
});
