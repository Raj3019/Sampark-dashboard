# Sabha Attendance Sync — Project Documentation

## What This App Does

**Sabha Attendance Sync** is a TypeScript automation tool that:

1. **Logs into the Sampark 369 web app** (`m.sampark369.org`) using Playwright (a headless browser).
2. **Scrapes attendance** for the *Chirag Nagar (Kishore)* Sabha — collecting every Yuvak's name and whether they were present or absent.
3. **Writes the results to a Google Sheet** (`Attendance Data - Kishor` tab) by finding or creating the correct date column and marking each matching Yuvak row `Yes` (present) or `No` (absent).

---

## Background & Context

The organisation holds spiritual gatherings called **Sabhas** multiple times a week, split by age group and area:

| Sabha | Day |
|---|---|
| Chirag Nagar | Friday |
| Chirag Nagar (Kishor) | Tuesday |

Attendance is marked inside the Sampark web app during the Sabha. Each Yuvak is **absent by default**; a Karyakarta marks them present if they show up.

A separate **Google Sheet** (`Attendance Data - Kishor`) also tracks attendance historically so that percentages, trends, and "Super Active Yuvak" lists can be calculated.

Previously this sync was done manually — opening the web app, reading off names, searching the sheet, and typing `Yes`/`No` for every single person. With 100+ Yuvaks per Sabha that was repetitive, error-prone, and time-consuming.

---

## Repository Layout

```
src/
  index.ts          — entry point; orchestrates scraper → sheet updater
  scraper.ts        — Playwright browser automation; logs in and extracts attendance
  sheetUpdater.ts   — Google Sheets API integration; finds the date column and writes values
  logger.ts         — shared logger that writes to console + daily log file (logs/YYYY-MM-DD.log)
  diagnose.ts       — one-off utility to dump the first rows of the sheet for debugging

docs/               — planning notes, message examples, architecture notes
logs/               — daily log files generated at runtime (git-ignored)
```

---

## How It Works — Step by Step

### Phase 1 — Web Scrape (`src/scraper.ts`)

| Step | What happens |
|---|---|
| 1 | Launches a Chromium browser (headless: false, mobile viewport 390×844) |
| 2 | Navigates to `https://m.sampark369.org/` |
| 3 | If not already logged in: enters the phone number, waits for the OTP screen, types the OTP digit-by-digit (with an Angular-compatible JS fallback if keyboard input fails) |
| 4 | Navigates directly to `/new-attendance/sabhas` |
| 5 | Finds and clicks the "Chirag Nagar (Kishor)" Sabha card (regex match tolerates "Kishor"/"Kishore" spelling variants) |
| 6 | Parses the Sabha date from the page body text |
| 7 | Reads the "Present / Absent / Total" counts from the fixed bottom bar for verification |
| 8 | **Scrolls through the virtual-scroll list** collecting all Yuvak rows — since Angular only renders visible rows in the DOM, the scraper scrolls 600 px at a time, pausing 600 ms each tick to let new rows render, and stops after 8 consecutive rounds with no new names |
| 9 | For each visible row: finds the container with **exactly 1 checkbox** (guarantees a single Yuvak row, not a parent wrapper), reads the checkbox `checked` state, extracts the Yuvak name, and skips visitor rows from other Sabhas |
| 10 | Returns `{ sabhaDate, present[], absent[] }` |

### Phase 2 — Sheet Update (`src/sheetUpdater.ts`)

| Step | What happens |
|---|---|
| 1 | Authenticates to Google Sheets API via a service-account key (JSON string or file path) |
| 2 | Reads the entire `Attendance Data - Kishor` tab (up to row 2000, column ZZ) |
| 3 | Locates the **header row** by finding where column D says "Yuvak Name" |
| 4 | Detects the **date header row** — probes known columns (Q, R, S …) for parseable dates; the dates may be in the same row as the header or one row above |
| 5 | Scans date columns (starting at column Q) to find a cell matching today's Sabha date — or plans to **create a new column** right after the last known date column |
| 6 | Filters rows to only those whose Sabha column (G) contains "chirag nagar" + "kishor" |
| 7 | **Duplicate guard**: if > 50 % of those rows already have `Yes`/`No` in the target column, skip the entire update (prevents running twice on the same Sabha). Can be bypassed with `--force` |
| 8 | Resolves each scraped name against the sheet via normalised lowercase comparison |
| 9 | Skips cells that already have a value (individual-cell guard) |
| 10 | Batches all `Yes`/`No` writes into a single `batchUpdate` API call |

