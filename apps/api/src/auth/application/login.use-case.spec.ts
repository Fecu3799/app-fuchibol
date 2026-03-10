import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginUseCase } from './login.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

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
      authSession: {
        create: jest.fn(),
        update: jest.fn(),
      },
    },
  }) as unknown as PrismaService;

const buildJwt = () =>
  ({
    sign: jest.fn().mockReturnValue('mock-access-token'),
  }) as unknown as JwtService;

const buildTokenService = () =>
  ({
    generateRefreshToken: jest
      .fn()
      .mockReturnValue({ token: 'sessionid.secret', secret: 'secret' }),
    hashSecret: jest.fn().mockResolvedValue('hashed-secret'),
  }) as unknown as TokenService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

const verifiedUser = {
  id: 'uuid-1',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: 'hashed',
  role: 'USER',
  emailVerifiedAt: new Date('2025-01-01'),
};

describe('LoginUseCase', () => {
  it('logs in by email and returns accessToken + refreshToken', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue(verifiedUser);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    prisma.client.authSession.create = jest
      .fn()
      .mockResolvedValue({ id: 'session-uuid' });
    prisma.client.authSession.update = jest.fn().mockResolvedValue({});

    const useCase = new LoginUseCase(prisma, jwt, tokenService, auditService);
    const result = await useCase.execute({
      identifier: 'test@example.com',
      password: 'password123',
    });

    expect(result).toHaveProperty('accessToken', 'mock-access-token');
    expect(result).toHaveProperty('refreshToken', 'sessionid.secret');
    expect(result).toHaveProperty('sessionId', 'session-uuid');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'login_success',
        userId: 'uuid-1',
        sessionId: 'session-uuid',
      }),
    );
  });

  it('logs in by username', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue(verifiedUser);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    prisma.client.authSession.create = jest
      .fn()
      .mockResolvedValue({ id: 'session-uuid' });
    prisma.client.authSession.update = jest.fn().mockResolvedValue({});

    const useCase = new LoginUseCase(prisma, jwt, tokenService, auditService);
    const result = await useCase.execute({
      identifier: 'testuser', // no @, so username lookup
      password: 'password123',
    });

    // Should have looked up by username

    expect(prisma.client.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'testuser' },
    });
    expect(result).toHaveProperty('accessToken');
  });

  it('throws 401 on unknown identifier and logs login_failed with null userId', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();
    prisma.client.user.findUnique = jest.fn().mockResolvedValue(null);

    const useCase = new LoginUseCase(prisma, jwt, tokenService, auditService);

    await expect(
      useCase.execute({ identifier: 'no@example.com', password: 'pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login_failed', userId: null }),
    );
  });

  it('throws 401 on wrong password and logs login_failed with userId', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();
    prisma.client.user.findUnique = jest.fn().mockResolvedValue(verifiedUser);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    const useCase = new LoginUseCase(prisma, jwt, tokenService, auditService);

    await expect(
      useCase.execute({ identifier: 'test@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login_failed', userId: 'uuid-1' }),
    );
  });

  it('throws 403 EMAIL_NOT_VERIFIED when email is unverified', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue({
      ...verifiedUser,
      emailVerifiedAt: null,
    });
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const useCase = new LoginUseCase(prisma, jwt, tokenService, auditService);

    await expect(
      useCase.execute({
        identifier: 'test@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
