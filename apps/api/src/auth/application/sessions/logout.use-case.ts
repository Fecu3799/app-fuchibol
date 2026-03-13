import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuthAuditService } from '../../infra/auth-audit.service';

@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(sessionId: string, userId: string): Promise<void> {
    // Fetch deviceId before revoking so we can clean up the push device.
    const session = await this.prisma.client.authSession.findUnique({
      where: { id: sessionId },
      select: { deviceId: true },
    });

    await this.prisma.client.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Disassociate the push device for this physical device from this user.
    // Prevents the device from receiving pushes for the logged-out account
    // if another user logs in next (before push is re-registered).
    if (session?.deviceId) {
      await this.prisma.client.pushDevice.deleteMany({
        where: { userId, deviceId: session.deviceId },
      });
    }

    this.logger.log(`logout userId=${userId} sessionId=${sessionId}`);
    void this.auditService
      .log({ eventType: 'logout', userId, sessionId })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
