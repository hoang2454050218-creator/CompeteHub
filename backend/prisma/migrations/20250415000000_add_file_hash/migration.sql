-- Add file_hash column for proper duplicate submission detection
ALTER TABLE "submissions" ADD COLUMN "file_hash" TEXT;

-- Backfill existing submissions: extract hash from description field
UPDATE "submissions"
SET "file_hash" = SUBSTRING("description" FROM '^hash:([a-f0-9]{64})')
WHERE "description" LIKE 'hash:%';

-- Clean up description field by removing the hash prefix
UPDATE "submissions"
SET "description" = NULLIF(TRIM(REGEXP_REPLACE("description", '^hash:[a-f0-9]{64}\s*', '')), '')
WHERE "description" LIKE 'hash:%';
