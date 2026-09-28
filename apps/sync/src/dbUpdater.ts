import { Pool } from "pg";
import {
  type AIResolverConfig,
  type RosterEntry,
  type ScrapedRowInput,
  resolveAttendance,
} from "./aiResolver";
import { log } from "./logger";
import { normalizeName } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

/** One scraped attendance row; `subtitle` only appears on present rows. */
export interface AttendanceRowEntry {
  name: string;
  subtitle?: string;
}

/** Parsed "SABHA_NAME | DD/MM/YYYY" subtitle for a present row. */
export interface VisitMetadata {
  sabhaType: string;
  /** ISO 'YYYY-MM-DD' from the subtitle date, or null if it could not be parsed. */
  sessionDate: string | null;
}

export interface UpsertAttendanceInput {
  sabhaType: string;
  /**
   * Optional roster scope (member.sampark_sabha value). When set, the roster
   * filter becomes `WHERE sabha_type = <sabhaType> AND sampark_sabha = <scope>`
   * — used by multi-page jobs (bal) so each scraped Sampark page only touches
   * its own sub-roster. When unset, the legacy filter
   * `WHERE sabha_type = <sabhaType> OR sampark_sabha = <sabhaType>` applies
   * (kishor/yuvak behavior unchanged — their sampark_sabha equals sabha_type).
   */
  memberScope?: string;
  /** Sabha date as produced by the scraper (Date) or raw text (string). */
  sessionDate: Date | string;
  /** Optional original display string (e.g. "27-Sep-2026") for logs/reports. */
  sessionDateDisplay?: string;
  /** Present rows; plain strings are tolerated and normalized to { name }. */
  present: Array<string | AttendanceRowEntry>;
  /** Absent rows (no subtitle); plain strings are tolerated. */
  absent: Array<string | AttendanceRowEntry>;
  /** Optional raw scraped rows so the resolver keeps htmlSnippet context. */
  rows?: ScrapedRowInput[];
}

export interface DbUpdateOptions {
  dryRun?: boolean;
  /** AI resolver settings from index.ts. AI may be disabled; exact matching always runs. */
  aiConfig?: AIResolverConfig;
}

export interface DbUpdateSummary {
  sabhaType: string;
  /** ISO 'YYYY-MM-DD' written to the DB, or null if the date couldn't be parsed. */
  sessionDate: string | null;
  /** Human-readable date for the report. */
  sessionDateDisplay: string;
  dryRun: boolean;
  // Counts count member-ROWS written — same-name fan-out marks every identical-name row.
  matched: number;
  matchedPresent: number;
  matchedAbsent: number;
  /** Matched members whose existing present-value changed (live runs only; 0 in dry-run). */
  correctedCount: number;
  /** Matched members that had no attendance row yet (dry-run: equals `matched`). */
  newCount: number;
  /** Scraped names (present or absent) that no DB member matched — skipped and reported. */
  unknownNames: string[];
  /** Visitors from other Sabhas are already handled by the scraper; always 0 here. */
  visitors: number;
  /** Matched members whose present row carried parsed visit metadata. */
  visitedCount: number;
  /** Per-member visit details, for run reports/observability. */
  visited: Array<{
    name: string;
    actualSabha: string | null;
    actualDate: string | null;
    matchedMemberId?: string;
  }>;
  /** Scraped names that matched more than one roster member row (same-name fan-out). */
  sameNameGroups: number;
  /** Auto-transfer roster (missing from present+absent) → marked transferred_out. */
  transferredOutCount: number;
  /** Roster members that appear in the scrape again and were restored. */
  restoredCount: number;
  sessionCreated: boolean;
}

// ─── DB plumbing ──────────────────────────────────────────────────────────────

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error(
        "Missing DATABASE_URL in .env — cannot connect to the Neon Postgres database."
      );
    }
    pool = new Pool({ connectionString, max: 2 });
  }
  return pool;
}

/** Marker for newly created sabha_session rows. */
export const SESSION_CREATOR = "sampark-sync";

/**
 * Parse the scraper's date into ISO 'YYYY-MM-DD' for the DB `session_date`
 * column (a Postgres `date`). Uses local date parts to avoid timezone shifts.
 */
function toIsoDateString(input: Date | string): string | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
  }

  const raw = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Tolerates "27/9/2026", "27-Sep-2026", "May 22, 2026", etc.
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toIsoDateString(parsed);

  return null;
}

