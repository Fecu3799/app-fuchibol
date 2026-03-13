import { LogoutAllUseCase } from './logout-all.use-case';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuthAuditService } from '../../infra/auth-audit.service';

const buildPrisma = () =>
  ({
    client: {
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      pushDevice: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    },
  }) as unknown as PrismaService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

describe('LogoutAllUseCase', () => {
  it('revokes all sessions for the user', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();
    const useCase = new LogoutAllUseCase(prisma, auditService);

    await useCase.execute('user-uuid');

    expect(prisma.client.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-uuid', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('deletes all push devices for the user on logout-all', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();
    const useCase = new LogoutAllUseCase(prisma, auditService);

    await useCase.execute('user-uuid');

    expect(prisma.client.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-uuid' },
    });
  });
});
