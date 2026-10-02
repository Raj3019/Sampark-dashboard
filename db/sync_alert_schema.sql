-- sync_alert: cross-verification issues surfaced to the dashboard.
-- unknown_name   — scrape/export row with no matching DB member (skipped)
-- mark_conflict  — fetched attendance mark disagrees with the pre-import DB mark
--                  for the same member + sabha week (report wins, alert records both)
-- Resolves only via manual Dismiss in the dashboard (users decision, 2026-09-28).

CREATE TABLE IF NOT EXISTS "sync_alert" (
  "id"            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "source"        text        NOT NULL,  -- 'attendance-sync' | 'member-attendance-report'
  "kind"          text        NOT NULL,  -- 'unknown_name' | 'mark_conflict'
  "sabha_type"    text        NOT NULL,
  "sampark_sabha" text,
  "member_name"   text,                  -- NULL for per-sabha alerts
  "ref_date"      date,                  -- session/week date when relevant
  "message"       text        NOT NULL,
  "detail"        jsonb,
  "created_at"    timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"    timestamptz NOT NULL DEFAULT NOW(),
  "dismissed"     boolean     NOT NULL DEFAULT false,
  "dismissed_at"  timestamptz,
  "dismissed_by_user_id" text
);

CREATE INDEX IF NOT EXISTS "sync_alert_open_idx"
  ON "sync_alert" ("dismissed", "created_at" DESC);
