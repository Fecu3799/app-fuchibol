import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface RegisterInput {
  email: string;
  password: string;
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

    const passwordHash = await argon2.hash(input.password);

    const user = await this.prisma.client.user.create({
      data: {
        email: input.email,
        passwordHash,
      },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
