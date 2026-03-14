import {
  Controller,
  Get,
  Inject,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../infra/redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  /**
   * Liveness probe — responde 200 si el proceso está vivo.
   * No verifica dependencias externas. Usar para restart policies.
   */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness probe — responde 200 solo si la app puede servir tráfico.
   * Verifica DB y Redis. Usar para load balancer / ingress health checks.
   */
  @Get('ready')
  async ready() {
    const checks = await Promise.allSettled([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const db = checks[0];
    const redis = checks[1];

    const result = {
      status: 'ok' as 'ok' | 'degraded',
      db:
        db.status === 'fulfilled'
          ? db.value
          : { ok: false, error: String(db.reason) },
      redis:
        redis.status === 'fulfilled'
          ? redis.value
          : {
              ok: false,
              error: String(redis.reason),
            },
    };

    const dbOk = result.db.ok;
    // Redis failure is degraded (warn) not fatal — app can run without it
    const redisFailed = !result.redis.ok && this.redis !== null;

    if (!dbOk) {
      throw new ServiceUnavailableException(result);
    }

    if (redisFailed) {
      result.status = 'degraded';
    }

    return result;
  }

  private async checkDb(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    await this.prisma.client.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  }

  private async checkRedis(): Promise<{ ok: boolean; latencyMs?: number }> {
    if (this.redis === null) return { ok: false };
    const start = Date.now();
    await this.redis.ping();
    return { ok: true, latencyMs: Date.now() - start };
  }
}
