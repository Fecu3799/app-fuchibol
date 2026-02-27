import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshUseCase } from './refresh.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

const buildPrisma = () =>
  ({
    client: {
      authSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    },
  }) as unknown as PrismaService;

const buildJwt = () =>
  ({
    sign: jest.fn().mockReturnValue('new-access-token'),
  }) as unknown as JwtService;

const buildTokenService = (
  parseResult: { sessionId: string; secret: string } | null = {
    sessionId: 'session-id',
    secret: 'secret',
  },
) =>
  ({
    parseRefreshToken: jest.fn().mockReturnValue(parseResult),
    generateRefreshToken: jest.fn().mockReturnValue({
      token: 'session-id.new-secret',
      secret: 'new-secret',
    }),
    hashSecret: jest.fn().mockResolvedValue('new-hashed-secret'),
    verifySecret: jest.fn(),
  }) as unknown as TokenService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

const validSession = {
  id: 'session-id',
  userId: 'user-id',
  refreshTokenHash: 'stored-hash',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  user: {
    id: 'user-id',
    role: 'USER',
    emailVerifiedAt: new Date('2025-01-01'),
  },
};

describe('RefreshUseCase', () => {
  it('rotates refresh token and returns new access + refresh tokens', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest
      .fn()
      .mockResolvedValue(validSession);
    (tokenService.verifySecret as jest.Mock).mockResolvedValue(true);
    prisma.client.authSession.update = jest.fn().mockResolvedValue({});

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    const result = await useCase.execute('session-id.secret');

    expect(result).toHaveProperty('accessToken', 'new-access-token');
    expect(result).toHaveProperty('refreshToken', 'session-id.new-secret');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.authSession.update).toHaveBeenCalled();
  });

  it('throws SESSION_REVOKED when token is malformed', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService(null);
    const auditService = buildAuditService();

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    await expect(useCase.execute('bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws SESSION_REVOKED when session not found', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue(null);

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    await expect(useCase.execute('session-id.secret')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws SESSION_REVOKED when session already revoked', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue({
      ...validSession,
      revokedAt: new Date(),
    });

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    await expect(useCase.execute('session-id.secret')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws REFRESH_EXPIRED when session is expired', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue({
      ...validSession,
      expiresAt: new Date(Date.now() - 1000),
    });

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    const err = await useCase
      .execute('session-id.secret')
      .catch((e) => e as unknown);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(
      ((err as UnauthorizedException).getResponse() as Record<string, unknown>)
        .message,
    ).toBe('REFRESH_EXPIRED');
  });

  it('detects reuse: revokes all sessions, logs refresh_reused_detected, throws REFRESH_REUSED', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest
      .fn()
      .mockResolvedValue(validSession);
    (tokenService.verifySecret as jest.Mock).mockResolvedValue(false); // hash mismatch
    prisma.client.authSession.updateMany = jest.fn().mockResolvedValue({});

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    const err = await useCase
      .execute('session-id.secret')
      .catch((e) => e as unknown);

    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(
      ((err as UnauthorizedException).getResponse() as Record<string, unknown>)
        .message,
    ).toBe('REFRESH_REUSED');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-id' }),
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'refresh_reused_detected',
        userId: 'user-id',
      }),
    );
  });

  it('throws EMAIL_NOT_VERIFIED when user email not verified', async () => {
    const prisma = buildPrisma();
    const jwt = buildJwt();
    const tokenService = buildTokenService();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue({
      ...validSession,
      user: { ...validSession.user, emailVerifiedAt: null },
    });
    (tokenService.verifySecret as jest.Mock).mockResolvedValue(true);

    const useCase = new RefreshUseCase(prisma, jwt, tokenService, auditService);
    await expect(useCase.execute('session-id.secret')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
