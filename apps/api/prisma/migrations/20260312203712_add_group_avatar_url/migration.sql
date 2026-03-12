-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userAId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_userBId_fkey";

-- AlterTable
ALTER TABLE "ConversationReadState" ALTER COLUMN "lastReadAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "avatarUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
