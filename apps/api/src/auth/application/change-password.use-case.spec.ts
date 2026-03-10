import { UnauthorizedException } from '@nestjs/common';
import { ChangePasswordUseCase } from './change-password.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

const mockVerify = jest.fn();
jest.mock('argon2', () => ({
  verify: (...args: unknown[]) => mockVerify(...args),
  hash: jest.fn().mockResolvedValue('new-hash'),
}));

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

const buildPrisma = () => {
  const $transaction = jest.fn().mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) await op;
  });
  return {
    client: {
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ passwordHash: 'current-hash' }),
        update: jest.fn().mockResolvedValue({}),
      },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction,
    },
  } as unknown as PrismaService;
};

describe('ChangePasswordUseCase', () => {
  afterEach(() => jest.clearAllMocks());

  it('throws 401 when current password is wrong', async () => {
    mockVerify.mockResolvedValue(false);
    const prisma = buildPrisma();

    const useCase = new ChangePasswordUseCase(prisma, buildAuditService());
    await expect(
      useCase.execute('user-id', 'session-id', 'wrong', 'NewPass1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.client.$transaction).not.toHaveBeenCalled();
  });

  it('updates password and revokes other sessions on correct current password', async () => {
    mockVerify.mockResolvedValue(true);
    const prisma = buildPrisma();

    const useCase = new ChangePasswordUseCase(prisma, buildAuditService());
    await useCase.execute('user-id', 'session-id', 'correct', 'NewPass1');

    expect(prisma.client.$transaction).toHaveBeenCalled();
  });
});
