-- Add UNIQUE constraint to prevent duplicate submission race condition (audit fix H-01)
-- NULL values in file_hash are allowed multiple times (Postgres default behavior)
-- so older submissions without file_hash are not affected.

CREATE UNIQUE INDEX "unique_user_comp_hash" ON "submissions"("user_id", "competition_id", "file_hash");