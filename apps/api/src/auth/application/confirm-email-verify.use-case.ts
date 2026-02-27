import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import { AuthAuditService } from '../infra/auth-audit.service';

@Injectable()
export class ConfirmEmailVerifyUseCase {
  private readonly logger = new Logger(ConfirmEmailVerifyUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashEmailToken(rawToken);

    const record = await this.prisma.client.emailVerificationToken.findFirst({
      where: { tokenHash },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    if (record.usedAt) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.client.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    this.logger.log(`email_verified userId=${record.userId}`);
    void this.auditService
      .log({ eventType: 'email_verified', userId: record.userId })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
