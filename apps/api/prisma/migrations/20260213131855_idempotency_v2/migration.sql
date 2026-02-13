-- Idempotency v2: add requestHash, statusCode, expiresAt; simplify unique constraint

-- 1. Clear transient cache records (safe: idempotency records are ephemeral)
DELETE FROM "IdempotencyRecord";

-- 2. Drop old unique constraint and index
DROP INDEX IF EXISTS "IdempotencyRecord_key_actorId_route_matchId_key";
DROP INDEX IF EXISTS "IdempotencyRecord_createdAt_idx";

-- 3. Drop old columns
ALTER TABLE "IdempotencyRecord" DROP COLUMN IF EXISTS "status";

-- 4. Make matchId nullable
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "matchId" DROP NOT NULL;

-- 5. Add new columns
ALTER TABLE "IdempotencyRecord" ADD COLUMN "requestHash" TEXT NOT NULL;
ALTER TABLE "IdempotencyRecord" ADD COLUMN "statusCode" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "IdempotencyRecord" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;

-- 6. New unique constraint and index
CREATE UNIQUE INDEX "IdempotencyRecord_key_actorId_route_key" ON "IdempotencyRecord"("key", "actorId", "route");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
