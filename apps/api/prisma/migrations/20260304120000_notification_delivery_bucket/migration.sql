ALTER TABLE "NotificationDelivery" ADD COLUMN "bucket" TEXT;
CREATE INDEX "NotificationDelivery_userId_matchId_type_bucket_idx"
  ON "NotificationDelivery"("userId", "matchId", "type", "bucket");
