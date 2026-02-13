import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';

const DEFAULT_INTERVAL_MS = 3_600_000; // 1 hour

@Injectable()
export class IdempotencyCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IdempotencyCleanupService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.intervalMs =
      this.config.get<number>('IDEMPOTENCY_CLEANUP_INTERVAL_MS') ??
      DEFAULT_INTERVAL_MS;
  }

  onModuleInit() {
    this.intervalRef = setInterval(() => void this.cleanup(), this.intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async cleanup(): Promise<number> {
    const { count } = await this.prisma.client.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired idempotency records`);
    }

    return count;
  }
}
