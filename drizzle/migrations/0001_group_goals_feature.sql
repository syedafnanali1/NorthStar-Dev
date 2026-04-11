-- Migration: 0001_group_goals_feature
-- Adds the complete Group Goals feature schema.
-- Run via: npm run db:migrate
-- Or apply manually against your Neon/Postgres database.

-- ─── NEW ENUMS ────────────────────────────────────────────────────────────────

CREATE TYPE "group_type" AS ENUM ('public', 'private');
CREATE TYPE "group_member_role" AS ENUM ('owner', 'admin', 'member');
CREATE TYPE "group_member_status" AS ENUM ('active', 'pending', 'banned');
CREATE TYPE "group_goal_created_via" AS ENUM ('ai', 'manual');
CREATE TYPE "group_goal_tracking_frequency" AS ENUM ('daily', 'weekly', 'monthly', 'yearly', 'custom');
CREATE TYPE "group_goal_status" AS ENUM ('active', 'completed', 'archived');
CREATE TYPE "group_engagement_action" AS ENUM (
  'post_comment',
  'react',
  'complete_goal',
  'invite_member',
  'join_group',
  'add_to_calendar'
);

-- ─── ALTER USERS ──────────────────────────────────────────────────────────────
-- Adds group engagement counters and behavioral profile blob to every user.
-- All integer columns default to 0 so existing rows require no backfill.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "groups_joined"                 INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "group_goals_completed"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "group_comments_posted"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "group_reactions_given"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "group_invites_sent"            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "group_invites_accepted"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_group_engagement_score"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_group_active_at"          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "group_behavior_profile"        JSONB NOT NULL DEFAULT '{}';

