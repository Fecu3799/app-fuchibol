-- AlterTable
ALTER TABLE "MatchParticipant" ADD COLUMN     "adminGrantedAt" TIMESTAMP(3),
ADD COLUMN     "isMatchAdmin" BOOLEAN NOT NULL DEFAULT false;
