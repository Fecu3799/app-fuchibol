import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService): Redis | null => {
        const logger = new Logger('RedisModule');
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');

        try {
          const client = new Redis(url, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableOfflineQueue: false,
          });

          client.on('error', (err: Error) => {
            logger.warn(`Redis error: ${err.message}`);
          });

          client.on('connect', () => {
            logger.log('Redis connected');
          });

          // Fire-and-forget connect; if it fails the client stays disconnected
          client.connect().catch((err: Error) => {
            logger.warn(`Redis connect failed (throttler will use in-memory fallback): ${err.message}`);
          });

          return client;
        } catch (err) {
          logger.warn(
            `Redis init failed (throttler will use in-memory fallback): ${(err as Error).message}`,
          );
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
