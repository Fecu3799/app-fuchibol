import { UnprocessableEntityException } from '@nestjs/common';
import { ConfirmPasswordResetUseCase } from './confirm-password-reset.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { TokenService } from '../infra/token.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('new-hash'),
}));

const buildPrisma = () => {
  const $transaction = jest.fn().mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) await op;
  });
  return {
    client: {
      passwordResetToken: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
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
  expiresAt: new Date(Date.now() + 60_000),
};

describe('ConfirmPasswordResetUseCase', () => {
  it('updates password and revokes sessions on valid token', async () => {
    const prisma = buildPrisma();
    prisma.client.passwordResetToken.findFirst = jest
      .fn()
      .mockResolvedValue(validRecord);

    const useCase = new ConfirmPasswordResetUseCase(
      prisma,
      buildTokenService(),
      buildAuditService(),
    );
    await useCase.execute('raw-token', 'NewPass1');

    expect(prisma.client.$transaction).toHaveBeenCalled();
  });

  it('throws 422 when token not found', async () => {
    const prisma = buildPrisma();
    prisma.client.passwordResetToken.findFirst = jest
      .fn()
      .mockResolvedValue(null);

    const useCase = new ConfirmPasswordResetUseCase(
      prisma,
      buildTokenService(),
      buildAuditService(),
    );
    await expect(useCase.execute('bad', 'NewPass1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws 422 when token is expired', async () => {
    const prisma = buildPrisma();
    prisma.client.passwordResetToken.findFirst = jest.fn().mockResolvedValue({
      ...validRecord,
      expiresAt: new Date(Date.now() - 1000),
    });

    const useCase = new ConfirmPasswordResetUseCase(
      prisma,
      buildTokenService(),
      buildAuditService(),
    );
    await expect(
      useCase.execute('raw-token', 'NewPass1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
