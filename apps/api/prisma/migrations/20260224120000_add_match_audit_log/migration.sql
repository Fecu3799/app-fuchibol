CREATE TABLE "MatchAuditLog" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "matchId"   UUID NOT NULL,
  "actorId"   UUID,
  "type"      TEXT NOT NULL,
  "metadata"  JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MatchAuditLog"
  ADD CONSTRAINT "MatchAuditLog_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchAuditLog"
  ADD CONSTRAINT "MatchAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MatchAuditLog_matchId_createdAt_idx"
  ON "MatchAuditLog"("matchId", "createdAt" DESC);
