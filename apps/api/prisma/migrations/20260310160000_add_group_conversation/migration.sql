-- Add groupId to Conversation for GROUP chat support
ALTER TABLE "Conversation" ADD COLUMN "groupId" UUID;

-- Unique constraint: one conversation per group
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_groupId_key" UNIQUE ("groupId");

-- Foreign key with cascade delete: deleting a group removes its conversation
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: create a GROUP conversation for every existing group that doesn't have one
INSERT INTO "Conversation" ("id", "type", "groupId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'GROUP', g."id", NOW(), NOW()
FROM "Group" g
WHERE g."id" NOT IN (
  SELECT "groupId" FROM "Conversation" WHERE "groupId" IS NOT NULL
);
