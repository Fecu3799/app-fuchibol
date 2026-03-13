import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TokenService } from '../../infra/token.service';
import { EmailService } from '../../infra/email.service';
import { AuthAuditService } from '../../infra/auth-audit.service';

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

@Injectable()
export class RequestEmailVerifyUseCase {
  private readonly logger = new Logger(RequestEmailVerifyUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    if (user.emailVerifiedAt) {
      // Already verified — silently succeed (no info leakage)
      return;
    }

    // Invalidate existing unused tokens for this user
    await this.prisma.client.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }, // mark as used to invalidate
    });

    const rawToken = this.tokenService.generateEmailToken();
    const tokenHash = this.tokenService.hashEmailToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);

    await this.prisma.client.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    await this.emailService.sendEmailVerification(user.email, rawToken);

    this.logger.log(`email_verify_requested userId=${user.id}`);
    void this.auditService
      .log({ eventType: 'email_verify_requested', userId: user.id })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
