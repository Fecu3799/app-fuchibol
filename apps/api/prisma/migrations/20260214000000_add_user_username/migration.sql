-- AlterTable: add username column (nullable first for backfill)
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill: derive username from email local part (lowercase, alphanumeric + underscore)
UPDATE "User"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-z0-9_]', '', 'g'))
WHERE "username" IS NULL;

-- Handle any remaining nulls (shouldn't happen but safety)
UPDATE "User"
SET "username" = 'user_' || LEFT(REPLACE(CAST("id" AS TEXT), '-', ''), 12)
WHERE "username" IS NULL OR LENGTH("username") < 3;

-- Handle collisions: append row_number for duplicates
WITH dupes AS (
  SELECT "id", "username",
    ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt") AS rn
  FROM "User"
)
UPDATE "User" u
SET "username" = u."username" || dupes.rn
FROM dupes
WHERE u."id" = dupes."id" AND dupes.rn > 1;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
