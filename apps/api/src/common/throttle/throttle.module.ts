import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { createThrottleStorage } from './throttle-storage.factory';
import { AppThrottleGuard } from '../guards/app-throttle.guard';

/**
 * Three named throttler profiles:
 *   - login:     strict  (5 req / 10 min)  — override on auth endpoints
 *   - mutations: moderate (30 req / 1 min)  — override on mutation endpoints
 *   - reads:     soft   (120 req / 1 min)  — global default
 *
 * Storage is created inline (Redis with in-memory fallback) so there are
 * no extra DI dependencies beyond ConfigService.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('ThrottleModule');
        const redisUrl = config.get<string>('REDIS_URL', '');
        const storage = createThrottleStorage(redisUrl, logger);

        return {
          throttlers: [
            {
              name: 'login',
              ttl: config.get<number>('THROTTLE_LOGIN_TTL', 600_000),
              limit: config.get<number>('THROTTLE_LOGIN_LIMIT', 5),
            },
            {
              name: 'mutations',
              ttl: config.get<number>('THROTTLE_MUTATIONS_TTL', 60_000),
              limit: config.get<number>('THROTTLE_MUTATIONS_LIMIT', 30),
            },
            {
              name: 'reads',
              ttl: config.get<number>('THROTTLE_READS_TTL', 60_000),
              limit: config.get<number>('THROTTLE_READS_LIMIT', 120),
            },
          ],
          storage,
        };
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottleGuard,
    },
  ],
})
export class AppThrottleModule {}
