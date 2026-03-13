import * as argon2 from 'argon2';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuthAuditService } from '../../infra/auth-audit.service';

@Injectable()
export class ChangePasswordUseCase {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(
    userId: string,
    sessionId: string | undefined,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const passwordHash = await argon2.hash(newPassword);

    // Revoke all sessions except the current one so the user stays logged in.
    const sessionFilter = sessionId ? { id: { not: sessionId } } : {};

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.client.authSession.updateMany({
        where: { userId, revokedAt: null, ...sessionFilter },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log(`password_changed userId=${userId}`);
    void this.auditService
      .log({ eventType: 'password_changed', userId, sessionId })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