-- ─── GROUPS ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "groups" (
  "id"               TEXT        PRIMARY KEY DEFAULT CONCAT('grp_', gen_random_uuid()::TEXT),
  "name"             TEXT        NOT NULL,
  "description"      TEXT,
  "type"             "group_type" NOT NULL DEFAULT 'public',
  "created_by"       TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "cover_image"      TEXT,
  "member_count"     INTEGER     NOT NULL DEFAULT 0,
  "engagement_score" INTEGER     NOT NULL DEFAULT 0,
  "popularity_rank"  INTEGER,
  "is_archived"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "groups_type_idx"    ON "groups"("type");
CREATE INDEX IF NOT EXISTS "groups_creator_idx" ON "groups"("created_by");
CREATE INDEX IF NOT EXISTS "groups_rank_idx"    ON "groups"("popularity_rank");

-- ─── GROUP MEMBERS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "group_members" (
  "id"               TEXT                  PRIMARY KEY DEFAULT CONCAT('gmbr_', gen_random_uuid()::TEXT),
  "group_id"         TEXT                  NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id"          TEXT                  NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"             "group_member_role"   NOT NULL DEFAULT 'member',
  "status"           "group_member_status" NOT NULL DEFAULT 'active',
  "invited_by"       TEXT                  REFERENCES "users"("id") ON DELETE SET NULL,
  "joined_at"        TIMESTAMP             NOT NULL DEFAULT NOW(),
  "last_active_at"   TIMESTAMP,
  "engagement_score" INTEGER               NOT NULL DEFAULT 0,
  "goals_completed"  INTEGER               NOT NULL DEFAULT 0,
  "comments_posted"  INTEGER               NOT NULL DEFAULT 0,
  "reactions_given"  INTEGER               NOT NULL DEFAULT 0,
  CONSTRAINT "group_members_unique_idx" UNIQUE ("group_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "group_members_group_idx"  ON "group_members"("group_id");
CREATE INDEX IF NOT EXISTS "group_members_user_idx"   ON "group_members"("user_id");
CREATE INDEX IF NOT EXISTS "group_members_status_idx" ON "group_members"("group_id", "status");

-- ─── GROUP INVITES ────────────────────────────────────────────────────────────
-- Exactly one of invitee_user_id or invitee_email must be non-null (enforced in app layer).

CREATE TABLE IF NOT EXISTS "group_invites" (
  "id"               TEXT                  PRIMARY KEY DEFAULT CONCAT('ginv_', gen_random_uuid()::TEXT),
  "group_id"         TEXT                  NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "invited_by"       TEXT                  NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "invitee_user_id"  TEXT                  REFERENCES "users"("id") ON DELETE CASCADE,
  "invitee_email"    TEXT,
  "status"           "invitation_status"   NOT NULL DEFAULT 'pending',
  "sent_at"          TIMESTAMP             NOT NULL DEFAULT NOW(),
  "expires_at"       TIMESTAMP             NOT NULL
);

CREATE INDEX IF NOT EXISTS "group_invites_group_idx"         ON "group_invites"("group_id");
CREATE INDEX IF NOT EXISTS "group_invites_inviter_idx"       ON "group_invites"("invited_by");
CREATE INDEX IF NOT EXISTS "group_invites_invitee_user_idx"  ON "group_invites"("invitee_user_id");
CREATE INDEX IF NOT EXISTS "group_invites_status_idx"        ON "group_invites"("group_id", "status");

-- ─── GROUP JOIN REQUESTS (public groups only) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "group_join_requests" (
  "id"           TEXT                             PRIMARY KEY DEFAULT CONCAT('gjr_', gen_random_uuid()::TEXT),
  "group_id"     TEXT                             NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "requester_id" TEXT                             NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status"       "group_goal_join_request_status" NOT NULL DEFAULT 'pending',
  "note"         TEXT,
  "requested_at" TIMESTAMP                        NOT NULL DEFAULT NOW(),
  "reviewed_by"  TEXT                             REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at"  TIMESTAMP,
  CONSTRAINT "group_join_requests_unique_idx" UNIQUE ("group_id", "requester_id")
);

CREATE INDEX IF NOT EXISTS "group_join_requests_group_status_idx" ON "group_join_requests"("group_id", "status");
CREATE INDEX IF NOT EXISTS "group_join_requests_requester_idx"    ON "group_join_requests"("requester_id");

-- ─── GROUP GOAL ITEMS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "group_goal_items" (
  "id"                     TEXT                             PRIMARY KEY DEFAULT CONCAT('ggi_', gen_random_uuid()::TEXT),
  "group_id"               TEXT                             NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "title"                  TEXT                             NOT NULL,
  "description"            TEXT,
  "category"               "goal_category"                  NOT NULL,
  "created_by"             TEXT                             NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_via"            "group_goal_created_via"         NOT NULL DEFAULT 'manual',
  "tracking_frequency"     "group_goal_tracking_frequency"  NOT NULL DEFAULT 'daily',
  "custom_frequency_label" TEXT,
  "start_date"             TIMESTAMP,
  "end_date"               TIMESTAMP,
  "milestones"             JSONB                            NOT NULL DEFAULT '[]',
  "status"                 "group_goal_status"              NOT NULL DEFAULT 'active',
  "target_value"           REAL,
  "current_value"          REAL                             NOT NULL DEFAULT 0,
  "unit"                   TEXT,
  "emoji"                  TEXT,
  "color"                  TEXT                             NOT NULL DEFAULT '#C4963A',
  "created_at"             TIMESTAMP                        NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMP                        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "group_goal_items_group_idx"   ON "group_goal_items"("group_id");
CREATE INDEX IF NOT EXISTS "group_goal_items_creator_idx" ON "group_goal_items"("created_by");
CREATE INDEX IF NOT EXISTS "group_goal_items_status_idx"  ON "group_goal_items"("group_id", "status");

-- ─── GROUP CHAT POSTS ─────────────────────────────────────────────────────────
-- content word count <= 100 is enforced in the API layer, not the DB.

CREATE TABLE IF NOT EXISTS "group_chat_posts" (
  "id"         TEXT      PRIMARY KEY DEFAULT CONCAT('gcp_', gen_random_uuid()::TEXT),
  "group_id"   TEXT      NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "author_id"  TEXT      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content"    TEXT      NOT NULL,
  "reactions"  JSONB     NOT NULL DEFAULT '[]',
  "edited_at"  TIMESTAMP,
  "is_deleted" BOOLEAN   NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "group_chat_posts_group_idx"      ON "group_chat_posts"("group_id");
CREATE INDEX IF NOT EXISTS "group_chat_posts_author_idx"     ON "group_chat_posts"("author_id");
CREATE INDEX IF NOT EXISTS "group_chat_posts_created_at_idx" ON "group_chat_posts"("group_id", "created_at");

-- ─── GROUP ENGAGEMENT LOGS ────────────────────────────────────────────────────
-- Append-only. Never update or delete rows.
-- Every group action writes here + increments the relevant users counter.

CREATE TABLE IF NOT EXISTS "group_engagement_logs" (
  "id"        TEXT                      PRIMARY KEY DEFAULT CONCAT('gel_', gen_random_uuid()::TEXT),
  "user_id"   TEXT                      NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id"  TEXT                      NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "action"    "group_engagement_action" NOT NULL,
  "metadata"  JSONB,
  "timestamp" TIMESTAMP                 NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "group_engagement_logs_user_idx"     ON "group_engagement_logs"("user_id");
CREATE INDEX IF NOT EXISTS "group_engagement_logs_group_idx"    ON "group_engagement_logs"("group_id");
CREATE INDEX IF NOT EXISTS "group_engagement_logs_action_idx"   ON "group_engagement_logs"("action");
CREATE INDEX IF NOT EXISTS "group_engagement_logs_timeline_idx" ON "group_engagement_logs"("user_id", "timestamp");
