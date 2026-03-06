-- Add OTHER value to UserGender enum
ALTER TYPE "UserGender" ADD VALUE IF NOT EXISTS 'OTHER';

-- Create PreferredPosition enum
CREATE TYPE "PreferredPosition" AS ENUM ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');

-- Create SkillLevel enum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'AMATEUR', 'REGULAR', 'SEMIPRO', 'PRO');

-- Add new profile columns and termsAcceptedAt to User
ALTER TABLE "User"
  ADD COLUMN "firstName"         TEXT,
  ADD COLUMN "lastName"          TEXT,
  ADD COLUMN "birthDate"         DATE,
  ADD COLUMN "preferredPosition" "PreferredPosition",
  ADD COLUMN "skillLevel"        "SkillLevel",
  ADD COLUMN "termsAcceptedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Make gender nullable and drop the default
ALTER TABLE "User"
  ALTER COLUMN "gender" DROP NOT NULL,
  ALTER COLUMN "gender" DROP DEFAULT;
