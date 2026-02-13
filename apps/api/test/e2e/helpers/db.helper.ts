import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../../src/infra/prisma/prisma.service';

export async function truncateAll(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "IdempotencyRecord",
      "MatchParticipant",
      "Match",
      "User"
    CASCADE
  `);
}
