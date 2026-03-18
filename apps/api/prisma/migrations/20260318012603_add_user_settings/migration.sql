-- AlterTable
ALTER TABLE "NotificationDelivery" ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" UUID NOT NULL,
    "pushMatchReminders" BOOLEAN NOT NULL DEFAULT true,
    "pushMatchChanges" BOOLEAN NOT NULL DEFAULT true,
    "pushChatMessages" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
