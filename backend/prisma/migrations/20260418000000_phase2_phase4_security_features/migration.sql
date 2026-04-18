-- Phase 2 + Phase 4 schema additions
-- Backward compatible: every new column has a sensible default; existing data is preserved.

-- New enums (notification types + submission type + badge rarity)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_FOLLOWER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BADGE_AWARDED';

DO $$ BEGIN
  CREATE TYPE "SubmissionType" AS ENUM ('CSV', 'NOTEBOOK', 'SCRIPT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BadgeRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User: email verification + MFA + GDPR + counters
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified"            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "email_verify_token"        TEXT,
  ADD COLUMN IF NOT EXISTS "email_verify_exp"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "totp_secret"               TEXT,
  ADD COLUMN IF NOT EXISTS "totp_enabled"              BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totp_backup_codes"         TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "notification_preferences"  JSONB,
  ADD COLUMN IF NOT EXISTS "follower_count"            INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "following_count"           INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deleted_at"                TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_verify_token_key" ON "users"("email_verify_token");
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");

-- Treat all pre-existing OAuth users as verified (their provider verified them)
UPDATE "users" SET "email_verified" = true WHERE "google_id" IS NOT NULL OR "github_id" IS NOT NULL;

-- Submission: type + optional kernel URL
ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "submission_type" "SubmissionType" NOT NULL DEFAULT 'CSV',
  ADD COLUMN IF NOT EXISTS "kernel_url"      TEXT;

-- AuditLog
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          TEXT         PRIMARY KEY,
  "actor_id"    TEXT,
  "actor_role"  "Role",
  "action"      TEXT         NOT NULL,
  "resource"    TEXT         NOT NULL,
  "resource_id" TEXT,
  "metadata"    JSONB,
  "ip"          TEXT,
  "user_agent"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_resource_id_idx"  ON "audit_logs"("resource", "resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx"     ON "audit_logs"("action", "created_at");

-- Badge + UserBadge
CREATE TABLE IF NOT EXISTS "badges" (
  "id"          TEXT         PRIMARY KEY,
  "code"        TEXT         NOT NULL UNIQUE,
  "name"        TEXT         NOT NULL,
  "description" TEXT         NOT NULL,
  "icon_url"    TEXT,
  "rarity"      "BadgeRarity" NOT NULL DEFAULT 'COMMON',
  "rule"        JSONB,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "user_badges" (
  "id"         TEXT         PRIMARY KEY,
  "user_id"    TEXT         NOT NULL,
  "badge_id"   TEXT         NOT NULL,
  "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata"   JSONB,
  CONSTRAINT "user_badges_user_id_fkey"  FOREIGN KEY ("user_id")  REFERENCES "users"("id")  ON DELETE CASCADE,
  CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE,
  CONSTRAINT "user_badges_user_badge_unique" UNIQUE ("user_id", "badge_id")
);
CREATE INDEX IF NOT EXISTS "user_badges_badge_id_idx" ON "user_badges"("badge_id");

-- Follow
CREATE TABLE IF NOT EXISTS "follows" (
  "follower_id"  TEXT         NOT NULL,
  "following_id" TEXT         NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("follower_id", "following_id"),
  CONSTRAINT "follows_follower_id_fkey"  FOREIGN KEY ("follower_id")  REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "follows_no_self" CHECK ("follower_id" <> "following_id")
);
CREATE INDEX IF NOT EXISTS "follows_following_id_idx" ON "follows"("following_id");

-- Seed core badges (idempotent)
INSERT INTO "badges" ("id", "code", "name", "description", "rarity")
VALUES
  (gen_random_uuid()::text, 'FIRST_SUBMISSION', 'Lần nộp đầu tiên',     'Hoàn tất lần nộp bài đầu tiên',           'COMMON'),
  (gen_random_uuid()::text, 'TOP_10',           'Top 10',               'Lọt vào top 10 bảng xếp hạng công khai',  'UNCOMMON'),
  (gen_random_uuid()::text, 'COMPETITION_WINNER','Quán quân',           'Đạt hạng 1 bảng xếp hạng riêng tư',       'LEGENDARY'),
  (gen_random_uuid()::text, 'TEN_SUBMISSIONS',  'Bền bỉ',               'Nộp 10 bài',                              'COMMON'),
  (gen_random_uuid()::text, 'HUNDRED_SUBMISSIONS','Cần mẫn',            'Nộp 100 bài',                             'RARE'),
  (gen_random_uuid()::text, 'THOUSAND_SUBMISSIONS','Bậc thầy',          'Nộp 1000 bài',                            'EPIC'),
  (gen_random_uuid()::text, 'HELPFUL',          'Người hữu ích',         'Nhận 10 upvote trên thảo luận',           'UNCOMMON'),
  (gen_random_uuid()::text, 'EMAIL_VERIFIED',   'Đã xác minh email',     'Hoàn tất xác minh email',                 'COMMON'),
  (gen_random_uuid()::text, 'MFA_ENABLED',      'Bảo mật cao',           'Bật xác thực 2 yếu tố',                   'UNCOMMON'),
  (gen_random_uuid()::text, 'EARLY_ADOPTER',    'Người tiên phong',      'Đăng ký trong 100 user đầu tiên',         'RARE')
ON CONFLICT ("code") DO NOTHING;
