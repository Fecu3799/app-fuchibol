import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../../src/infra/prisma/prisma.service';

export async function truncateAll(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.client.$executeRawUnsafe(`
    TRUNCATE TABLE
      "IdempotencyRecord",
      "AuthSession",
      "EmailVerificationToken",
      "MatchParticipant",
      "Match",
      "User"
    CASCADE
  `);
}

/** Bypass email verification in e2e tests by directly setting emailVerifiedAt. */
export async function verifyEmailInDb(
  app: INestApplication,
  email: string,
): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.client.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date() },
  });
}
