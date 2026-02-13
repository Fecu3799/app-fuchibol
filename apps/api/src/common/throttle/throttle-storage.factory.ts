import type { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Creates a ThrottlerStorage backed by Redis if `redisUrl` is provided and
 * reachable, otherwise falls back to a simple in-memory Map.
 *
 * This is a plain factory (no DI decorators) so it can be called from
 * ThrottlerModule.forRootAsync useFactory without extra inject tokens.
 */
export function createThrottleStorage(
  redisUrl: string,
  logger: Logger,
): ThrottlerStorage {
  const memStore = new Map<string, { totalHits: number; expiresAt: number }>();
  let redis: Redis | null = null;

  if (redisUrl) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      redis.on('error', (err: Error) => {
        logger.warn(`Redis error: ${err.message}`);
      });

      redis.on('connect', () => {
        logger.log('Throttle storage: Redis connected');
      });

      redis.connect().catch((err: Error) => {
        logger.warn(
          `Redis connect failed, throttler using in-memory: ${err.message}`,
        );
        redis = null;
      });
    } catch (err) {
      logger.warn(
        `Redis init failed, throttler using in-memory: ${(err as Error).message}`,
      );
      redis = null;
    }
  } else {
    logger.log('No REDIS_URL configured, throttler using in-memory storage');
  }

  // Periodically clean expired in-memory entries
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of memStore) {
      if (val.expiresAt <= now) memStore.delete(key);
    }
  }, 60_000);
  cleanup.unref();

  async function redisIncrement(
    key: string,
    ttlMs: number,
  ): Promise<StorageRecord> {
    const ttlSec = Math.ceil(ttlMs / 1000);
    const rKey = `throttle:${key}`;

    const totalHits = await redis!.incr(rKey);
    if (totalHits === 1) {
      await redis!.expire(rKey, ttlSec);
    }

    const pttl = await redis!.pttl(rKey);
    const timeToExpire = pttl > 0 ? pttl : ttlMs;

    return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
  }

  function memIncrement(key: string, ttlMs: number): StorageRecord {
    const now = Date.now();
    const existing = memStore.get(key);

    if (existing && existing.expiresAt > now) {
      existing.totalHits++;
      return {
        totalHits: existing.totalHits,
        timeToExpire: existing.expiresAt - now,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const record = { totalHits: 1, expiresAt: now + ttlMs };
    memStore.set(key, record);
    return {
      totalHits: 1,
      timeToExpire: ttlMs,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  return {
    async increment(
      key: string,
      ttl: number,
      _limit: number,
      _blockDuration: number,
      _throttlerName: string,
    ): Promise<StorageRecord> {
      if (redis) {
        try {
          return await redisIncrement(key, ttl);
        } catch (err) {
          logger.warn(
            `Redis throttle error, falling back to memory: ${(err as Error).message}`,
          );
        }
      }
      return memIncrement(key, ttl);
    },
  };
}
