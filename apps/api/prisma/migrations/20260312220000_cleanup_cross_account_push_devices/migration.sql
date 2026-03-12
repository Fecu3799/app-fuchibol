-- Data migration: remove cross-account push device associations.
--
-- Root cause: logout did not previously disassociate PushDevice rows, so a
-- device could remain associated with a logged-out user while a new user
-- logged in on the same physical device. This left stale rows that caused
-- the device to receive push notifications for the old account.
--
-- Fix: for each deviceId that has rows belonging to multiple users, keep only
-- the most recently seen row and delete the rest. This ensures each physical
-- device is associated with at most one user in the database.

DELETE FROM "PushDevice"
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "deviceId"
        ORDER BY "lastSeenAt" DESC
      ) AS rn
    FROM "PushDevice"
    WHERE "deviceId" IS NOT NULL
  ) ranked
  WHERE rn > 1
);
