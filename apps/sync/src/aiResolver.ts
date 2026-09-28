import { log } from "./logger";
import { normalizeName } from "./utils";

export interface ScrapedRowInput {
  name: string;
  isPresent: boolean;
  htmlSnippet: string;
  rowIndex: number;
}

export interface RosterEntry {
  sheetName: string;
  sabhaLabel: string;
  canonicalName: string;
}

export type ResolveConfidence = "high" | "medium" | "low" | "none";

export interface ResolvedRow {
  scrapedName: string;
  isPresent: boolean;
  matchedCanonicalName: string | null;
  matchedSheetName: string | null;
  confidence: ResolveConfidence;
  reason: string;
  statusVerified: boolean;
  statusConflict: boolean;
}

export interface AIResolverConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface ResolveAttendanceResult {
  resolved: ResolvedRow[];
  fallbackUsed: boolean;
}

const SYSTEM_PROMPT = `You are an attendance reconciliation assistant for a spiritual youth organization (Sabha).

Task: match scraped attendance rows to roster entries and verify each person's present/absent status.

Name matching rules:
- Missing middle names are a match: "Rishi Soni" = "Rishi Sunil Soni"
- Spelling/transliteration variants are a match: "Aayush" = "Ayush"
- Only last-name matches are confidence "low" - do NOT write if low
- No credible match -> confidence "none"

Status verification: isPresent comes from Sampark's own Present/Absent filtered list and is the primary source of truth.
Examine htmlSnippet only as a sanity check for obvious contradictions.
Do NOT override isPresent solely because a checkbox element looks checked/unchecked; Angular may recycle checkbox DOM state.
If HTML strongly contradicts the filtered-list status, keep isPresent unchanged, set statusConflict=true, and explain the contradiction.

Cross-Sabha: if the name matches a roster in a DIFFERENT tab, still match it with that tab's sheetName.

Confidence levels:
- "high": first+last name match unambiguously (middle name may differ)
- "medium": last name + at least one syllable of first name match
- "low": only last name OR only phonetic similarity
- "none": no credible match

IMPORTANT — output count: return EXACTLY one element for each scraped row and
nothing else. Do NOT add elements for roster members who were not in the scraped
rows. The array length MUST equal the number of scraped rows, in the same order.

Output ONLY a raw JSON array - no markdown, no explanation, no code fences.
Each element must have exactly these fields:
{ "scrapedName", "isPresent", "matchedCanonicalName", "matchedSheetName",
  "confidence", "reason", "statusVerified", "statusConflict" }`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeUserPrompt(rows: ScrapedRowInput[], rosters: RosterEntry[]): string {
  const compactRows = rows.map((row) => ({
    name: row.name,
    isPresent: row.isPresent,
    htmlSnippet: row.htmlSnippet.slice(0, 500),
    rowIndex: row.rowIndex,
  }));

  return [
    "SCRAPED ROWS:",
    JSON.stringify(compactRows),
    "",
    "ROSTER (all Sabha tabs):",
    JSON.stringify(rosters),
    "",
    `Return the JSON array for all ${rows.length} rows in the same order as the input.`,
  ].join("\n");
}

function parseAIResponse(text: string): ResolvedRow[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("AI response was not a JSON array");

  return parsed.map((row) => {
    const r = row as Partial<ResolvedRow>;
    return {
      scrapedName: String(r.scrapedName ?? ""),
      isPresent: Boolean(r.isPresent),
      matchedCanonicalName: r.matchedCanonicalName ? String(r.matchedCanonicalName) : null,
      matchedSheetName: r.matchedSheetName ? String(r.matchedSheetName) : null,
      confidence: isConfidence(r.confidence) ? r.confidence : "none",
      reason: String(r.reason ?? ""),
      statusVerified: Boolean(r.statusVerified),
      statusConflict: Boolean(r.statusConflict),
    };
  });
}

function isConfidence(value: unknown): value is ResolveConfidence {
  return value === "high" || value === "medium" || value === "low" || value === "none";
}

async function callGemini(
  rows: ScrapedRowInput[],
  rosters: RosterEntry[],
  config: AIResolverConfig
): Promise<ResolvedRow[]> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": "https://github.com/sabhaSync",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: makeUserPrompt(rows, rosters) },
      ],
      temperature: 0,
      // Cap output tokens. Without this the API reserves the model's full max
      // (65535), which a low-balance key can't afford → a 402 rejection. ~200
      // scraped rows of compact JSON fit comfortably under 20k.
      max_tokens: 20000,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI resolver request failed: ${res.status} ${await res.text()}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI resolver returned no message content");

  const parsed = parseAIResponse(content);

  // The model often returns a slightly different row count than we asked for
  // (e.g. it adds roster members that weren't scraped). Rather than discard all
  // the AI's work on a count mismatch, reconcile its output back to the exact
  // scraped rows: match by name, keep the scrape's present/absent status, and
  // fill any rows the AI dropped with an exact-match lookup.
  const resolved = reconcileToInputRows(rows, parsed, rosters);

  if (parsed.length !== rows.length) {
    log(
      "INFO",
      `AI returned ${parsed.length} rows for ${rows.length} scraped — reconciled by name`
    );
  }

  // Sanity floor: if the AI matched almost nothing, treat this attempt as failed
  // so we retry / fall back rather than trusting a garbage response.
  const matchedByAI = resolved.filter((r) => r.matchedCanonicalName).length;
  if (matchedByAI < rows.length * 0.5) {
    throw new Error(
      `AI resolver matched only ${matchedByAI}/${rows.length} rows (below 50% floor)`
    );
  }

  return resolved;
}

