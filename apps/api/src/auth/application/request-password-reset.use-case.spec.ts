import { RequestPasswordResetUseCase } from './request-password-reset.use-case';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import type { TokenService } from '../infra/token.service';
import type { EmailService } from '../infra/email.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

const buildPrisma = () =>
  ({
    client: {
      user: { findUnique: jest.fn() },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    },
  }) as unknown as PrismaService;

const buildTokenService = () =>
  ({
    generateEmailToken: jest.fn().mockReturnValue('raw-token'),
    hashEmailToken: jest.fn().mockReturnValue('hashed-token'),
  }) as unknown as TokenService;

const buildEmailService = () =>
  ({
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  }) as unknown as EmailService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

describe('RequestPasswordResetUseCase', () => {
  it('returns silently when email does not exist (anti-enumeration)', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue(null);

    const useCase = new RequestPasswordResetUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );
    await expect(useCase.execute('ghost@example.com')).resolves.toBeUndefined();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('creates token and sends email when user exists', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    prisma.client.user.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    const useCase = new RequestPasswordResetUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );
    await useCase.execute('user@example.com', '1.2.3.4');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', usedAt: null }),
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.client.passwordResetToken.create).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      'user@example.com',
      'raw-token',
    );
  });
});
