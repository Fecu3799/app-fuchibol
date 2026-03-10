-- Add direct conversation support to Conversation table

ALTER TABLE "Conversation" ADD COLUMN "userAId" UUID;
ALTER TABLE "Conversation" ADD COLUMN "userBId" UUID;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_userAId_fkey"
  FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_userBId_fkey"
  FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_userAId_userBId_key"
  UNIQUE ("userAId", "userBId");
