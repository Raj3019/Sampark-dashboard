-- Map KK users to their owned follow-up group for role-based data scoping.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "assignedKK" text;

CREATE INDEX IF NOT EXISTS "user_assignedKK_idx" ON "user" ("assignedKK");
