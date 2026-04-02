-- ── Role-based access control migration ─────────────────────────────────────
-- Adds role + ban fields to user table (required by better-auth admin plugin)
-- Adds activity_log table to track login events
-- Adds sheet_change_log table for snapshot-based change detection

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "role"       text        NOT NULL DEFAULT 'kk',
  ADD COLUMN IF NOT EXISTS "banned"     boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS "banReason"  text,
  ADD COLUMN IF NOT EXISTS "banExpires" timestamptz;

-- Activity log: tracks login events per user
CREATE TABLE IF NOT EXISTS "activity_log" (
  "id"         text        NOT NULL PRIMARY KEY,
  "userId"     text        REFERENCES "user" ("id") ON DELETE SET NULL,
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

-- Sheet change log: human-readable diff from snapshot comparisons
CREATE TABLE IF NOT EXISTS "sheet_change_log" (
  "id"          text        NOT NULL PRIMARY KEY,
  "sabhaType"   text        NOT NULL,
  "changeType"  text        NOT NULL,
  "description" text        NOT NULL,
  "detectedAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "sheet_change_log_detectedAt_idx" ON "sheet_change_log" ("detectedAt" DESC);
