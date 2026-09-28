# Sabha Attendance Sync

Automates post-Sabha attendance sync from the **Sampark web app** to the **Neon Postgres database**.

After every Sabha the script:
1. Logs into `m.sampark369.org`
2. Opens the **Chirag Nagar (Kishore)** attendance page
3. Scrapes which Yuvaks are present / absent
4. Upserts the `sabha_session` row for the Sabha's date
5. Upserts each matched member's `attendance_record` (`present` true/false)
6. Skips visitors and unknown names automatically (reported, never created)
7. Re-runs are safe — marks are refreshed, never duplicated

---

## Project Structure

```
Auto/
├── src/
│   ├── index.ts          # Entry point — orchestrates scrape → DB update
│   ├── scraper.ts        # Playwright login + attendance extraction
│   ├── dbUpdater.ts      # Neon Postgres upsert of session + attendance
│   ├── aiResolver.ts     # AI-powered fuzzy name matching (via OpenRouter)
│   ├── jobs.ts           # Sabha job definitions (name → DB sabha_type mapping)
│   ├── logger.ts         # File + console logger (logs/ folder)
│   └── runReport.ts      # JSON run report writer (runs/ folder)
├── frontend/             # Next.js web app — see frontend/README.md
├── logs/                 # Auto-created — one .log file per day
├── runs/                 # Auto-created — JSON run report per run + latest.json
├── docs/                 # Planning and context documents
├── assest/               # Reference screenshots
├── .env                  # Credentials (never commit this)
├── tsconfig.json
└── package.json
```

---

## Prerequisites

- **Node.js** v18+
- A **Neon Postgres** database with the `member` / `sabha_session` / `attendance_record` schema

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install chromium
```

### 3. Configure `.env`

Copy `.env.example` to `.env` and fill in:

```env
# Sampark web app credentials
PHONE_NUMBER=9876543210
PASSWORD=1234
WEBSITE_URL=https://m.sampark369.org/

# Neon Postgres
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

> **DATABASE_URL** — Neon dashboard → Project → Connection Details.

---

## Commands

### Run (live — writes to the DB)

```bash
npm run start
```

If no `--job` is provided, the terminal asks which Sabha to sync.

Cron-friendly job commands:

```bash
npm run start:kishor
npm run start:yuvak
npm run start:bal
```

Equivalent direct commands:

```bash
npx ts-node src/index.ts --job kishor
npx ts-node src/index.ts --job yuvak
npx ts-node src/index.ts --job bal
```

### Dry run (reads everything, logs what would happen, writes nothing)

```bash
npm run dry-run
```

Dry-run a specific job:

```bash
npm run dry-run:kishor
npm run dry-run:yuvak
npm run dry-run:bal
```

### Force mode (kept for report compatibility; re-runs always refresh marks)

```bash
npx ts-node src/index.ts --job kishor --force
npx ts-node src/index.ts --job yuvak --force
```

### Typecheck

```bash
npm run typecheck
```

### Jobs

Jobs are defined in `src/jobs.ts`.

Current jobs:

| Job ID | Sampark page(s) | DB `sabha_type` |
|--------|-----------------|-----------------|
| `kishor` | `Chirag Nagar (Kishore)` | `Chirag Nagar(Kishor)` (literal, with parentheses) |
| `yuvak` | `Chirag Nagar` | `Chirag Nagar` |
| `bal` | `Chirag Nagar (Bal)` + `Maneklal (Bal)` (two pages, one run) | `Bal Sabha` |

The mapping lives in `src/jobs.ts` (`sabhaType` per job).

> **Bal Sabha note** — Sampark exposes Bal Sabha as **two separate pages**,
> `Chirag Nagar (Bal)` and `Maneklal (Bal)`. The `bal` job scrapes both pages in
> one run and writes them into the single dashboard sabha `Bal Sabha`
> (`sabha_session` keyed `(Bal Sabha, session_date)`, shared by both pages when
> they report the same date). Each page's members are scoped through
> `member.sampark_sabha` (`Chirag Nagar (Bal)` = 32 rows, `Maneklal (Bal)` = 51
> rows), so counts, unknown names and auto-transfers stay per-page while the run
> report shows per-page lines plus run-level totals.

---

## How It Works

### Scraper (`scraper.ts`)

| Step | What happens |
|------|-------------|
| Login | Enters phone number → fills 4-digit OTP |
| Navigate | Goes directly to `/new-attendance/sabhas` |
| Select Sabha | Clicks **Chirag Nagar (Kishore)** |
| Extract date | Reads the Sabha date from page text |
| Read counts | Reads Present / Absent / Total from bottom bar |
| Scroll + collect | Scrolls through virtual list, collects all Yuvak rows |
| Visitor filter | Skips rows with subtitle `"Sabha Name \| DD/MM/YYYY"` (other Sabha visitors) |
| Return | `{ sabhaDate, present[], absent[] }` |

### DB Updater (`dbUpdater.ts`)

