import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../infra/prisma/prisma.service';

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
} as unknown as ConfigService;

const futureDate = new Date(Date.now() + 1000 * 60 * 60);
const pastDate = new Date(Date.now() - 1000);

function buildPrisma(
  session: { revokedAt: Date | null; expiresAt: Date } | null,
) {
  return {
    client: {
      authSession: {
        findUnique: jest.fn().mockResolvedValue(session),
      },
    },
  } as unknown as PrismaService;
}

describe('JwtStrategy.validate', () => {
  it('returns actor payload when session is active', async () => {
    const prisma = buildPrisma({ revokedAt: null, expiresAt: futureDate });
    const strategy = new JwtStrategy(mockConfigService, prisma);

    const result = await strategy.validate({
      sub: 'user-1',
      role: 'user',
      sid: 'session-1',
    });

    expect(result).toEqual({
      userId: 'user-1',
      role: 'user',
      sessionId: 'session-1',
    });
  });

  it('throws SESSION_REVOKED when session has revokedAt set', async () => {
    const prisma = buildPrisma({
      revokedAt: new Date(),
      expiresAt: futureDate,
    });
    const strategy = new JwtStrategy(mockConfigService, prisma);

    await expect(
      strategy.validate({ sub: 'user-1', role: 'user', sid: 'session-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws SESSION_REVOKED when session not found in DB', async () => {
    const prisma = buildPrisma(null);
    const strategy = new JwtStrategy(mockConfigService, prisma);

    await expect(
      strategy.validate({ sub: 'user-1', role: 'user', sid: 'session-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws SESSION_REVOKED when session is expired', async () => {
    const prisma = buildPrisma({ revokedAt: null, expiresAt: pastDate });
    const strategy = new JwtStrategy(mockConfigService, prisma);

    await expect(
      strategy.validate({ sub: 'user-1', role: 'user', sid: 'session-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips DB check and returns payload when sid is absent', async () => {
    const prisma = buildPrisma(null);
    const strategy = new JwtStrategy(mockConfigService, prisma);

    const result = await strategy.validate({ sub: 'user-1', role: 'user' });

    expect(result).toEqual({
      userId: 'user-1',
      role: 'user',
      sessionId: undefined,
    });

    expect(prisma.client.authSession.findUnique).not.toHaveBeenCalled();
  });
});
