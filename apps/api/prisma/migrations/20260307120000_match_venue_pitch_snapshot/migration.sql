-- AlterTable: add venue/pitch snapshot columns to Match for historical stability
ALTER TABLE "Match"
  ADD COLUMN "venueSnapshot" JSONB,
  ADD COLUMN "pitchSnapshot" JSONB;
