# Sabha Attendance Sync — Developer Context

> One-stop reference. Read this before touching any code or asking for changes.

---

## What This App Does

Automates the post-Sabha attendance sync between the **Sampark web app** (`m.sampark369.org`) and a **Google Sheet**.

After every Sabha, instead of manually opening the app, reading who attended, opening the sheet, searching each name, and filling "Yes", this tool does all of it automatically in one command.

---

## Domain Vocabulary

| Term | Meaning |
|---|---|
| **Sabha** | A spiritual gathering / meeting organized by area and age group |
| **Yuvak** | A member (youth) who attends Sabha |
| **Kishor** | Younger age group Sabha (also spelled "Kishore" in the Sampark app) |
| **Yuva / Yuvak Sabha** | Older age group Sabha |
| **Chirag Nagar** | The area/locality name — there are two Sabhas here: Kishor and Yuvak |
| **KK** | A follow-up coordinator assigned to each Yuvak |
| **Sampark** | The internal web app where Sabha attendance is marked (`m.sampark369.org`) |
| **Roster** | The list of Yuvak names in the Google Sheet for a given Sabha tab |

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (run via `ts-node`) |
| Browser automation | Playwright (Chromium, headful) |
| Google Sheet writes | Google Sheets API v4 (`googleapis`) |
| AI name matching | OpenRouter API → Gemini Flash 1.5 (optional) |
| Config | `.env` via `dotenv` |
| Runtime | Node.js |

---

## Project Structure

```
src/
  index.ts        — Orchestrator / entry point
  jobs.ts         — Sabha job definitions (which app name → which sheet tab)
  scraper.ts      — Playwright scraper: login + scroll + extract
  aiResolver.ts   — AI name-matching: scraped names → roster canonical names
  sheetUpdater.ts — Google Sheets: read roster, find date col, write Yes/No
  logger.ts       — File + console logging (logs/YYYY-MM-DD.log)
  runReport.ts    — JSON run report saved to runs/ directory
  utils.ts        — normalizeName() helper

docs/             — Context and planning docs
logs/             — Daily log files (YYYY-MM-DD.log)
runs/             — JSON run reports (one per run + latest.json)
.env              — Environment config (secrets, IDs, toggles)
```

---

## Jobs (Sabha Definitions)

Defined in `src/jobs.ts`. Each job maps a Sampark Sabha name to a Google Sheet tab.

| Job ID | Label | Sampark Sabha Name | Sheet Tab |
|---|---|---|---|
| `kishor` | Chirag Nagar (Kishor) | `Chirag Nagar (Kishore)` | `Attendance Data - Kishor` |
| `yuvak` | Chirag Nagar (Yuvak) | `Chirag Nagar` (exact) | `Attendance Data - Yuva` |

> Note: Sampark spells it "Kishore" (with an e), the sheet uses "Kishor" — the pattern handles both.

---

## Environment Variables (.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PHONE_NUMBER` | Yes | — | Login phone number for Sampark app |
| `PASSWORD` | Yes | — | OTP passcode (6-digit) for Sampark app |
| `WEBSITE_URL` | No | `https://m.sampark369.org/` | Sampark web app URL |
| `SABHA_NAME` | No | `Chirag Nagar (Kishore)` | Override Sabha name (normally set by job) |
| `SABHA_SHEET_TABS` | No | — | JSON array for multi-tab sync (see below) |
| `GOOGLE_SHEET_ID` | Yes | — | Google Sheet ID from the sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | One of these | — | Path to service account JSON key file |
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | One of these | — | Raw service account JSON string |
| `AI_ENABLED` | No | `false` | Enable AI name resolver (`true`/`false`) |
| `OPENROUTER_API_KEY` | If AI | — | OpenRouter API key |
| `AI_MODEL` | No | `google/gemini-flash-1.5` | AI model to use via OpenRouter |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter base URL |

### SABHA_SHEET_TABS format
```json
[
  { "label": "Chirag Nagar (Kishor)", "tabName": "Attendance Data - Kishor" },
  { "label": "Chirag Nagar (Yuvak)", "tabName": "Attendance Data - Yuva" }
]
```
Used to sync attendance to multiple sheet tabs in one run (e.g., visitors from another Sabha).

---

## CLI Usage

```bash
# Interactive — prompts to choose job
npm run start

# Run specific job
npm run start:kishor
npm run start:yuvak

# Dry run (reads everything, logs what WOULD be written, writes nothing)
npm run dry-run
npm run dry-run:kishor
npm run dry-run:yuvak

# Direct flags
ts-node src/index.ts --job kishor
ts-node src/index.ts --job yuvak --dry-run
ts-node src/index.ts --job kishor --force    # overwrite already-filled cells
```

### Flags
| Flag | Effect |
|---|---|
| `--job <id>` | Select job by ID (`kishor` or `yuvak`) |
| `--dry-run` | Read-only mode — no sheet writes |
| `--force` | Overwrite cells that already have data |

---

## How It Works (Step by Step)

### 1. Job Selection (`index.ts`)
Reads `--job` flag or prompts interactively. Loads the `SyncJob` definition from `jobs.ts`.

