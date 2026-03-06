-- AddColumn reliabilityScore, reliabilityWindowStartedAt, suspendedUntil to User
ALTER TABLE "User" ADD COLUMN "reliabilityScore" SMALLINT NOT NULL DEFAULT 100;
ALTER TABLE "User" ADD COLUMN "reliabilityWindowStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