### Logging (`src/logger.ts`)

Every log line is timestamped with level (`INFO` / `WARN` / `ERROR`) and written to:
- the terminal (stdout/stderr)
- `logs/YYYY-MM-DD.log` (appended)

---

## Configuration — Environment Variables

Create a `.env` file in the project root:

```env
# ── Web app credentials ──────────────────────────────────────────────────────
PHONE_NUMBER=91XXXXXXXXXX        # login phone number
PASSWORD=123456                  # OTP / passcode

# ── Optional overrides ───────────────────────────────────────────────────────
WEBSITE_URL=https://m.sampark369.org/   # default shown; override if the URL changes
SABHA_NAME=Chirag Nagar (Kishore)       # default shown

# ── Google Sheets ────────────────────────────────────────────────────────────
GOOGLE_SHEET_ID=<spreadsheet-id>

# Option A — path to a service-account JSON key file
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json

# Option B — raw JSON string (useful for CI/secrets managers)
GOOGLE_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account","project_id":"..."}
```

Only one of `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` or `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` is needed.

---

## Running the App

```bash
# Normal run — scrapes and writes to the sheet
npm start

# Dry run — scrapes but prints what would be written without touching the sheet
npm run dry-run

# Force run — bypasses the duplicate-prevention guard (re-runs on a Sabha already synced)
npx ts-node src/index.ts --force

# Type-check only
npm run typecheck

# Diagnostic — dumps the first 8 rows of the sheet to inspect its layout
npx ts-node src/diagnose.ts
```

---

## Sheet Layout Assumptions

The `Attendance Data - Kishor` sheet is expected to follow this structure:

| Column | Content |
|---|---|
| D (col 4) | Yuvak Name — header row contains `"Yuvak Name"` |
| G (col 7) | Sabha name — used to filter rows to Chirag Nagar (Kishor) |
| Q (col 17) onwards | One column per Sabha date, header formatted as `22-May-26` |

The tool auto-detects the exact row for dates (same row as the column headers, or one row above). If the Sabha date column doesn't exist yet, it creates it.

---

## Duplicate-Prevention & Safety Guards

| Guard | Behaviour |
|---|---|
| **Duplicate-column guard** | If > 50 % of Sabha rows already have `Yes`/`No` in the target date column, the whole update is skipped and a `WARN` is logged. Override with `--force`. |
| **Cell-level guard** | A cell that already contains any non-empty value is never overwritten — not even in a `--force` run. |
| **Visitor skip** | Yuvaks whose row has a subtitle like `Sabha Name \| DD/MM/YYYY` are recognised as visitors from another Sabha and excluded from scraping. |
| **Name-not-found warning** | If a scraped name doesn't match any sheet row, a `WARN` is logged and the name is skipped — no substitution or fuzzy-matching is attempted. |

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (ES2022 target, CommonJS modules) |
| Runtime | Node.js via `ts-node` |
| Browser automation | Playwright (Chromium) |
| Google integration | `googleapis` v4 (Google Sheets API) |
| Environment config | `dotenv` |
| Build / type-check | `tsc` |

---

## Future Scope (Planned)

- **WhatsApp message generation** — auto-compose the three post-Sabha messages (absent report, KK summary, Sabha summary) and optionally send them via WhatsApp.
- **Per-KK notifications** — send each Karyakarta their own absent-Yuvak list automatically.
- **Attendance analytics** — auto-calculate attendance percentages, "Super Active" status, and weekly trends directly in the sheet.
- **Scheduled runs** — integrate `node-cron` so the sync fires automatically at 11:30 PM on Tuesdays and Fridays without any manual trigger.
