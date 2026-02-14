/**
 * Acquires a Postgres row-level exclusive lock (FOR UPDATE) on a Match row
 * inside an interactive Prisma transaction.
 *
 * This prevents the classic read-check-write race condition under
 * READ COMMITTED isolation: concurrent transactions will WAIT on this
 * lock until the holder commits or rolls back, then re-read the latest
 * data and proceed.
 *
 * Usage: call BEFORE `tx.match.findUnique()` inside `$transaction`.
 */
import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export async function lockMatchRow(
  tx: TransactionClient,
  matchId: string,
): Promise<void> {
  await (tx as any).$queryRawUnsafe(
    'SELECT 1 FROM "Match" WHERE "id" = $1::uuid FOR UPDATE',
    matchId,
  );
}
