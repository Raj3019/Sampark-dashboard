-- ── Neon app schema (Managed Better Auth edition) ─────────────────────────────
-- App tables live in the public schema and reference identity by joining to
-- neon_auth.user (Managed Better Auth owns identity, bans, and roles there).
-- NOTE: FK constraints into neon_auth are not permitted (schema owned by the
-- auth service), so id columns are joined with SQL instead. Reactively clean
-- up orphans when deleting users via the Admin API.

CREATE TABLE IF NOT EXISTS "user_kk_assignment" (
  "id"          uuid        NOT NULL PRIMARY KEY,
  "assigned_kk" text,
  "phone"       text,
  "updated_at"  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "user_kk_assignment_assigned_kk_idx" ON "user_kk_assignment" ("assigned_kk");

-- Activity log: tracks login events per user
CREATE TABLE IF NOT EXISTS "activity_log" (
  "id"         text        NOT NULL PRIMARY KEY,
  "userId"     text,
  "userName"   text,
  "userEmail"  text,
  "userRole"   text,
  "action"     text        NOT NULL,
  "ipAddress"  text,
  "userAgent"  text,
  "createdAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "activity_log_userId_idx"    ON "activity_log" ("userId");
CREATE INDEX IF NOT EXISTS "activity_log_createdAt_idx" ON "activity_log" ("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "reminder_item" (
  "id" text NOT NULL PRIMARY KEY,
  "reminderKey" text NOT NULL UNIQUE,
  "yuvakName" text NOT NULL,
  "phoneNumber" text NOT NULL DEFAULT '',
  "followUpKK" text NOT NULL,
  "sabhaType" text NOT NULL,
  "riskLevel" text NOT NULL CHECK ("riskLevel" IN ('moderate', 'high')),
  "missedSabhaCount" integer NOT NULL,
  "missedSabhaDates" text[] NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'acknowledged', 'escalated', 'resolved')),
  "requiresLeaderReview" boolean NOT NULL DEFAULT false,
  "escalatedByUserId" text,
  "escalatedByName" text,
  "escalatedAt" timestamptz,
  "takenOverByUserId" text,
  "takenOverByName" text,
  "takenOverAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "reminder_item_followUpKK_idx" ON "reminder_item" ("followUpKK");
CREATE INDEX IF NOT EXISTS "reminder_item_status_idx" ON "reminder_item" ("status");
CREATE INDEX IF NOT EXISTS "reminder_item_riskLevel_idx" ON "reminder_item" ("riskLevel");
