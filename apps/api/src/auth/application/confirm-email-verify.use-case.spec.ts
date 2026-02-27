import { UnauthorizedException } from '@nestjs/common';
import { ConfirmEmailVerifyUseCase } from './confirm-email-verify.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

const buildPrisma = () => {
  const $transaction = jest.fn().mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) {
      await op;
    }
  });
  return {
    client: {
      emailVerificationToken: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction,
    },
  } as unknown as PrismaService;
};

const buildTokenService = () =>
  ({
    hashEmailToken: jest.fn().mockReturnValue('hashed-token'),
  }) as unknown as TokenService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

const validRecord = {
  id: 'token-id',
  userId: 'user-id',
  tokenHash: 'hashed-token',
  usedAt: null,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60),
};

describe('ConfirmEmailVerifyUseCase', () => {
  it('marks token as used and sets emailVerifiedAt', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();

    prisma.client.emailVerificationToken.findFirst = jest
      .fn()
      .mockResolvedValue(validRecord);

    const useCase = new ConfirmEmailVerifyUseCase(
      prisma,
      tokenService,
      buildAuditService(),
    );
    await useCase.execute('raw-token');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.$transaction).toHaveBeenCalled();
  });

  it('throws 401 when token not found', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();

    prisma.client.emailVerificationToken.findFirst = jest
      .fn()
      .mockResolvedValue(null);

    const useCase = new ConfirmEmailVerifyUseCase(
      prisma,
      tokenService,
      buildAuditService(),
    );
    await expect(useCase.execute('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws 401 when token is already used', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();

    prisma.client.emailVerificationToken.findFirst = jest
      .fn()
      .mockResolvedValue({ ...validRecord, usedAt: new Date() });

    const useCase = new ConfirmEmailVerifyUseCase(
      prisma,
      tokenService,
      buildAuditService(),
    );
    await expect(useCase.execute('raw-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws 401 when token is expired', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();

    prisma.client.emailVerificationToken.findFirst = jest
      .fn()
      .mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      });

    const useCase = new ConfirmEmailVerifyUseCase(
      prisma,
      tokenService,
      buildAuditService(),
    );
    await expect(useCase.execute('raw-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
