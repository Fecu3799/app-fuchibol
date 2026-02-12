/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterUseCase } from './register.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const buildPrisma = () =>
  ({
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    },
  }) as unknown as PrismaService;

const buildJwt = () =>
  ({
    sign: jest.fn().mockReturnValue('mock-token'),
  }) as unknown as JwtService;

describe('RegisterUseCase', () => {
  it('registers a new user and returns token', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue(null);
    prisma.client.user.create = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      role: 'USER',
    });

    const useCase = new RegisterUseCase(prisma, jwt);
    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      accessToken: 'mock-token',
      user: { id: 'uuid-1', email: 'test@example.com', role: 'USER' },
    });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'uuid-1', role: 'USER' });
  });

  it('throws 409 when email already exists', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
    });

    const useCase = new RegisterUseCase(prisma, jwt);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
