import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import { AuthAuditService } from '../infra/auth-audit.service';

@Injectable()
export class RefreshUseCase {
  private readonly logger = new Logger(RefreshUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(rawToken: string) {
    const parts = this.tokenService.parseRefreshToken(rawToken);
    if (!parts) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    const { sessionId, secret } = parts;

    const session = await this.prisma.client.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('REFRESH_EXPIRED');
    }

    if (!session.user.emailVerifiedAt) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }

    const now = new Date();
    if (session.user.suspendedUntil && session.user.suspendedUntil > now) {
      this.logger.warn(
        `refresh_blocked userId=${session.userId} reason=account_suspended`,
      );
      throw new ForbiddenException({
        message: 'account_suspended',
        suspendedUntil: session.user.suspendedUntil.toISOString(),
      });
    }

    const isValid = await this.tokenService.verifySecret(
      session.refreshTokenHash,
      secret,
    );

    if (!isValid) {
      // Reuse detected: revoke all user sessions as security measure
      await this.prisma.client.authSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `refresh_reused_detected userId=${session.userId} sessionId=${sessionId}`,
      );
      void this.auditService
        .log({
          eventType: 'refresh_reused_detected',
          userId: session.userId,
          sessionId,
          metadata: { reason: 'token_hash_mismatch' },
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      throw new UnauthorizedException('REFRESH_REUSED');
    }

    // Rotate: generate new secret, update session in-place
    const { token: newRefreshToken, secret: newSecret } =
      this.tokenService.generateRefreshToken(session.id);
    const newHash = await this.tokenService.hashSecret(newSecret);

    await this.prisma.client.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        lastUsedAt: new Date(),
      },
    });

    const accessToken = this.jwtService.sign({
      sub: session.user.id,
      role: session.user.role,
      sid: session.id,
    });

    this.logger.log(
      `refresh_success userId=${session.userId} sessionId=${session.id}`,
    );
    void this.auditService
      .log({
        eventType: 'refresh_success',
        userId: session.userId,
        sessionId: session.id,
      })
      .catch((err) => this.logger.warn('audit_log_failed', err));

    return { accessToken, refreshToken: newRefreshToken };
  }
}