function formatDisplayDate(date: Date | string | null): string {
  if (!date) return "unknown date";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function normalizeEntries(entries: Array<string | AttendanceRowEntry>): AttendanceRowEntry[] {
  return entries.map((entry) =>
    typeof entry === "string" ? { name: entry } : entry
  );
}

/**
 * Parse a "SABHA_NAME | DD/MM/YYYY" visit subtitle into DB metadata.
 * Sabha text is mapped to a canonical sabha_type where possible; unknown
 * values are kept as the raw text so nothing is ever guessed.
 */
function parseVisitSubtitle(subtitle: string): VisitMetadata | null {
  const parts = subtitle.split("|");
  if (parts.length < 1) return null;
  const sabhaRaw = (parts[0] ?? "").trim();
  const dateRaw = parts.slice(1).join("|").trim();
  if (!sabhaRaw && !dateRaw) return null;

  let sabhaType = sabhaRaw;
  const lower = sabhaRaw.toLowerCase();
  if (lower === "chirag nagar") {
    sabhaType = "Chirag Nagar";
  } else if (lower === "chirag nagar (kishore)" || lower === "chirag nagar(kishor)" || lower === "chirag nagar (kishor)") {
    sabhaType = "Chirag Nagar(Kishor)";
  } else if (lower === "bal sabha" || lower === "maneklal (bal)") {
    sabhaType = "Bal Sabha";
  }

  let sessionDate: string | null = null;
  const dateMatch = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dateMatch) {
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      sessionDate = `${year}-${pad2(month)}-${pad2(day)}`;
    } else {
      log("WARN", `Visit subtitle has an out-of-range date "${dateRaw}" — storing metadata without a date`);
    }
  } else if (dateRaw) {
    log("WARN", `Could not parse visit subtitle date "${dateRaw}" (expected DD/MM/YYYY) — storing metadata without a date`);
  }

  if (!sabhaType) return null;
  return { sabhaType, sessionDate };
}

// ─── Member matching ──────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  full_name: string;
  /** Sub-sabha tag ('Maneklal (Bal)' etc.); null for the main roster rows. */
  sampark_sabha: string | null;
  transferred_out: boolean;
}

interface NameMatchResult {
  /** memberId → isPresent, for every scraped name that was resolved. */
  marks: Map<string, boolean>;
  /** Normalized scraped name → matched members, so per-row metadata can be threaded. */
  membersByScrapedName: Map<string, MemberRow[]>;
  /** Roster rows (per-name) left unmatched, for auto-transfer detection. */
  unmatchedMemberRows: MemberRow[];
  unknownNames: string[];
  exactMatches: number;
  resolverMatches: number;
}

async function loadMembers(sabhaType: string, memberScope?: string): Promise<MemberRow[]> {
  const scope = memberScope?.trim();
  const result = scope
    ? await getPool().query<{ id: string; full_name: string; sampark_sabha: string | null; transferred_out: boolean }>(
        `SELECT id, full_name, sampark_sabha, transferred_out
         FROM member
         WHERE sabha_type = $1 AND sampark_sabha = $2`,
        [sabhaType, scope]
      )
    : await getPool().query<{ id: string; full_name: string; sampark_sabha: string | null; transferred_out: boolean }>(
        `SELECT id, full_name, sampark_sabha, transferred_out
         FROM member
         WHERE sabha_type = $1 OR sampark_sabha = $1`,
        [sabhaType]
      );
  log(
    "INFO",
    scope
      ? `Roster "${sabhaType}" scoped to sampark_sabha "${scope}": ${result.rows.length} members in DB`
      : `Roster "${sabhaType}": ${result.rows.length} members in DB (sabha_type or sampark_sabha match)`
  );
  return result.rows;
}

/**
 * Match scraped names to DB members.
 * Pass 1 — deterministic exact normalized (case-insensitive, trimmed) match.
 *   Scraped names are already deduped (uniqueEntries); one scraped name fans
 *   out to ALL same-name member rows in the scoped roster — they share one
 *   scrape mark.
 * Pass 2 — the existing AI resolver flow (aiResolver.ts) as fallback; its
 *   candidate list is fed DB member names instead of sheet rows, so
 *   `RosterEntry.sheetName` carries the sabha_type. Unmatched names are
 *   skipped and returned — members are never auto-created.
 */
