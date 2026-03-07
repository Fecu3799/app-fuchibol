-- CreateEnum
CREATE TYPE "PitchType" AS ENUM ('F5', 'F7', 'F9', 'F11');

-- CreateTable
CREATE TABLE "Venue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "addressText" TEXT,
    "mapsUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenuePitch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venueId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pitchType" "PitchType" NOT NULL,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenuePitch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "venueId" UUID,
                    ADD COLUMN "venuePitchId" UUID;

-- CreateIndex
CREATE INDEX "Venue_isActive_idx" ON "Venue"("isActive");

-- CreateIndex
CREATE INDEX "VenuePitch_pitchType_isActive_idx" ON "VenuePitch"("pitchType", "isActive");

-- CreateIndex
CREATE INDEX "VenuePitch_venueId_idx" ON "VenuePitch"("venueId");

-- AddForeignKey
ALTER TABLE "VenuePitch" ADD CONSTRAINT "VenuePitch_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_venuePitchId_fkey"
    FOREIGN KEY ("venuePitchId") REFERENCES "VenuePitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
