-- Add teamsConfigured flag to Match
ALTER TABLE "Match" ADD COLUMN "teamsConfigured" BOOLEAN NOT NULL DEFAULT false;

-- Create MatchTeamSlot table
CREATE TABLE "MatchTeamSlot" (
  "id"        UUID    NOT NULL DEFAULT gen_random_uuid(),
  "matchId"   UUID    NOT NULL,
  "team"      TEXT    NOT NULL,
  "slotIndex" INTEGER NOT NULL,
  "userId"    UUID,

  CONSTRAINT "MatchTeamSlot_pkey" PRIMARY KEY ("id")
);

-- Unique constraint per (match, team, slot)
CREATE UNIQUE INDEX "MatchTeamSlot_matchId_team_slotIndex_key"
  ON "MatchTeamSlot"("matchId", "team", "slotIndex");

-- Index for listing a match's team slots
CREATE INDEX "MatchTeamSlot_matchId_team_idx"
  ON "MatchTeamSlot"("matchId", "team");

-- Foreign key: match → cascade delete
ALTER TABLE "MatchTeamSlot"
  ADD CONSTRAINT "MatchTeamSlot_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key: user → set null when user deleted
ALTER TABLE "MatchTeamSlot"
  ADD CONSTRAINT "MatchTeamSlot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