async function matchNamesToMembers(
  rows: ScrapedRowInput[],
  sabhaType: string,
  aiConfig: AIResolverConfig,
  memberScope?: string
): Promise<NameMatchResult> {
  const members = await loadMembers(sabhaType, memberScope);
  const membersByCanonical = new Map<string, MemberRow[]>();
  for (const member of members) {
    const key = normalizeName(member.full_name);
    if (!key) continue;
    const group = membersByCanonical.get(key);
    if (group) group.push(member);
    else membersByCanonical.set(key, [member]);
  }

  const marks = new Map<string, boolean>();
  const membersByScrapedName = new Map<string, MemberRow[]>();
  const unmatchedMemberRows: MemberRow[] = [];
  const unknownNames: string[] = [];
  let exactMatches = 0;
  let resolverMatches = 0;
  const unresolved: ScrapedRowInput[] = [];

  for (const row of rows) {
    const group = membersByCanonical.get(normalizeName(row.name));
    if (group && group.length > 0) {
      for (const member of group) marks.set(member.id, row.isPresent);
      membersByScrapedName.set(normalizeName(row.name), group);
      exactMatches += group.length;
    } else {
      unresolved.push(row);
    }
  }

  if (unresolved.length > 0) {
    if (members.length === 0) {
      log("WARN", `No members in DB for sabha_type "${sabhaType}" — all scraped names will be skipped`);
      unknownNames.push(...unresolved.map((row) => row.name));
    } else {
      const rosters: RosterEntry[] = members.map((member) => ({
        // sheetName = sabha_type so any cross-list routing in the resolver
        // maps back to this run's single roster.
        sheetName: sabhaType,
        sabhaLabel: sabhaType,
        canonicalName: member.full_name,
      }));
      log("INFO", `${unresolved.length} name(s) had no exact DB match — trying resolver`);
      const { resolved } = await resolveAttendance(unresolved, rosters, aiConfig);

      for (const row of resolved) {
        if (row.confidence === "low" || row.confidence === "none") {
          log("WARN", `"${row.scrapedName}" — no DB member matched, skipping (${row.reason})`);
          unknownNames.push(row.scrapedName);
          continue;
        }
        if (row.statusConflict) {
          log("WARN", `Status conflict for "${row.scrapedName}": kept scrape status (${row.isPresent ? "present" : "absent"})`);
        }
        const group = membersByCanonical.get(normalizeName(row.matchedCanonicalName ?? ""));
        if (!group || group.length === 0) {
          log("WARN", `"${row.scrapedName}" — resolved to "${row.matchedCanonicalName ?? "?"}", which is not in "${sabhaType}", skipping`);
          unknownNames.push(row.scrapedName);
          continue;
        }
        // Fan out this scraped name across every same-name roster row.
        if (!membersByScrapedName.has(normalizeName(row.scrapedName))) {
          for (const member of group) marks.set(member.id, row.isPresent);
          membersByScrapedName.set(normalizeName(row.scrapedName), group);
          resolverMatches += group.length;
        }
      }
    }
  }

  const matchedRowIds = new Set<string>();
  for (const group of membersByScrapedName.values()) {
    for (const member of group) matchedRowIds.add(member.id);
  }
  for (const member of members) {
    if (!matchedRowIds.has(member.id)) unmatchedMemberRows.push(member);
  }

  return {
    marks,
    membersByScrapedName,
    unmatchedMemberRows,
    unknownNames: Array.from(new Set(unknownNames)),
    exactMatches,
    resolverMatches,
  };
}

// ─── Marks SQL (idempotent: re-runs freely overwrite present/absent) ─────────

const UPSERT_ATTENDANCE_SQL = `
  INSERT INTO attendance_record (session_id, member_id, present, actual_sabha_type, actual_session_date)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (session_id, member_id) DO UPDATE
    SET present = EXCLUDED.present,
        actual_sabha_type = EXCLUDED.actual_sabha_type,
        actual_session_date = EXCLUDED.actual_session_date,
        updated_at = NOW()
`;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Upsert one Sabha session and its attendance marks into the Neon Postgres DB.
 * Re-runs are idempotent: the session is updated in place (vakta/topic are
 * never clobbered) and attendance marks are upserted, so re-running is
 * always safe. Dry-run performs all reads/matching but skips every DB write.
 * Unmatched scraped names (present or absent) are skipped, never auto-created.
 */
