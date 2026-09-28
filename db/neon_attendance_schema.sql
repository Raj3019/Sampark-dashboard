-- ── Attendance core schema (sheet-replacement) ────────────────────────────────
-- member: the roster. KK follow-up target is a member (self-FK, public schema).
-- sabha_session: one row per sabha meeting (date + vakta + topic).
-- attendance_record: member × session Y/N, unique per pair — sync job upserts.

CREATE TABLE IF NOT EXISTS "member" (
  "id"                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "full_name"           text        NOT NULL,
  "phone_number"        text,
  "date_of_birth"       date,
  "area"                text,
  "std"                 text,
  "sabha_type"          text        NOT NULL,
  "follow_up_member_id" uuid        REFERENCES "member" ("id") ON DELETE SET NULL,
  "is_kk"               boolean     NOT NULL DEFAULT false,
  "attending"           boolean     NOT NULL DEFAULT true,
  "super_active"        boolean     NOT NULL DEFAULT false,
  "notes"               text,
  "created_at"          timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "member_sabha_type_idx"       ON "member" ("sabha_type");
CREATE INDEX IF NOT EXISTS "member_follow_up_member_idx" ON "member" ("follow_up_member_id");
-- NOTE: same-name members are distinct rows (two yuvaks can share a full name),
-- so there is intentionally NO unique index on (sabha_type, full_name).
-- Roster upserts key on id or full row identity; sync matching marks all
-- same-name members in the same sabha identically.

CREATE TABLE IF NOT EXISTS "sabha_session" (
  "id"          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "sabha_type"  text        NOT NULL,
  "session_date" date       NOT NULL,
  "vakta"       text,
  "topic"       text,
  "created_by"  text,
  "created_at"  timestamptz NOT NULL DEFAULT NOW(),
  "updated_at"  timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "sabha_session_type_date_key"
  ON "sabha_session" ("sabha_type", "session_date");

CREATE TABLE IF NOT EXISTS "attendance_record" (
  "id"         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "session_id" uuid        NOT NULL REFERENCES "sabha_session" ("id") ON DELETE CASCADE,
  "member_id"  uuid        NOT NULL REFERENCES "member" ("id") ON DELETE CASCADE,
  "present"    boolean     NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_record_session_member_key"
  ON "attendance_record" ("session_id", "member_id");
CREATE INDEX IF NOT EXISTS "attendance_record_member_idx" ON "attendance_record" ("member_id");

ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "follow_up_kk" text;
CREATE INDEX IF NOT EXISTS "member_follow_up_kk_idx" ON "member" ("follow_up_kk");

ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "follow_up_kk" text;
CREATE INDEX IF NOT EXISTS "member_follow_up_kk_idx" ON "member" ("follow_up_kk");

-- Cross-sabha visit capture: subtitle on Sampark present rows ("Actual Sabha | DD/MM/YYYY")
ALTER TABLE "attendance_record" ADD COLUMN IF NOT EXISTS "actual_sabha_type" text;
ALTER TABLE "attendance_record" ADD COLUMN IF NOT EXISTS "actual_session_date" date;

-- Sub-sabha (e.g. 'Maneklal (Bal)') + transfer tracking; same-name members are distinct rows, so the name-unique index is dropped';
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "sampark_sabha" text;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "transferred_out" boolean NOT NULL DEFAULT false;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "transferred_out_on" date;