/**
 * Align an AI response back to the exact set of scraped rows. AI results are
 * keyed by normalized name; each input row uses its AI match if present,
 * otherwise an exact-match roster lookup. `isPresent` always comes from the
 * scrape (the source of truth), never from the AI's echo.
 */
function reconcileToInputRows(
  rows: ScrapedRowInput[],
  aiResolved: ResolvedRow[],
  rosters: RosterEntry[]
): ResolvedRow[] {
  const aiByName = new Map<string, ResolvedRow>();
  for (const r of aiResolved) {
    const key = normalizeName(r.scrapedName);
    if (key && !aiByName.has(key)) aiByName.set(key, r);
  }

  const fallback = exactMatchFallback(rows, rosters); // one per input row, index-aligned

  return rows.map((row, i) => {
    const ai = aiByName.get(normalizeName(row.name));
    if (ai) {
      return { ...ai, scrapedName: row.name, isPresent: row.isPresent };
    }
    return fallback[i];
  });
}

function exactMatchFallback(rows: ScrapedRowInput[], rosters: RosterEntry[]): ResolvedRow[] {
  const rosterByName = new Map<string, RosterEntry>();
  for (const entry of rosters) {
    const key = normalizeName(entry.canonicalName);
    if (!rosterByName.has(key)) rosterByName.set(key, entry);
  }

  return rows.map((row) => {
    const match = rosterByName.get(normalizeName(row.name));
    return {
      scrapedName: row.name,
      isPresent: row.isPresent,
      matchedCanonicalName: match?.canonicalName ?? null,
      matchedSheetName: match?.sheetName ?? null,
      confidence: match ? "high" : "none",
      reason: match ? "Exact normalized name match" : "No exact normalized name match",
      statusVerified: false,
      statusConflict: false,
    };
  });
}

function buildExactRosterMap(rosters: RosterEntry[]): Map<string, RosterEntry> {
  const rosterByName = new Map<string, RosterEntry>();
  for (const entry of rosters) {
    const key = normalizeName(entry.canonicalName);
    if (!rosterByName.has(key)) rosterByName.set(key, entry);
  }
  return rosterByName;
}

function applyExactMatchOverrides(
  rows: ScrapedRowInput[],
  resolved: ResolvedRow[],
  rosters: RosterEntry[]
): ResolvedRow[] {
  const rosterByName = buildExactRosterMap(rosters);

  return resolved.map((row, index) => {
    const scrapedName = rows[index]?.name ?? row.scrapedName;
    const exact = rosterByName.get(normalizeName(scrapedName));
    if (!exact) return row;

    const needsOverride =
      row.confidence === "low" ||
      row.confidence === "none" ||
      !row.matchedCanonicalName ||
      !row.matchedSheetName;

    if (needsOverride) {
      log(
        "WARN",
        `AI gave low/no match for exact roster name "${scrapedName}" - overriding to high confidence`
      );
    }

    return {
      ...row,
      scrapedName,
      matchedCanonicalName: exact.canonicalName,
      matchedSheetName: exact.sheetName,
      confidence: "high",
      reason: needsOverride ? "Exact normalized roster match override" : row.reason,
    };
  });
}

export async function resolveAttendance(
  rows: ScrapedRowInput[],
  rosters: RosterEntry[],
  config: AIResolverConfig
): Promise<ResolveAttendanceResult> {
  if (!config.enabled) {
    log("INFO", "AI resolver disabled; using exact-match fallback");
    return { resolved: exactMatchFallback(rows, rosters), fallbackUsed: true };
  }

  if (!config.apiKey) {
    log("WARN", "AI resolver enabled but OPENROUTER_API_KEY is missing; using exact-match fallback");
    return { resolved: exactMatchFallback(rows, rosters), fallbackUsed: true };
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log("INFO", `Resolving attendance with AI (${config.model}), attempt ${attempt}`);
      const resolved = await callGemini(rows, rosters, config);
      return { resolved: applyExactMatchOverrides(rows, resolved, rosters), fallbackUsed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("WARN", `AI resolver attempt ${attempt} failed: ${message}`);
      if (attempt < 2) await sleep(2_000);
    }
  }

  log("WARN", "AI resolver failed twice; using exact-match fallback");
  return { resolved: exactMatchFallback(rows, rosters), fallbackUsed: true };
}
