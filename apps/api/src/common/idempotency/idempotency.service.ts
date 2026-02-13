import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const DEFAULT_TTL_MS = 172_800_000; // 48 hours

export interface IdempotencyCheck<T> {
  key: string;
  actorId: string;
  route: string;
  matchId?: string;
  requestBody: unknown;
  execute: (tx: PrismaClient) => Promise<T>;
}

export function computeRequestHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

@Injectable()
export class IdempotencyService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.ttlMs =
      this.config.get<number>('IDEMPOTENCY_TTL_MS') ?? DEFAULT_TTL_MS;
  }

  async run<T>(params: IdempotencyCheck<T>): Promise<T> {
    const requestHash = computeRequestHash(params.requestBody);

    const existing = await this.prisma.client.idempotencyRecord.findUnique({
      where: {
        key_actorId_route: {
          key: params.key,
          actorId: params.actorId,
          route: params.route,
        },
      },
    });

    if (existing) {
      if (existing.expiresAt <= new Date()) {
        // Expired — delete and re-execute
        await this.prisma.client.idempotencyRecord.delete({
          where: { id: existing.id },
        });
      } else if (existing.requestHash !== requestHash) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSE');
      } else {
        // Valid cache hit — replay
        return existing.responseJson as T;
      }
    }

    const result = await params.execute(this.prisma.client);

    await this.prisma.client.idempotencyRecord.create({
      data: {
        key: params.key,
        actorId: params.actorId,
        route: params.route,
        matchId: params.matchId ?? null,
        requestHash,
        responseJson: result as any,
        expiresAt: new Date(Date.now() + this.ttlMs),
      },
    });

    return result;
  }
}
