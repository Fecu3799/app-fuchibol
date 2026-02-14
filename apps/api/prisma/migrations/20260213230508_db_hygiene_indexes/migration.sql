-- DropIndex
DROP INDEX "MatchParticipant_userId_idx";

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_createdAt_idx" ON "MatchParticipant"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchParticipant_userId_matchId_idx" ON "MatchParticipant"("userId", "matchId");
