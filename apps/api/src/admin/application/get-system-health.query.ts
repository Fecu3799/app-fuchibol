import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../../infra/redis/redis.module';
import type Redis from 'ioredis';

@Injectable()
export class GetSystemHealthQuery {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async execute() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [dbStatus, lastTickAt, deliveredL1h, disabledDevices] =
      await Promise.all([
        this.prisma.client.$queryRaw`SELECT 1`
          .then(() => 'ok')
          .catch(() => 'error'),
        this.redis
          ? this.redis.get('lifecycle:lastTickAt').catch(() => null)
          : Promise.resolve(null),
        this.prisma.client.notificationDelivery.count({
          where: { createdAt: { gte: oneHourAgo } },
        }),
        this.prisma.client.pushDevice.count({
          where: { disabledAt: { not: null } },
        }),
      ]);

    const cronStatus = lastTickAt
      ? new Date(lastTickAt).getTime() > now.getTime() - 2 * 60 * 1000
        ? 'ok'
        : 'stale'
      : 'unknown';

    return {
      cron: { status: cronStatus, lastTickAt: lastTickAt ?? null },
      notifications: { deliveredL1h, disabledDevices },
      db: { status: dbStatus },
    };
  }
}
