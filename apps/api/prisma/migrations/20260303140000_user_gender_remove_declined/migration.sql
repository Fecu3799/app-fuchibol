-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable: add gender NOT NULL with default MALE (backfills all existing rows)
ALTER TABLE "User" ADD COLUMN "gender" "UserGender" NOT NULL DEFAULT 'MALE';

-- Data cleanup: remove all DECLINED participant rows before altering the enum
DELETE FROM "MatchParticipant" WHERE status = 'DECLINED';

-- Recreate MatchParticipantStatus without DECLINED
-- (Postgres does not support DROP VALUE from an enum; standard pattern: rename + new + cast)
ALTER TYPE "MatchParticipantStatus" RENAME TO "MatchParticipantStatus_old";
CREATE TYPE "MatchParticipantStatus" AS ENUM ('INVITED', 'CONFIRMED', 'WAITLISTED', 'SPECTATOR');
ALTER TABLE "MatchParticipant"
  ALTER COLUMN status TYPE "MatchParticipantStatus"
  USING (status::text::"MatchParticipantStatus");
DROP TYPE "MatchParticipantStatus_old";
