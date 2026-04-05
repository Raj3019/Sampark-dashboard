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

ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "takenOverByUserId" text;
ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "takenOverByName" text;
ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "takenOverAt" timestamptz;
ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "escalatedByUserId" text;
ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "escalatedByName" text;
ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "escalatedAt" timestamptz;
ALTER TABLE "reminder_item" ADD COLUMN IF NOT EXISTS "phoneNumber" text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "reminder_item_followUpKK_idx" ON "reminder_item" ("followUpKK");
CREATE INDEX IF NOT EXISTS "reminder_item_status_idx" ON "reminder_item" ("status");
CREATE INDEX IF NOT EXISTS "reminder_item_riskLevel_idx" ON "reminder_item" ("riskLevel");
