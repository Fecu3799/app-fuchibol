-- Migration: notification_delivery_v2
-- Adds orchestration fields to NotificationDelivery for push.service.ts
-- All new columns are nullable → backward compatible with existing rows.

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "channel"           TEXT,
  ADD COLUMN "dedupeKey"         TEXT,
  ADD COLUMN "status"            TEXT,
  ADD COLUMN "reason"            TEXT,
  ADD COLUMN "conversationId"    UUID,
  ADD COLUMN "payload"           JSONB,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "sentAt"            TIMESTAMPTZ;

-- Unique index on (channel, dedupeKey).
-- Postgres treats NULL != NULL in unique indexes, so existing rows
-- with (null, null) do NOT conflict with each other. ✓
CREATE UNIQUE INDEX "NotificationDelivery_channel_dedupeKey_key"
  ON "NotificationDelivery"("channel", "dedupeKey");
