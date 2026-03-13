import { LogoutUseCase } from './logout.use-case';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuthAuditService } from '../../infra/auth-audit.service';

const buildPrisma = (sessionDeviceId: string | null = 'device-abc') =>
  ({
    client: {
      authSession: {
        findUnique: jest.fn().mockResolvedValue({ deviceId: sessionDeviceId }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pushDevice: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    },
  }) as unknown as PrismaService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

describe('LogoutUseCase', () => {
  it('revokes the current session by sessionId and userId', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();
    const useCase = new LogoutUseCase(prisma, auditService);

    await useCase.execute('session-uuid', 'user-uuid');

    expect(prisma.client.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-uuid', userId: 'user-uuid', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('deletes push devices for the session deviceId on logout', async () => {
    const prisma = buildPrisma('device-abc');
    const auditService = buildAuditService();
    const useCase = new LogoutUseCase(prisma, auditService);

    await useCase.execute('session-uuid', 'user-uuid');

    expect(prisma.client.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-uuid', deviceId: 'device-abc' },
    });
  });

  it('skips push device cleanup when session has no deviceId', async () => {
    const prisma = buildPrisma(null);
    const auditService = buildAuditService();
    const useCase = new LogoutUseCase(prisma, auditService);

    await useCase.execute('session-uuid', 'user-uuid');

    expect(prisma.client.pushDevice.deleteMany).not.toHaveBeenCalled();
  });
});
