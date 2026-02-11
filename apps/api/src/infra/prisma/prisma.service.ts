import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createPrismaWithPgAdapter } from './prisma-adapter.factory';

const resolveDatabaseUrl = () => {
  const isTest = process.env.NODE_ENV === 'test';
  const envKey = isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
  const databaseUrl = process.env[envKey];

  if (!databaseUrl) {
    throw new Error(`[PrismaService] Missing ${envKey} environment variable`);
  }

  return databaseUrl;
};

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private readonly disconnectFn: () => Promise<void>;

  constructor() {
    const databaseUrl = resolveDatabaseUrl();
    const { prisma, disconnect } = createPrismaWithPgAdapter(databaseUrl);
    this.prisma = prisma;
    this.disconnectFn = disconnect;
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.disconnectFn();
  }
}
