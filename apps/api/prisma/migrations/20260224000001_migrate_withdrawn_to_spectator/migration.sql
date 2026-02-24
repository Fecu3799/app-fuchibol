-- Migrate legacy WITHDRAWN status to SPECTATOR
UPDATE "MatchParticipant" SET status = 'SPECTATOR' WHERE status = 'WITHDRAWN';

-- Recreate enum without WITHDRAWN (Postgres doesn't support DROP VALUE directly)
CREATE TYPE "MatchParticipantStatus_new" AS ENUM ('INVITED', 'CONFIRMED', 'WAITLISTED', 'DECLINED', 'SPECTATOR');

ALTER TABLE "MatchParticipant"
  ALTER COLUMN status TYPE "MatchParticipantStatus_new"
  USING status::text::"MatchParticipantStatus_new";

DROP TYPE "MatchParticipantStatus";

ALTER TYPE "MatchParticipantStatus_new" RENAME TO "MatchParticipantStatus";
