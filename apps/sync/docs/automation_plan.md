# Sabha Attendance Sync — Implementation Plan

## Context

Post-Sabha attendance is currently synced manually: open the web app, identify checked Yuvaks, open `sampark.xlsx`, find the date column, and mark each row. With 114+ Yuvaks this is slow and error-prone. This plan automates that entire sync by using Playwright to read-only-scrape the website and ExcelJS to update the local `.xlsx` file.

**Current goal: local run only.** Cron scheduling is deferred to a future phase.

---

## STRICT READ-ONLY WEBSITE RULES

The automation interacts with the website in a **strictly read-only** manner. These rules are absolute and must never be broken:

1. **DO NOT click any attendance checkboxes** on the website. Checkboxes are observed only.
2. **DO NOT submit, modify, or save any attendance data** on the website.
3. **DO NOT click the send/submit button** (orange arrow FAB at the bottom of the attendance page).
4. **DO NOT add, remove, or edit any Yuvak data** on the website.
5. **Navigation is allowed only** to reach the attendance list for reading.
6. **Login is allowed** as it is required to access the data.
7. The website is the source of truth for attendance — the script only copies what is already there.

Any future extension that touches the website must have this constraint explicitly reviewed.

---

## Verified Facts (from exploration)

### Website (`https://m.sampark369.org/`)
- Angular 14.3.0 SPA, mobile-optimized
- Login: phone input (`input[type='tel']`), CONTINUE button (first `button`)
- Password: 4 separate OTP inputs (`input.otp-input`), auto-submits after 4th digit
- After login: dashboard at `/dashboard`
- Attendance page: `a[href='/new-attendance/sabhas']` → `/new-attendance/sabhas`
- Sabha header shows date as e.g. `"20-May"` (year inferred from current year)
- Yuvak list: each row has a name and a checkbox (orange checkmark = present, empty = absent)
- Bottom bar: total present/absent count
- Angular requires 5–6 second wait after page transitions

### Excel File (`sampark.xlsx`)
- Target sheet: `"Attendance Data - Kishor"` (116 Yuvaks, ~346 columns)
- Col 4: Yuvak Name (e.g. `"Aarav Jignesh Shah"`)
- Col 5: Area
- Col 7: Sabha (e.g. `"Chirag Nagar(Kishor)"`)
- Col 17+: Weekly attendance columns — stored as `Date` objects, 7-day intervals from 2020-09-09
- Attendance values: `"Yes"` (present) or `"No"` (absent)
- First 3 cols are `"Do not Touch"` system columns — never write to them
- Cols 8–16: calculated metrics — never write to them

---

## Architecture

```
Auto/
├── .env
├── sampark.xlsx
├── src/
│   ├── index.ts          ← entry point: orchestrates all steps + dry-run flag
│   ├── scraper.ts        ← Playwright: login + read-only data extraction
│   ├── sheetUpdater.ts   ← ExcelJS: find date col, match Yuvaks, write Yes/No
│   └── logger.ts         ← structured console + file logging
├── logs/
│   └── YYYY-MM-DD.log
├── package.json
├── tsconfig.json
└── docs/
    └── automation_plan.md  ← this file
```

## Tech Stack

| Component | Library |
|---|---|
| Browser automation | Playwright (Chromium) |
| Excel read/write | ExcelJS |
| Environment vars | dotenv |
| Language | TypeScript |
| Runtime | Node.js |

---

## Implementation Steps

### Step 1 — Project bootstrap
- `npm init -y`
- Install: `playwright`, `exceljs`, `dotenv`, `typescript`, `ts-node`, `@types/node`
- `tsconfig.json` with `strict: true`, `moduleResolution: node`
- `.env` already exists with `PHONE_NUMBER`, `PASSWORD`, `WEBSITE_URL`

### Step 2 — `logger.ts`
- Exports `log(level, message)` — levels: `INFO`, `WARN`, `ERROR`
- Writes to both console and `logs/YYYY-MM-DD.log`

### Step 3 — `scraper.ts`
Exports `scrapeAttendance(): Promise<{ sabhaDate: Date; present: string[]; absent: string[] }>`

Flow (strictly read-only after login):
1. Launch Playwright Chromium (headless: false for local testing)
2. Go to `WEBSITE_URL`
3. Wait for `input[type='tel']`, fill with `PHONE_NUMBER`
4. Click first `button` (CONTINUE)
5. Wait for `input.otp-input`, fill each of 4 digits from `PASSWORD`
6. Wait for auto-submit and redirect to dashboard
7. Click `a[href='/new-attendance/sabhas']`
8. Wait 6s for Angular render
9. Find and click "Chirag Nagar (Kishor)" Sabha item
10. Wait 6s for Yuvak list to render
11. **Extract Sabha date** from header text (e.g. `"20-May"` → parse + add current year)
12. **Extract all Yuvak rows** — for each row: read name, check if checkbox has orange checkmark (present) or empty box (absent)
13. Return `{ sabhaDate, present[], absent[] }`
14. Close browser

### Step 4 — `sheetUpdater.ts`
Exports `updateSheet(sabhaDate: Date, present: string[], absent: string[]): Promise<void>`

Flow:
1. Load `sampark.xlsx` with ExcelJS
2. Open `"Attendance Data - Kishor"` sheet
3. Read header row — scan cols 17+ for a `Date` cell matching `sabhaDate` (same day/month/year)
4. If no match found → **create new column** appended after the last date column with `sabhaDate` as header
5. Build a lookup map: normalized name → row number (trim, lowercase for comparison)
6. For each Yuvak in `present`: find row by normalized name, write `"Yes"` in the date column
7. For each Yuvak in `absent`: find row by normalized name, write `"No"` in the date column
8. Log any Yuvak names from website that have no match in the sheet
9. Save the file back to `sampark.xlsx`

**Name normalization:** trim whitespace, collapse multiple spaces, compare case-insensitively.

### Step 5 — `index.ts`
- Reads `--dry-run` flag from CLI args
- Calls `scrapeAttendance()` → prints extracted data
- If dry-run: logs what would be written, exits without saving
- If not dry-run: calls `updateSheet()` → logs results
- Outputs summary: total present, total absent, matched, unmatched

---

## Duplicate Prevention

- Before writing, check if the target date column already has values filled
- If > 50% of rows already have "Yes"/"No" in that column → log a warning and prompt user to use `--force` flag to override

---

## Running Locally

```bash
# Dry run (no sheet changes)
npx ts-node src/index.ts --dry-run

# Live run (updates sampark.xlsx)
npx ts-node src/index.ts
```

---

## Verification Steps

1. Run `--dry-run` first — confirm correct Yuvaks extracted and correct date column targeted
2. Run live — open `sampark.xlsx` and verify the new date column has "Yes"/"No" values
3. Cross-check 3–5 names manually against the website attendance page
4. Check `logs/` file for any unmatched names

---

## Change Log

| Date | Change |
|---|---|
| 2026-05-26 | Initial plan created based on exploration of website and sampark.xlsx |

---

## Future: Cron Scheduling

- Add `node-cron` package
- Schedule: Tuesday 11:30 PM, Friday 11:30 PM
- Wrap `index.ts` logic in a cron job
- Run as a background service (PM2 or Windows Task Scheduler)
- Consider Docker for consistent environment on VPS

## Future: Multiple Sabhas

- Parameterize Sabha name and target sheet name
- Add config per Sabha: `{ webName, sheetName, cronSchedule }`

## Future: Attendance Analytics

- After updating attendance, recalculate attendance % in cols 8–16
- Flag Super Active Yuvaks
- Weekly attendance trend reports