| Step | What happens |
|------|-------------|
| Load roster | `SELECT id, full_name FROM member WHERE sabha_type = <job's sabhaType>` |
| Match names | Exact case-insensitive/trim match first, then the AI resolver fallback |
| Unknown skip | Any scraped name with no DB member match (present or absent) is skipped and reported — members are never auto-created |
| Visitor skip | Visitors from other Sabhas are already handled by the scraper; nothing extra is written |
| Session upsert | `INSERT … ON CONFLICT (sabha_type, session_date) DO UPDATE SET updated_at = NOW()` — vakta/topic are never clobbered; `created_by = 'sampark-sync'` on new sessions |
| Attendance upsert | `INSERT … ON CONFLICT (session_id, member_id) DO UPDATE SET present = EXCLUDED.present` — re-runs are freely approved (idempotent) |
| Dry-run | All reads/matching run; every DB write is skipped and logged instead |
| Trigger | Manual: CLI / frontend button / explicit cron per job |

### Database Layout

```
member             (id, full_name, sabha_type, …)      — unique (sabha_type, lower(trim(full_name)))
sabha_session      (id, sabha_type, session_date, …)   — unique (sabha_type, session_date)
attendance_record  (id, session_id, member_id, present) — unique (session_id, member_id)
```

---

## Web App

A Next.js web UI in `frontend/` lets you trigger either Sabha with a button instead of the terminal, streams live logs in the browser, and runs cron jobs automatically.

See **[`frontend/README.md`](frontend/README.md)** for full setup and deployment instructions.

Quick start:
```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

---

## Scheduling (Optional — CLI only)

To run automatically every Tuesday and Friday at 11:30 PM, add a Windows Task Scheduler job or use `node-cron`.

### Using node-cron (add to `index.ts`)

```ts
import cron from "node-cron";

// Tuesday and Friday at 11:30 PM
cron.schedule("30 23 * * 2,5", () => {
  main();
});
```

Install:
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

---

## Logs

Logs are written to `logs/YYYY-MM-DD.log` automatically.

```
[2026-05-27T06:34:31.265Z] [INFO] Starting Sabha attendance sync
[2026-05-27T06:34:54.568Z] [INFO] Extracted 6 present, 101 absent (107/107 total)
[2026-05-27T06:34:56.000Z] [INFO] Roster "Chirag Nagar(Kishor)": 116 members in DB
[2026-05-27T06:34:56.002Z] [INFO] DB update saved — session created; 6 present, 101 absent;
    107 marks (107 new, 0 corrected, 0 unchanged); 1 unknown skipped; 105 exact matches, 1 resolver matches.
```

## Run Reports

Every run also writes a structured JSON report:

```text
runs/<timestamp>.json
runs/latest.json
```

Use `runs/latest.json` to inspect the most recent run. It includes:
- dry-run / force mode
- trigger (`cron`, dashboard `manual`, or `cli`) and explicit success/failure status
- Sabha date
- scraped present and absent names
- Sampark-versus-scraper count validation and number of full scan passes. A persistent mismatch is logged as a warning, the sync continues with collected rows.
- AI resolver output
- DB update summary (session created/reused, marks upserted, skipped names)
- failed stage and error details if the run failed

---

## Important Rules

| Rule | Detail |
|------|--------|
| Job's sabha_type only | Members and sessions are written under the selected job's `sabha_type` (`kishor` → `Chirag Nagar(Kishor)`, `yuvak` → `Chirag Nagar`) |
| Date must match | The session for today's Sabha date is upserted — never a different date |
| Re-run = overwrite | Running twice for the same date refreshes `present`/`absent` marks (idempotent upserts) |
| Visitors skipped | Visitors from other Sabhas are handled by the scraper; the DB updater reports 0 |
| Unknown = skip | A scraped name with no DB member match (present or absent) is logged and skipped — no member is ever auto-created |
| Manual trigger | The wizard/scripts trigger runs; cron runs are configured per job |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PHONE_NUMBER` | ✅ | Login phone number for Sampark app |
| `PASSWORD` | ✅ | 4-digit OTP/password for Sampark app |
| `WEBSITE_URL` | ✅ | Base URL of the Sampark app |
| `DATABASE_URL` | ✅ | Neon Postgres connection string (target DB) |
| `SABHA_NAME` | ⬜ | Legacy override for Sabha name; prefer `--job` / `src/jobs.ts` |
| `OPENROUTER_API_KEY` | ⬜ | Enables AI fuzzy name matching fallback (exact matching is default) |
| `AI_MODEL` | ⬜ | OpenRouter model (default `google/gemini-flash-1.5`) |
| `OPENROUTER_BASE_URL` | ⬜ | OpenRouter API base URL |
| `AGENT_API_SECRET` | ⬜ | Enables the protected Hermes job API; must match Hermes `SABHA_AGENT_API_SECRET` |
| `KISHOR_CRON_TIME` | Optional | Daily Kishor sync time in 24-hour `HH:mm` format (default `23:30`) |
| `YUVAK_CRON_TIME` | Optional | Daily Yuvak sync time in 24-hour `HH:mm` format (default `23:50`) |
| `CRON_TIMEZONE` | Optional | IANA timezone used by the scheduler (default `Asia/Kolkata`) |
