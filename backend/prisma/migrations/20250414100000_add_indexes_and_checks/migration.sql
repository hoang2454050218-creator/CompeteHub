-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS "teams_leader_id_idx" ON "teams"("leader_id");
CREATE INDEX IF NOT EXISTS "team_invitations_receiver_id_status_idx" ON "team_invitations"("receiver_id", "status");
CREATE INDEX IF NOT EXISTS "team_invitations_sender_id_idx" ON "team_invitations"("sender_id");
CREATE INDEX IF NOT EXISTS "competitions_host_id_idx" ON "competitions"("host_id");
CREATE INDEX IF NOT EXISTS "competitions_category_status_idx" ON "competitions"("category", "status");
CREATE INDEX IF NOT EXISTS "enrollments_team_id_idx" ON "enrollments"("team_id");
CREATE INDEX IF NOT EXISTS "submissions_status_idx" ON "submissions"("status");

-- Add trigram index for competition search (requires pg_trgm from init.sql)
CREATE INDEX IF NOT EXISTS "idx_competitions_title_trgm" ON "competitions" USING GIN ("title" gin_trgm_ops);

-- Add CHECK constraints for data integrity
ALTER TABLE "competitions" ADD CONSTRAINT "chk_pub_priv_split" CHECK ("pub_priv_split" > 0 AND "pub_priv_split" < 1);
ALTER TABLE "competitions" ADD CONSTRAINT "chk_max_team_size" CHECK ("max_team_size" >= 1);
ALTER TABLE "competitions" ADD CONSTRAINT "chk_max_daily_subs" CHECK ("max_daily_subs" >= 1);
ALTER TABLE "competitions" ADD CONSTRAINT "chk_max_file_size" CHECK ("max_file_size" > 0);
ALTER TABLE "votes" ADD CONSTRAINT "chk_vote_value" CHECK ("value" IN (1, -1));
ALTER TABLE "discussions" ADD CONSTRAINT "chk_upvote_nonneg" CHECK ("upvote_count" >= 0);
ALTER TABLE "discussion_replies" ADD CONSTRAINT "chk_reply_upvote_nonneg" CHECK ("upvote_count" >= 0);
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "chk_sub_count_nonneg" CHECK ("submission_count" >= 0);
