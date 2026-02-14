import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infra/prisma/prisma.service';

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{2,19}$/;

export interface RegisterInput {
  email: string;
  password: string;
  username?: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: RegisterInput) {
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

    const user = await this.prisma.client.user.create({
      data: {
        email: input.email,
        username,
        passwordHash,
      },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
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

    // Try base first, then base2, base3, ...
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
