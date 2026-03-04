-- PushDevice: add deviceId (nullable)
ALTER TABLE "PushDevice" ADD COLUMN "deviceId" TEXT;
CREATE INDEX "PushDevice_deviceId_idx" ON "PushDevice"("deviceId");

-- NotificationDelivery: make matchId nullable + add groupId
ALTER TABLE "NotificationDelivery" ALTER COLUMN "matchId" DROP NOT NULL;
ALTER TABLE "NotificationDelivery" ADD COLUMN "groupId" UUID;
CREATE INDEX "NotificationDelivery_userId_groupId_type_createdAt_idx"
  ON "NotificationDelivery"("userId", "groupId", "type", "createdAt");