### 2. Scrape Attendance (`scraper.ts`)
1. Launches Chromium (headful, 390×844 viewport — mobile size to match app layout)
2. Clears cookies/cache for a clean session
3. Navigates to Sampark app, logs in with phone + OTP
4. Goes to `/new-attendance/sabhas`
5. Clicks the matching Sabha card using the job's `samparkSabhaPattern`
6. Parses the Sabha date from page text (format: `DD-Mon-YY`)
7. Reads the bottom-bar counts (Present / Absent / Total) for verification
8. Installs a read-only guard (prevents accidental checkbox clicks during reading)
9. Scrolls through the virtual-scroll list incrementally, collecting all Yuvak rows
10. Each row captures: `name`, `isPresent` (checkbox state), `htmlSnippet`
11. Visitor detection: rows with `SabhaName | DD/MM/YYYY` subtitle = visitor from another Sabha, always counted as present

### 3. Resolve Names (`aiResolver.ts`)
Scraped names may differ from roster names (spelling variants, missing middle names). The resolver maps them.

**With AI enabled:**
- Sends all scraped rows + full roster to OpenRouter (Gemini Flash 1.5)
- AI returns matched canonical names + confidence levels
- Retries once on failure, then falls back to exact match
- Post-AI: applies exact-match override for any names the AI under-matched

**Without AI (or on failure):**
- Exact normalized name match (lowercase, trim, collapse spaces)

Confidence levels:
- `high` — first + last name match (middle may differ)
- `medium` — last name + at least one syllable of first name
- `low` — only last name or phonetic similarity → **skipped, not written**
- `none` — no match → **skipped**

### 4. Group by Sheet Tab (`index.ts → groupResolvedByTab`)
- Distributes resolved rows to their matched sheet tab
- For the primary tab (the job's own Sabha): fills any unmatched roster members as "Absent" (`completeMissingRowsAsAbsent = true`)
- Secondary tabs (visitors): only explicitly matched names are written

### 5. Update Google Sheet (`sheetUpdater.ts`)
1. Reads the entire sheet (up to 2000 rows, 700 cols)
2. Finds header row: looks for "Yuvak Name" in column D (col 4)
3. Finds date-header row: scans cols Q+ (col 17+) for dates
4. Locates or creates a column for today's Sabha date
5. **Duplicate guard**: if >50% of cells in that column already have "Yes"/"No", skips the update (use `--force` to override)
6. Builds name → row lookup (normalized)
7. Writes "Yes" (present) or "No" (absent) to matched cells in batch
8. Unmatched names (present but not in sheet) are logged as warnings

### 6. Save Report (`runReport.ts`)
Saves a full JSON run report to `runs/<timestamp>.json` and `runs/latest.json`.

---

## Google Sheet Structure

| Column | Index (1-based) | Content |
|---|---|---|
| D | 4 | Yuvak Name (roster names) |
| G | 7 | Sabha (used to filter Kishor rows in the combined sheet) |
| Q+ | 17+ | Date columns (format: `22-May-26`) |

- Values written: `Yes` (attended) or `No` (absent)
- The `Attendance Data - Kishor` tab filters rows by Sabha column containing "chirag nagar" + "kishor"
- Other tabs include all rows

---

## Key Edge Cases & Bugs Fixed

1. **Virtual scroll**: Angular only renders visible rows. Scraper scrolls step-by-step (600px per tick) and stops after 8 consecutive rounds with no new names.

2. **Checkbox stability**: Two reads 300ms apart — if any name's `isPresent` changes between reads, waits another 400ms and reads again. Prevents race conditions from Angular recycling DOM state.

3. **Visitor rows**: Yuvaks from other Sabhas attending today appear with a subtitle `SabhaName | DD/MM/YYYY`. These have no checkbox. Detected by the `|` + date pattern, always marked present.

4. **OTP input**: Sampark uses Angular OTP inputs that ignore standard Playwright fill. The scraper types digit-by-digit with keyboard; if that fails, injects values directly using the native `HTMLInputElement` setter + Angular-compatible events.

5. **Name matching bug**: Parent container elements (spanning multiple rows) also match `[class*='row']`. Fixed by requiring exactly 1 checkbox per row element — parent wrappers contain N>1 checkboxes.

6. **AI under-matching exact names**: Post-AI exact-match override catches cases where the AI gives low/no confidence to names that are literally identical in the roster.

---

## Logging & Debugging

- **Console output**: timestamped INFO/WARN/ERROR lines during every run
- **Daily log files**: `logs/YYYY-MM-DD.log` — full run history
- **Run reports**: `runs/<timestamp>.json` — structured JSON with scraped data, resolved rows, sheet update summaries, and any errors
- **`runs/latest.json`**: always points to the most recent run

To diagnose a failed run: check `runs/latest.json` first, then the log file.

---

## Adding a New Sabha Job

1. Open `src/jobs.ts`
2. Add a new entry to the `JOBS` array with:
   - `id`: short identifier used in CLI (`--job <id>`)
   - `label`: human-readable name
   - `samparkSabhaName`: exact name as shown in Sampark app
   - `samparkSabhaPattern`: regex to match the Sabha card text
   - `primarySheetTab`: Google Sheet tab name
3. Add npm scripts in `package.json` if needed
4. Ensure the Google Sheet has a tab with that exact name

---

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| "Missing required env variable" | `.env` not set up | Copy `.env.example` and fill values |
| "Duplicate guard" warning | Sheet already updated today | Run with `--force` to overwrite |
| Names scraped but not written | Name not in sheet roster, or confidence low/none | Check `runs/latest.json` → `resolver.resolved` |
| Sabha card not found | Sabha name mismatch | Verify `samparkSabhaName` in `jobs.ts` matches exactly |
| OTP not accepted | Wrong `PASSWORD` or OTP expired | Check phone for new OTP, update `.env` |
| 0 members loaded | Virtual scroll timing | Try running again; increase `SCROLL_PAUSE` in scraper |
