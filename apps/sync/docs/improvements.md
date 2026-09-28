# Planned Improvements: AI-Powered Attendance Verification & Cross-Sabha Routing

## Context & Problem Statement

The current scraper reads `checkbox.checked` directly from the DOM, but Angular's virtual-scroll recycles DOM nodes during scrolling. At the moment a row is read, the **name text** can belong to one Yuvak while the **checkbox state** still reflects the previous Yuvak that occupied that DOM slot — causing regular members to get mis-marked (present when absent, or absent when present).

A secondary problem is that **name variations** (missing middle names, spelling/transliteration differences) silently fail the exact-match lookup against the Google Sheet, causing valid members to be skipped.

This document describes the planned improvements to fix both issues.

---

## Goals

1. Fix the **timing root cause** in the scraper (Angular virtual-scroll state mismatch)
2. Add a **Gemini AI layer** (via OpenRouter) that:
   - Fuzzy-matches scraped names → canonical sheet names (handles abbreviations, missing middle names, transliteration)
   - Verifies present/absent status by reading raw HTML snippets (catches checkbox timing bugs the scraper missed)
3. Enable **cross-Sabha routing**: visitors from other Sabhas attending the current Sabha get marked in their own home Sabha's sheet tab
4. Keep a clean `AI_ENABLED=false` fallback that reproduces the current exact-match behaviour exactly

---

## New & Changed Files

| File | Change |
|---|---|
| `src/utils.ts` | **New** — shared `normalizeName()` to avoid circular imports |
| `src/aiResolver.ts` | **New** — entire AI layer (prompt, OpenRouter call, fallback) |
| `src/scraper.ts` | Add `htmlSnippet` per row, stability double-read, return `rows[]` |
| `src/sheetUpdater.ts` | Add `readRoster()`, accept `sheetTabName` param, expose `createSheetsClient()` |
| `src/index.ts` | New orchestration: load rosters → AI resolve → multi-tab writes |
| `.env` | New vars: `OPENROUTER_API_KEY`, `AI_ENABLED`, `AI_MODEL`, `SABHA_SHEET_TABS` |

---

## Implementation Plan

### Phase 1 — Shared Utilities & Backwards-Compatible Sheet Refactor

**`src/utils.ts`** (new file)
```typescript
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
```

**`src/sheetUpdater.ts`** changes:
- Remove the local `normalizeName` definition; import from `./utils`
- Export `createSheetsClient()` that builds Google auth once and returns `{ auth, sheets }`
- Add `readRoster(sheets, spreadsheetId, tabName): Promise<{ tabName, names[] }>` — reuses the existing header-detection logic, returns all Yuvak names from column D for that tab
- Add optional `sheetTabName?: string` as the last param of `updateSheet()`; internally replace the hardcoded `"Attendance Data - Kishor"` constant with `sheetTabName ?? "Attendance Data - Kishor"`
- No other logic changes — existing callers with 4 args still work unchanged

**Verification:** `npm run dry-run` — output must be identical to before Phase 1.

---

### Phase 2 — Scraper Enrichment + Timing Fix

**`src/scraper.ts`** changes:

**1. Extend internal `Row` type:**
```typescript
type Row = { name: string; isPresent: boolean; htmlSnippet: string };
```

**2. Capture `htmlSnippet` inside `extractVisible()` (runs in `page.evaluate`):**
```typescript
// After extracting nameLine:
const htmlSnippet = row.outerHTML.slice(0, 600); // enough for checkbox + class state
results.push({ name: nameLine, isPresent, htmlSnippet });
```

**3. Stability double-read** — replaces the single `extractVisible()` call in the scroll loop:
```typescript
const read1 = await extractVisible();
await page.waitForTimeout(300);
const read2 = await extractVisible();

// If checkbox states differ between reads, the DOM is still transitioning
const stable = read1.every(r1 => {
  const r2 = read2.find(r => r.name === r1.name);
  return !r2 || r1.isPresent === r2.isPresent;
});
const rows = stable ? read2 : await (async () => {
  await page.waitForTimeout(400);
  return extractVisible();
})();
// Use `rows` (not read1) to update the collected map
```

