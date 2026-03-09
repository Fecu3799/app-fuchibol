-- Add in_progress value to MatchStatus enum
-- Note: ADD VALUE cannot run inside a transaction in PostgreSQL; Prisma handles this correctly.
ALTER TYPE "MatchStatus" ADD VALUE 'in_progress' BEFORE 'played';
