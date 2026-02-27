import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ActorPayload } from '../interfaces/actor-payload.interface';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.getOrThrow<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; role: string; sid?: string }): Promise<ActorPayload> {
    if (payload.sid) {
      const session = await this.prisma.client.authSession.findUnique({
        where: { id: payload.sid },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
        throw new UnauthorizedException('SESSION_REVOKED');
      }
    }
    return { userId: payload.sub, role: payload.role, sessionId: payload.sid };
  }
}
