import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthAuditService } from '../infra/auth-audit.service';

@Injectable()
export class LogoutAllUseCase {
  private readonly logger = new Logger(LogoutAllUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.prisma.client.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`logout_all userId=${userId}`);
    void this.auditService
      .log({ eventType: 'logout_all', userId })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