**4. Extend `AttendanceScrapeResult`:**
```typescript
export interface ScrapedRow { name: string; isPresent: boolean; htmlSnippet: string; }
export interface AttendanceScrapeResult {
  sabhaDate: Date;
  rows: ScrapedRow[];   // NEW — what the AI layer consumes
  present: string[];    // kept for backward compatibility
  absent: string[];
}
```

---

### Phase 3 — AI Resolver (`src/aiResolver.ts`)

**TypeScript interfaces:**
```typescript
export interface ScrapedRowInput {
  name: string;
  isPresent: boolean;
  htmlSnippet: string;
  rowIndex: number;
}

export interface RosterEntry {
  sheetName: string;       // exact Google Sheet tab name
  sabhaLabel: string;      // e.g. "Kishor"
  canonicalName: string;
}

export interface ResolvedRow {
  scrapedName: string;
  isPresent: boolean;               // AI-verified (may differ from input)
  matchedCanonicalName: string | null;
  matchedSheetName: string | null;  // which tab to write to
  confidence: "high" | "medium" | "low" | "none";
  reason: string;                   // short explanation for logs
  statusVerified: boolean;
  statusConflict: boolean;          // true = HTML contradicted the scraped isPresent
}

export interface AIResolverConfig {
  enabled: boolean;
  apiKey: string;
  model: string;    // e.g. "google/gemini-flash-1.5"
  baseUrl: string;  // "https://openrouter.ai/api/v1"
}
```

**System prompt (exact text):**
```
You are an attendance reconciliation assistant for a spiritual youth organization (Sabha).

Task: match scraped attendance rows to roster entries and verify each person's present/absent status.

Name matching rules:
- Missing middle names are a match: "Rishi Soni" = "Rishi Sunil Soni"
- Spelling/transliteration variants are a match: "Aayush" = "Ayush"
- Only last-name matches are confidence "low" — do NOT write if low
- No credible match → confidence "none"

Status verification: examine htmlSnippet for the checkbox element.
Look for: checked attribute, aria-checked, CSS classes like "checked/selected/active/present".
If HTML contradicts isPresent, set statusConflict=true and use the HTML-derived value.

Cross-Sabha: if the name matches a roster in a DIFFERENT tab, still match it with that tab's sheetName.

Confidence levels:
- "high": first+last name match unambiguously (middle name may differ)
- "medium": last name + at least one syllable of first name match
- "low": only last name OR only phonetic similarity
- "none": no credible match

Output ONLY a raw JSON array — no markdown, no explanation, no code fences.
Each element must have exactly these fields:
{ "scrapedName", "isPresent", "matchedCanonicalName", "matchedSheetName",
  "confidence", "reason", "statusVerified", "statusConflict" }
```

**User prompt template:**
```
SCRAPED ROWS:
<JSON of scrapedRows: name, isPresent, htmlSnippet (≤500 chars), rowIndex>

ROSTER (all Sabha tabs):
<JSON of allRosters: sheetName, sabhaLabel, canonicalName>

Return the JSON array for all ${scrapedRows.length} rows in the same order as the input.
```

**`callGemini()`** — uses native `fetch` (Node 18+, no new npm dependencies):
```typescript
const res = await fetch(`${config.baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
    "HTTP-Referer": "https://github.com/sabhaSync",
  },
  body: JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt }
    ],
    temperature: 0,  // deterministic output
  }),
});
```

**`parseAIResponse()`** — strips accidental ` ```json ``` ` fences before `JSON.parse` as a defensive measure.

**Retry + fallback strategy:**
- Attempt 1 → wait 2 s → Attempt 2 → if still failing → `exactMatchFallback()`
- `exactMatchFallback()` uses `normalizeName` from `./utils`, maps each scraped row to a `ResolvedRow` with `confidence: "high"` on exact match, `"none"` on miss — identical to today's behaviour

**Main export:**
```typescript
export async function resolveAttendance(
  rows: ScrapedRowInput[],
  rosters: RosterEntry[],
  config: AIResolverConfig
): Promise<{ resolved: ResolvedRow[]; fallbackUsed: boolean }>
```

**Cost note:** ~110 Yuvaks × 500-char HTML snippets + 220 roster names ≈ 18,000 tokens input, ~2,500 tokens output. At Gemini Flash pricing via OpenRouter (~$0.075/1M input + $0.30/1M output), one full run costs ~**$0.002**. Entirely negligible.

---

### Phase 4 — Updated `src/index.ts` Orchestration

**Sabha config parsing:**
```typescript
interface SabhaTabConfig { label: string; tabName: string; }

