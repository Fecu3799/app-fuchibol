-- AlterTable
ALTER TABLE "MatchTeamSlot" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Venue" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "VenuePitch" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "matchId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "clientMsgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

-- CreateIndex
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_senderId_clientMsgId_key" ON "Message"("conversationId", "senderId", "clientMsgId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: create a MATCH conversation for every existing match
INSERT INTO "Conversation" ("id", "type", "matchId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'MATCH', "id", "createdAt", now()
FROM "Match"
ON CONFLICT ("matchId") DO NOTHING;