export async function upsertAttendance(
  input: UpsertAttendanceInput,
  options: DbUpdateOptions = {}
): Promise<DbUpdateSummary> {
  const dryRun = options.dryRun ?? false;
  const aiConfig: AIResolverConfig = options.aiConfig ?? {
    enabled: false,
    apiKey: "",
    model: "",
    baseUrl: "",
  };

  const sabhaType = input.sabhaType;
  const isoDate = toIsoDateString(input.sessionDate);
  if (!isoDate) {
    throw new Error(`Could not parse Sabha date for the DB: ${String(input.sessionDate)}`);
  }
  const displayDate = input.sessionDateDisplay?.trim() || formatDisplayDate(input.sessionDate);

  log("INFO", `DB update for "${sabhaType}" on ${displayDate}${dryRun ? " (DRY RUN)" : ""}`);

  const presentEntries = normalizeEntries(input.present);
  const absentEntries = normalizeEntries(input.absent);

  const rows: ScrapedRowInput[] =
    input.rows ??
    [...presentEntries, ...absentEntries].map((entry, index) => ({
      name: entry.name,
      isPresent: presentEntries.some((e) => e.name === entry.name),
      htmlSnippet: "",
      rowIndex: index,
    }));

  // Parse visit subtitles ("SABHA_NAME | DD/MM/YYYY") from present rows so
  // the metadata can ride along with each member's attendance mark.
  const visitedByScrapedName = new Map<string, VisitMetadata>();
  for (const entry of presentEntries) {
    if (!entry.subtitle || !entry.subtitle.trim()) continue;
    const parsed = parseVisitSubtitle(entry.subtitle);
    if (!parsed) {
      log("WARN", `Unrecognized visit subtitle for "${entry.name}": "${entry.subtitle}" — skipped`);
      continue;
    }
    const key = normalizeName(entry.name);
    if (!visitedByScrapedName.has(key)) visitedByScrapedName.set(key, parsed);
  }
  log(
    "INFO",
    `Visit metadata: ${visitedByScrapedName.size} present row(s) carried a visit subtitle`
  );

  const match = await matchNamesToMembers(rows, sabhaType, aiConfig, input.memberScope);

  for (const name of match.unknownNames) {
    log(
      "WARN",
      `"${name}" — not found in the DB roster for "${sabhaType}" (visitor or unknown). Skipped.`
    );
  }

  // Thread the parsed per-row visit metadata onto matched members.
  const visitByMember = new Map<string, VisitMetadata & { name: string }>();
  for (const [scrapedKey, group] of match.membersByScrapedName) {
    const visit = visitedByScrapedName.get(scrapedKey);
    if (!visit) continue;
    for (const member of group) {
      if (!visitByMember.has(member.id)) {
        visitByMember.set(member.id, { ...visit, name: member.full_name });
      }
    }
  }

  // Auto-transfer detection: a scrape's present+absent lists cover the FULL
  // live roster of this sabha, so scoped members missing from both lists have
  // moved away. Members with attending=false stay matchable while listed; they
  // only transfer when missing entirely.
  const scrapedNameSet = new Set<string>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (key) scrapedNameSet.add(key);
  }
  const transferredOut: Array<{ name: string; memberCount: number }> = [];
  const restoredMembers: MemberRow[] = [];
  const transferredByName = new Map<string, number>();
  const transferredIdsByName = new Map<string, string[]>();
  for (const member of match.unmatchedMemberRows) {
    const inScrape = scrapedNameSet.has(normalizeName(member.full_name));
    if (!inScrape && !member.transferred_out) {
      transferredOut.push({ name: member.full_name, memberCount: 1 });
      transferredIdsByName.set(member.full_name, [
        ...(transferredIdsByName.get(member.full_name) ?? []),
        member.id,
      ]);
      transferredByName.set(member.full_name, (transferredByName.get(member.full_name) ?? 0) + 1);
      log("INFO", `Transferred out (missing from Sampark roster): ${member.full_name}`);
    } else if (inScrape && member.transferred_out) {
      restoredMembers.push(member);
    }
  }
  const transferred = Array.from(transferredByName.entries()).map(([name, memberCount]) => ({
    name,
    memberCount,
  }));

  const markValues = Array.from(match.marks.values());
  let sameNameGroups = 0;
  for (const group of match.membersByScrapedName.values()) {
    if (group.length > 1) sameNameGroups++;
  }
  const summary: DbUpdateSummary = {
    sabhaType,
    sessionDate: isoDate,
    sessionDateDisplay: displayDate,
    dryRun,
    matched: match.marks.size,
    matchedPresent: markValues.filter(Boolean).length,
    matchedAbsent: markValues.filter((v) => !v).length,
    correctedCount: 0,
    newCount: match.marks.size,
    unknownNames: match.unknownNames,
    visitors: 0,
    visitedCount: visitByMember.size,
    visited: Array.from(visitByMember.entries()).map(([memberId, visit]) => ({
      name: visit.name,
      actualSabha: visit.sabhaType,
      actualDate: visit.sessionDate,
      matchedMemberId: memberId,
    })),
    sameNameGroups,
    transferredOutCount: transferredOut.length,
    restoredCount: restoredMembers.length,
    sessionCreated: false,
  };

  // ── Dry-run: report what would be written, block all writes ────────────────
  if (dryRun) {
    log("INFO", `[DRY RUN] Would upsert session (${sabhaType}, ${isoDate}) by "${SESSION_CREATOR}"`);
    log("INFO", `[DRY RUN] Would upsert ${match.marks.size} attendance rows (${summary.matchedPresent} present, ${summary.matchedAbsent} absent)`);
    for (const [memberId, visit] of visitByMember) {
      log(
        "INFO",
        `[DRY RUN] Would set actual visit for "${visit.name}" (${memberId}) — ` +
          `${visit.sabhaType} on ${visit.sessionDate ?? "unparsed date"}`
      );
    }
    if (summary.sameNameGroups > 0) {
      log("INFO", `[DRY RUN] ${summary.sameNameGroups} scraped name(s) matched multiple same-name members`);
    }
    for (const entry of transferred) {
      log("INFO", `[DRY RUN] Would mark transferred out (missing from roster): ${entry.name} (${entry.memberCount} member row(s))`);
    }
    for (const member of restoredMembers) {
      log("INFO", `[DRY RUN] Would restore transferred member seen in scrape: ${member.full_name}`);
    }
    if (summary.unknownNames.length > 0) {
      log("INFO", `[DRY RUN] Would skip ${summary.unknownNames.length} unknown names: ${summary.unknownNames.join(", ")}`);
    }
    log("INFO", "[DRY RUN] No rows were actually written to the DB.");
    return summary;
  }

  // ── Live: one transaction — session upsert + attendance upserts ────────────
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Returning xm = xmax tells apart a fresh INSERT (xmax = 0) from an UPDATE.
    const sessionResult = await client.query<{ id: string; xm: string }>(
      `INSERT INTO sabha_session (sabha_type, session_date, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (sabha_type, session_date) DO UPDATE SET updated_at = NOW()
       RETURNING id, (xmax = 0)::text AS xm`,
      [sabhaType, isoDate, SESSION_CREATOR]
    );
    const sessionRow = sessionResult.rows[0];
    if (!sessionRow) throw new Error("Failed to upsert sabha_session — no row returned");
    summary.sessionCreated = sessionRow.xm === "0";

    // Existing rows, so corrected vs new can be reported accurately.
    const existing = await client.query<{ member_id: string; present: boolean }>(
      "SELECT member_id, present FROM attendance_record WHERE session_id = $1",
      [sessionRow.id]
    );
    const existingPresentByMember = new Map(
      existing.rows.map((r) => [r.member_id, r.present])
    );

    let corrected = 0;
    let created = 0;
    for (const [memberId, present] of match.marks) {
      const visit = visitByMember.get(memberId);
      await client.query(UPSERT_ATTENDANCE_SQL, [
        sessionRow.id,
        memberId,
        present,
        visit?.sabhaType ?? null,
        visit?.sessionDate ?? null,
      ]);
      const was = existingPresentByMember.get(memberId);
      if (was === undefined) created++;
      else if (was !== present) corrected++;
    }

    // Auto-transfers + restores ride in the same transaction as the marks.
    for (const entry of transferred) {
      const ids = transferredIdsByName.get(entry.name) ?? [];
      if (ids.length === 0) continue;
      await client.query(
        `UPDATE member
         SET transferred_out = true,
             transferred_out_on = $1,
             attending = false,
             updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [isoDate, ids]
      );
    }
    for (const member of restoredMembers) {
      await client.query(
        `UPDATE member
         SET transferred_out = false,
             transferred_out_on = null,
             updated_at = NOW()
         WHERE id = $1`,
        [member.id]
      );
    }

    await client.query("COMMIT");

    summary.correctedCount = corrected;
    summary.newCount = created;

    log(
      "INFO",
      `DB update saved — session ${summary.sessionCreated ? "created" : "reused"}; ` +
        `${summary.matchedPresent} present, ${summary.matchedAbsent} absent; ` +
        `${match.marks.size} marks (${created} new, ${corrected} corrected, ` +
        `${match.marks.size - created - corrected} unchanged); ` +
        `${summary.visitedCount} visited other sabha; ` +
        `${summary.unknownNames.length} unknown skipped; ` +
        `${summary.sameNameGroups} same-name groups; ` +
        `${transferred.length} transferred out, ${restoredMembers.length} restored; ` +
        `${match.exactMatches} exact matches, ${match.resolverMatches} resolver matches.`
    );
    return summary;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
