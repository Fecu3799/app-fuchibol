import {
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TokenService } from '../../infra/token.service';
import { AuthAuditService } from '../../infra/auth-audit.service';
import { MetricsService } from '../../../metrics/metrics.service';

const REFRESH_TOKEN_TTL_DAYS = 30;

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
}

export interface LoginInput {
  identifier: string; // email or username
  password: string;
  device?: DeviceInfo;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuthAuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(input: LoginInput) {
    const isEmail = input.identifier.includes('@');
    const user = isEmail
      ? await this.prisma.client.user.findUnique({
          where: { email: input.identifier.toLowerCase().trim() },
        })
      : await this.prisma.client.user.findUnique({
          where: { username: input.identifier.toLowerCase().trim() },
        });

    if (!user) {
      this.logger.warn({ op: 'loginFailed', reasonCode: 'USER_NOT_FOUND' });
      this.metrics?.incCounter('auth_login_failed_total', {
        reasonCode: 'USER_NOT_FOUND',
      });
      void this.auditService
        .log({
          eventType: 'login_failed',
          userId: null,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { reason: 'not_found' },
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      this.logger.warn({
        op: 'loginFailed',
        actorUserId: user.id,
        reasonCode: 'INVALID_PASSWORD',
      });
      this.metrics?.incCounter('auth_login_failed_total', {
        reasonCode: 'INVALID_PASSWORD',
      });
      void this.auditService
        .log({
          eventType: 'login_failed',
          userId: user.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { reason: 'wrong_password' },
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.bannedAt !== null) {
      this.logger.warn({
        op: 'loginFailed',
        actorUserId: user.id,
        reasonCode: 'USER_BANNED',
      });
      this.metrics?.incCounter('auth_login_failed_total', {
        reasonCode: 'USER_BANNED',
      });
      void this.auditService
        .log({
          eventType: 'login_failed',
          userId: user.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { reason: 'banned' },
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      throw new ForbiddenException('USER_BANNED');
    }

    if (!user.emailVerifiedAt) {
      this.logger.warn({
        op: 'loginFailed',
        actorUserId: user.id,
        reasonCode: 'EMAIL_NOT_VERIFIED',
      });
      this.metrics?.incCounter('auth_login_failed_total', {
        reasonCode: 'EMAIL_NOT_VERIFIED',
      });
      void this.auditService
        .log({
          eventType: 'login_failed',
          userId: user.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { reason: 'email_not_verified' },
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }

    const now = new Date();
    if (user.suspendedUntil && user.suspendedUntil > now) {
      this.logger.warn({
        op: 'loginFailed',
        actorUserId: user.id,
        reasonCode: 'ACCOUNT_SUSPENDED',
      });
      this.metrics?.incCounter('auth_login_failed_total', {
        reasonCode: 'ACCOUNT_SUSPENDED',
      });
      void this.auditService
        .log({
          eventType: 'login_failed',
          userId: user.id,
          ip: input.ip,
          userAgent: input.userAgent,
          metadata: { reason: 'account_suspended' },
        })
        .catch((err) => this.logger.warn('audit_log_failed', err));
      throw new ForbiddenException({
        message: 'account_suspended',
        suspendedUntil: user.suspendedUntil.toISOString(),
      });
    }

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    // Create session placeholder first to get the sessionId for the token
    const session = await this.prisma.client.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: '', // updated below once we have the secret
        expiresAt,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        deviceId: input.device?.deviceId ?? null,
        deviceName: input.device?.deviceName ?? null,
        platform: input.device?.platform ?? null,
        appVersion: input.device?.appVersion ?? null,
      },
    });

    const { token: refreshToken, secret } =
      this.tokenService.generateRefreshToken(session.id);
    const refreshTokenHash = await this.tokenService.hashSecret(secret);

    await this.prisma.client.authSession.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
      sid: session.id,
    });

    this.logger.log({
      op: 'loginSuccess',
      actorUserId: user.id,
      sessionId: session.id,
    });
    this.metrics?.incCounter('auth_login_success_total');
    void this.auditService
      .log({
        eventType: 'login_success',
        userId: user.id,
        sessionId: session.id,
        ip: input.ip,
        userAgent: input.userAgent,
      })
      .catch((err) => this.logger.warn('audit_log_failed', err));

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
