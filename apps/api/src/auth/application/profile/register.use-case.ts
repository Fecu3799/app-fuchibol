import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PreferredPosition, SkillLevel, UserGender } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TokenService } from '../../infra/token.service';
import { EmailService } from '../../infra/email.service';
import { AuthAuditService } from '../../infra/auth-audit.service';

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{2,19}$/;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface RegisterInput {
  email: string;
  password: string;
  username?: string;
  acceptTerms: boolean;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: UserGender;
  preferredPosition?: PreferredPosition;
  skillLevel?: SkillLevel;
}

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(input: RegisterInput) {
    if (!input.acceptTerms) {
      throw new UnprocessableEntityException('TERMS_NOT_ACCEPTED');
    }

    const existing = await this.prisma.client.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const username = input.username
      ? this.normalizeUsername(input.username)
      : await this.generateUsername(input.email);

    const passwordHash = await argon2.hash(input.password);

    const rawToken = this.tokenService.generateEmailToken();
    const tokenHash = this.tokenService.hashEmailToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);

    const birthDate = input.birthDate ? new Date(input.birthDate) : undefined;

    const user = await this.prisma.client.user.create({
      data: {
        email: input.email,
        username,
        passwordHash,
        emailVerifiedAt: null,
        termsAcceptedAt: new Date(),
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(birthDate !== undefined && { birthDate }),
        ...(input.gender !== undefined && { gender: input.gender }),
        ...(input.preferredPosition !== undefined && {
          preferredPosition: input.preferredPosition,
        }),
        ...(input.skillLevel !== undefined && { skillLevel: input.skillLevel }),
        emailTokens: {
          create: { tokenHash, expiresAt },
        },
      },
    });

    await this.emailService.sendEmailVerification(user.email, rawToken);

    this.logger.log(`register_success userId=${user.id}`);
    void this.auditService
      .log({ eventType: 'register', userId: user.id })
      .catch((err) => this.logger.warn('audit_log_failed', err));

    return {
      message:
        'Registration successful. Check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }

  private normalizeUsername(raw: string): string {
    const username = raw.toLowerCase().trim();
    if (!USERNAME_REGEX.test(username)) {
      throw new ConflictException(
        'USERNAME_INVALID: 3-20 chars, [a-z0-9_], must start with letter or number',
      );
    }
    return username;
  }

  /** Derive username from email local part, appending suffix on collision. */
  async generateUsername(email: string): Promise<string> {
    const local = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    const base = local.length >= 3 ? local.slice(0, 20) : local.padEnd(3, '0');

    let candidate = base;
    let suffix = 2;
    while (
      await this.prisma.client.user.findUnique({
        where: { username: candidate },
      })
    ) {
      candidate = `${base}${suffix}`.slice(0, 20);
      suffix++;
    }

    return candidate;
  }
}
