-- Add teamsAutoGenBlocked flag to Match
-- Prevents the scheduler from auto-generating teams when the creator has already
-- entered the TeamAssembly screen (even if they haven't saved yet).
ALTER TABLE "Match" ADD COLUMN "teamsAutoGenBlocked" BOOLEAN NOT NULL DEFAULT false;
