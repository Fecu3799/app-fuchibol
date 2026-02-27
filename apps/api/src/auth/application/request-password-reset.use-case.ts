import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import { EmailService } from '../infra/email.service';
import { AuthAuditService } from '../infra/auth-audit.service';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(email: string, ip?: string, userAgent?: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return — never reveal whether the email exists (anti-enumeration).
    if (!user) {
      void this.auditService
        .log({
          eventType: 'password_reset_requested',
          userId: null,
          ip,
          userAgent,
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      return;
    }

    // Invalidate any existing unused tokens so only the latest is valid.
    await this.prisma.client.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = this.tokenService.generateEmailToken();
    const tokenHash = this.tokenService.hashEmailToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.client.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestIp: ip ?? null,
        requestUserAgent: userAgent ?? null,
      },
    });

    await this.emailService.sendPasswordReset(user.email, rawToken);

    this.logger.log(`password_reset_requested userId=${user.id}`);
    void this.auditService
      .log({
        eventType: 'password_reset_requested',
        userId: user.id,
        ip,
        userAgent,
      })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
