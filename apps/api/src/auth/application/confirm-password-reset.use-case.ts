import * as argon2 from 'argon2';
import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import { AuthAuditService } from '../infra/auth-audit.service';

@Injectable()
export class ConfirmPasswordResetUseCase {
  private readonly logger = new Logger(ConfirmPasswordResetUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.tokenService.hashEmailToken(rawToken);

    const record = await this.prisma.client.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnprocessableEntityException('INVALID_OR_EXPIRED_TOKEN');
    }

    const passwordHash = await argon2.hash(newPassword);

    // Atomic: mark token used + update password + revoke all sessions.
    await this.prisma.client.$transaction([
      this.prisma.client.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.client.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.client.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log(`password_reset_confirmed userId=${record.userId}`);
    void this.auditService
      .log({ eventType: 'password_reset_confirmed', userId: record.userId })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
