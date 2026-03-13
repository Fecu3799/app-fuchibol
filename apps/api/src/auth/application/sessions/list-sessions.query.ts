import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';

@Injectable()
export class ListSessionsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.client.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        deviceId: true,
        deviceName: true,
        platform: true,
        appVersion: true,
        ip: true,
      },
    });

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === (currentSessionId ?? ''),
    }));
  }
}
