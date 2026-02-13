import 'dotenv/config';
import * as argon2 from 'argon2';
import { createPrismaWithPgAdapter } from '../src/infra/prisma/prisma-adapter.factory';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const { prisma, disconnect } = createPrismaWithPgAdapter(databaseUrl);

async function main() {
  const passwordHash = await argon2.hash('password123');

  await prisma.user.upsert({
    where: { email: 'dev@fuchibol.local' },
    update: {},
    create: {
      email: 'dev@fuchibol.local',
      passwordHash,
      role: 'USER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@fuchibol.local' },
    update: {},
    create: {
      email: 'admin@fuchibol.local',
      passwordHash,
      role: 'ADMIN',
    },
  });
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  })
  .finally(async () => {
    await disconnect();
  });
