import { NotFoundException } from '@nestjs/common';
import { UpdateMeUseCase } from './update-me.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';

const buildPrisma = (userExists = true) => {
  const updatedUser = {
    id: 'user-id',
    email: 'test@test.com',
    username: 'testuser',
    role: 'USER',
    gender: null,
    firstName: 'Juan',
    lastName: null,
    birthDate: null,
    preferredPosition: null,
    skillLevel: null,
    termsAcceptedAt: new Date(),
    createdAt: new Date(),
  };
  return {
    client: {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue(userExists ? { id: 'user-id' } : null),
        update: jest.fn().mockResolvedValue(updatedUser),
      },
    },
  } as unknown as PrismaService;
};

describe('UpdateMeUseCase', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws 404 when user does not exist', async () => {
    const prisma = buildPrisma(false);
    const useCase = new UpdateMeUseCase(prisma);
    await expect(
      useCase.execute({ userId: 'missing-id', firstName: 'Juan' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates profile fields and returns updated user', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMeUseCase(prisma);

    const result = await useCase.execute({
      userId: 'user-id',
      firstName: 'Juan',
    });

    expect(result.firstName).toBe('Juan');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-id' },
        data: expect.objectContaining({ firstName: 'Juan' }),
      }),
    );
  });

  it('converts birthDate string to Date object', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMeUseCase(prisma);

    await useCase.execute({ userId: 'user-id', birthDate: '1990-05-15' });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: new Date('1990-05-15') }),
      }),
    );
  });

  it('sets birthDate to null when null is passed', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMeUseCase(prisma);

    await useCase.execute({ userId: 'user-id', birthDate: null });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ birthDate: null }),
      }),
    );
  });

  it('does not include email in update data', async () => {
    const prisma = buildPrisma();
    const useCase = new UpdateMeUseCase(prisma);

    await useCase.execute({ userId: 'user-id', firstName: 'Juan' });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const callArg = (prisma.client.user.update as jest.Mock).mock
      .calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(callArg.data).not.toHaveProperty('email');
  });
});
