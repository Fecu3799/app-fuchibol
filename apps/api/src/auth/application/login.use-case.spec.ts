import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginUseCase } from './login.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
}));

import * as argon2 from 'argon2';

const buildPrisma = () =>
  ({
    client: {
      user: {
        findUnique: jest.fn(),
      },
    },
  }) as unknown as PrismaService;

const buildJwt = () =>
  ({
    sign: jest.fn().mockReturnValue('mock-token'),
  }) as unknown as JwtService;

describe('LoginUseCase', () => {
  it('returns token on valid credentials', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      role: 'USER',
    });
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const useCase = new LoginUseCase(prisma, jwt);
    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      accessToken: 'mock-token',
      user: { id: 'uuid-1', email: 'test@example.com', role: 'USER' },
    });
  });

  it('throws 401 on unknown email', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    prisma.client.user.findUnique = jest.fn().mockResolvedValue(null);

    const useCase = new LoginUseCase(prisma, jwt);

    await expect(
      useCase.execute({ email: 'no@example.com', password: 'pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 on wrong password', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    prisma.client.user.findUnique = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      role: 'USER',
    });
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    const useCase = new LoginUseCase(prisma, jwt);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
