/* eslint-disable @typescript-eslint/unbound-method */
import { UnprocessableEntityException } from '@nestjs/common';
import { CreateMatchUseCase } from './create-match.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

const buildPrisma = () =>
  ({
    client: {
      user: {
        upsert: jest.fn(),
      },
      match: {
        create: jest.fn(),
      },
    },
  }) as unknown as PrismaService;

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

  it('creates a match with scheduled status', async () => {
    const prisma = buildPrisma();
    prisma.client.user.upsert = jest
      .fn()
      .mockResolvedValue({ id: 'dev-user-1' });
    prisma.client.match.create = jest.fn().mockResolvedValue({
      id: 'match-1',
      revision: 1,
      status: 'scheduled',
    });

    const useCase = new CreateMatchUseCase(prisma);
    const startsAt = new Date(Date.now() + 70_000).toISOString();

    await expect(
      useCase.execute({
        title: 'Morning match',
        startsAt,
        capacity: 10,
        createdById: 'dev-user-1',
      }),
    ).resolves.toEqual({ id: 'match-1', revision: 1, status: 'scheduled' });
    expect(prisma.client.user.upsert).toHaveBeenCalledWith({
      where: { id: 'dev-user-1' },
      update: {},
      create: { id: 'dev-user-1' },
    });
  });
});
