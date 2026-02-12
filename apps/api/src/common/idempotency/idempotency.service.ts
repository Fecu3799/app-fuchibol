import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface IdempotencyCheck<T> {
  key: string;
  actorId: string;
  route: string;
  matchId: string;
  execute: (tx: PrismaClient) => Promise<T>;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(params: IdempotencyCheck<T>): Promise<T> {
    const existing = await this.prisma.client.idempotencyRecord.findUnique({
      where: {
        key_actorId_route_matchId: {
          key: params.key,
          actorId: params.actorId,
          route: params.route,
          matchId: params.matchId,
        },
      },
    });

    if (existing) {
      return existing.responseJson as T;
    }

    const result = await params.execute(this.prisma.client);

    await this.prisma.client.idempotencyRecord.create({
      data: {
        key: params.key,
        actorId: params.actorId,
        route: params.route,
        matchId: params.matchId,
        responseJson: result as any,
      },
    });

    return result;
  }
}