function parseSabhaConfig(): SabhaTabConfig[] {
  const raw = process.env.SABHA_SHEET_TABS;
  if (!raw) return [{ label: "Kishor", tabName: "Attendance Data - Kishor" }];
  try { return JSON.parse(raw) as SabhaTabConfig[]; }
  catch {
    log("WARN", "SABHA_SHEET_TABS parse error — using default");
    return [{ label: "Kishor", tabName: "Attendance Data - Kishor" }];
  }
}
```

**Updated `main()` flow:**
```
1. scrapeAttendance()                   → { sabhaDate, rows[], present[], absent[] }
2. loadAllRosters(sabhaConfig)          → readRoster() for each configured tab
3. resolveAttendance(rows, rosters, ai) → { resolved[], fallbackUsed }
4. groupByTab(resolved)                 → Map<tabName, { present[], absent[] }>
   (skip confidence "none" and "low"; use matchedCanonicalName not scrapedName)
5. for each tab: updateSheet(...)       → one Google Sheets batch write per tab
```

**`statusConflict` logging:**
```typescript
if (row.statusConflict) {
  log("WARN",
    `Status conflict for "${row.scrapedName}": ` +
    `scraped=${!row.isPresent ? "absent" : "present"}, ` +
    `AI-corrected=${row.isPresent ? "present" : "absent"}`
  );
}
```

---

## New `.env` Variables

```env
# AI layer
AI_ENABLED=true
OPENROUTER_API_KEY=sk-or-v1-...
AI_MODEL=google/gemini-flash-1.5         # or google/gemini-2.0-flash-001

# Sabha → Sheet tab mapping (JSON array)
# Omit entirely to keep the current single-tab default behaviour
SABHA_SHEET_TABS=[{"label":"Kishor","tabName":"Attendance Data - Kishor"}]

# When adding more Sabhas later, just add entries:
# SABHA_SHEET_TABS=[
#   {"label":"Kishor","tabName":"Attendance Data - Kishor"},
#   {"label":"Chirag Nagar","tabName":"Attendance Data - Yuva"}
# ]
```

---

## How Cross-Sabha Visitor Routing Works

When a Yuvak from "Chirag Nagar" Friday Sabha attends the Tuesday Kishor Sabha:

1. The scraper picks them up (they appear in the Kishor Sabha's attendance list)
2. Their name doesn't match any row in `Attendance Data - Kishor` exactly
3. Currently: logged as `WARN "PRESENT in app but NOT FOUND in sheet"` and skipped
4. **After this improvement:** AI checks all rosters → finds the match in `Attendance Data - Chirag Nagar` → `matchedSheetName = "Attendance Data - Yuva"` → `groupByTab` routes the write to that tab
5. The visitor gets marked `Yes` in their own Sabha's sheet for that date

---

## Verification Checklist

| Test | Expected result |
|---|---|
| `npm run dry-run` after Phase 1 only | Output identical to pre-change baseline |
| `npm run dry-run` after Phase 2 | Logs show `htmlSnippet` captured; `rows.length` equals bottom-bar Total |
| `AI_ENABLED=true npm run dry-run` | AI response logged, `statusConflict` WARNs visible, no sheet writes |
| `npm start` on a fresh Sabha date | `Yes`/`No` written correctly in the right column; no mis-marks |
| Known visitor name in the scrape | Attendance written to their home Sabha tab, not the scraped tab |
| `AI_ENABLED=false npm start` | Behaviour identical to the pre-AI baseline |

---

## Why This Approach

- **Root cause first**: The stability double-read directly fixes the Angular timing bug — AI is an additional verification layer, not a workaround for a broken scraper
- **One batch AI call**: All 110+ Yuvaks resolved in a single Gemini request — cost-efficient and fast (~2–3 s)
- **Conservative confidence thresholds**: Only `"high"` and `"medium"` matches are written. `"low"` and `"none"` are logged and skipped — same conservative behaviour as today
- **No new npm dependencies**: OpenRouter call uses native `fetch`; everything else already exists in the project
- **Graceful degradation**: `AI_ENABLED=false` or any API failure → falls back to exact-match, zero disruption to normal operation
