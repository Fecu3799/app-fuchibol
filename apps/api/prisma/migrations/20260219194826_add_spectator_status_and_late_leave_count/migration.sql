-- AlterEnum
ALTER TYPE "MatchParticipantStatus" ADD VALUE 'SPECTATOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lateLeaveCount" INTEGER NOT NULL DEFAULT 0;
