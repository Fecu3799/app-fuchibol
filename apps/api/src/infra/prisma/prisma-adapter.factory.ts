import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

export interface PrismaAdapterInstance {
  prisma: PrismaClient;
  disconnect: () => Promise<void>;
}

export const createPrismaWithPgAdapter = (
  databaseUrl: string,
): PrismaAdapterInstance => {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const disconnect = async () => {
    await prisma.$disconnect();
    await pool.end();
  };

  return { prisma, disconnect };
};
