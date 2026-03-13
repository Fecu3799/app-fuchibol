import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RevokeSessionCommand } from './revoke-session.command';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuthAuditService } from '../../infra/auth-audit.service';

const buildPrisma = () =>
  ({
    client: {
      authSession: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    },
  }) as unknown as PrismaService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

const activeSession = {
  id: 'session-id',
  userId: 'user-id',
  revokedAt: null,
};

describe('RevokeSessionCommand', () => {
  it('revokes session and logs session_revoked', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest
      .fn()
      .mockResolvedValue(activeSession);

    const command = new RevokeSessionCommand(prisma, auditService);
    await command.execute('session-id', 'user-id');

    expect(prisma.client.authSession.update).toHaveBeenCalledWith({
      where: { id: 'session-id' },
      data: { revokedAt: expect.any(Date) },
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'session_revoked',
        userId: 'user-id',
        metadata: expect.objectContaining({ revokedSessionId: 'session-id' }),
      }),
    );
  });

  it('is idempotent: already-revoked session does not audit or update', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue({
      ...activeSession,
      revokedAt: new Date(),
    });

    const command = new RevokeSessionCommand(prisma, auditService);
    await command.execute('session-id', 'user-id');

    expect(prisma.client.authSession.update).not.toHaveBeenCalled();

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('throws 404 when session not found', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue(null);

    const command = new RevokeSessionCommand(prisma, auditService);
    await expect(
      command.execute('session-id', 'user-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 403 when session belongs to different user', async () => {
    const prisma = buildPrisma();
    const auditService = buildAuditService();

    prisma.client.authSession.findUnique = jest.fn().mockResolvedValue({
      ...activeSession,
      userId: 'other-user-id',
    });

    const command = new RevokeSessionCommand(prisma, auditService);
    await expect(
      command.execute('session-id', 'user-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
