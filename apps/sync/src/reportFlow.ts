import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { Download, Locator, Page } from "playwright";
import * as XLSX from "xlsx";
import { SESSION_CREATOR, writeUnknownNameAlerts } from "./dbUpdater";
import { REPORT_SABHA_MAP, type ReportSabhaMapping } from "./jobs";
import { log } from "./logger";
import { createRunReport, saveRunReport, type RunReport } from "./runReport";
import { dumpPageState, loginToSampark, openSamparkSession } from "./scraper";
import { normalizeName } from "./utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const DOWNLOADS_DIR = path.resolve(process.cwd(), "downloads");
const REPORT_SHEET_PATTERN = /member\s*attendance/i;
/** Header count grows from ~128 to >200 once 'Chirag Nagar (Kishore)' is added. */
const MEMBER_COUNT_AFTER_FILTER = 200;
const MARK_BATCH_SIZE = 500;
const MAX_MISMATCH_DETAILS = 25;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One scrape-vs-export mark conflict recorded against a run. The report's
 * value is applied in-transaction (report wins); the alert is written,
 * auto-dismissed, and kept for observability.
 */
export interface RunReportConflict {
  sabhaLabel: string;
  sabhaType: string;
  /** Report row / DB member display name. */
  member: string;
  /** Export column date the conflict is reported against (the current week's column). */
  exportDate: string;
  /** session_date of OUR live-scrape session that disagrees. */
  scrapeSessionDate: string;
  scrapePresent: boolean;
  exportPresent: boolean;
  /** sabha_session id of the scrape session (traceability/alert detail). */
  sessionId: string;
}

/** One pre-import attendance_row from a live-scrape session (the snapshot). */
interface SnapshotMark {
  sessionId: string;
  sessionDate: string;
  present: boolean;
}

export interface ReportFlowOptions {
  dryRun: boolean;
  /**
   * Import an already-downloaded Members Attendance .xlsx instead of exporting
   * a fresh one from the Sampark Reports page (no browser, no login).
   */
  reportPath?: string;
}

export interface ReportMark {
  iso: string;
  present: boolean;
}

export interface ReportMemberRow {
  /** Raw Sabha column value as exported (e.g. 'Chirag Nagar (Kishore)'). */
  sabhaRaw: string;
  memberName: string;
  mobile: string;
  followup: string;
  total: number | null;
  presentCount: number | null;
  /** Y/N per dated column; blank cells are skipped (never guessed). */
  marks: ReportMark[];
}

export interface ReportDatedColumn {
  header: string;
  columnIndex: number;
  iso: string;
}

/**
 * The current week's confirmation column from a parsed export: the newest
 * dated column the report already carries. Weeks are Monday → Sunday, so a
 * column dated Sunday D covers [D - 6 days .. D].
 */
export interface ConfirmableWeek {
  /** Raw header text of the newest dated column. */
  header: string;
  /** ISO 'YYYY-MM-DD' of the column (the week's Sunday). */
  iso: string;
  /** Column's week window [Sunday - 6 days .. Sunday] as ISO dates. */
  weekStart: string;
  weekEnd: string;
}

export interface ParsedReport {
  filePath: string;
  sheetName: string;
  datedColumns: ReportDatedColumn[];
  rows: ReportMemberRow[];
  blankMarkCells: number;
  unrecognizedMarkValues: string[];
  skippedNoMarkRows: number;
  skippedTotalRows: number;
}

/**
 * Report-side marks restricted to the current week's column, per member id:
 * the merger's ONLY input. Historical export columns are never imported.
 */
interface MemberWeekMarks {
  memberId: string;
  name: string;
  /** Y/N from the current-week column; a blank cell simply omits the member. */
  byDate: Map<string, boolean>;
  marks: ReportMark[];
}

interface MemberRow {
  id: string;
  full_name: string;
  sampark_sabha: string | null;
  transferred_out: boolean;
}

interface ReportSabhaImport {
  mapping: ReportSabhaMapping;
  rowsParsed: number;
  duplicateRows: number;
  unknownNames: string[];
  sameNameGroups: number;
  members: MemberWeekMarks[];
  /** The current week's confirmation column (may be null when absent). */
  confirmableWeek: ConfirmableWeek | null;
  /** The scrape session the confirmation merges onto (null when none in week). */
  mergeTarget: { sessionId: string; sessionDate: string } | null;
  sessionsCreated: number;
  marksUpserted: number;
  presentMarks: number;
  absentMarks: number;
  newMarks: number;
  correctedMarks: number;
  /** scrape-vs-export conflicts for this sabha (empty in dry runs). */
  conflicts: RunReportConflict[];
}

export interface SabhaVerification {
  label: string;
  reportSabha: string;
  dbSabhaType: string;
  membersCompared: number;
  fullyMatching: number;
  mismatchDetails: string[];
  unknownNames: string[];
  dbSessionsConsidered: number;
  latestVerifiedDate: string | null;
  /** ISO date of the current week's confirmation column ('2026-09-27'). */
  confirmedWeek: string | null;
  /** Scrape session the confirmation merged onto (null when skipped/absent). */
  mergeTargetDate: string | null;
  membersNotInCurrentWeek?: string[];
}

interface ImportOutcome {
  imports: ReportSabhaImport[];
  unknownSabhaRows: Array<{ sabha: string; memberName: string }>;
}

export interface ReportFlowSummary {
  source: "download" | "file";
  filePath: string;
  sheetName: string;
  rowsParsed: number;
  /** All dated columns seen in the export (historical ones are NOT imported). */
  datedColumns: string[];
  /**
   * ISO date of the current week's confirmation column — the ONLY column the
   * import touches. Null when the export carries no dated columns.
   */
  confirmedWeek: string | null;
  /** Week window [Sunday - 6d .. Sunday] of confirmedWeek, informational. */
  confirmedWeekStart?: string;
  confirmedWeekEnd?: string;
  /**
   * The existing scrape session the confirmation merged onto. Null when no
   * scrape session exists in the current week (confirmation skipped).
   */
  mergeTargetDate?: string | null;
  /** True when confirmation was skipped for the current week (no scrape session). */
  confirmationSkipped: boolean;
  blankMarkCells: number;
  unrecognizedMarkValues: string[];
  skippedNoMarkRows: number;
  skippedTotalRows: number;
  unknownSabhaRows: Array<{ sabha: string; memberName: string }>;
  perSabha: Array<{
    label: string;
    reportSabha: string;
    dbSabhaType: string;
    rowsParsed: number;
    membersMatched: number;
    sameNameGroups: number;
    duplicateRows: number;
    /** ISO date of the current week's column null when absent. */
    confirmedWeek: string | null;
    /** Scrape session date the merge targeted (null when skipped/absent). */
    mergeTargetDate: string | null;
    sessionsCreated: number;
    marksUpserted: number;
    presentMarks: number;
    absentMarks: number;
    newMarks: number;
    correctedMarks: number;
    markConflicts: number;
    unknownNames: string[];
  }>;
  verification: SabhaVerification[];
  /** Scrape-vs-export conflicts detected for this run (auto-resolved). */
  conflicts: RunReportConflict[];
  result: "match" | "drift";
  driftCount: number;
}

interface ReportFlowRunReport extends RunReport {
  reportFlow?: ReportFlowSummary;
}

// ─── DB plumbing (mirrors dbUpdater.ts) ───────────────────────────────────────

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

// ─── Sync alerts (dashboard /admin/alerts) ────────────────────────────────────

/** Source value for alerts raised by the Members Attendance report flow. */
const ALERT_SOURCE_REPORT = "member-attendance-report";
const ALERT_KIND_UNKNOWN_NAME = "unknown_name";
const ALERT_KIND_MARK_CONFLICT = "mark_conflict";

/**
 * Refresh semantics per (source, kind, sabha_type, sampark_sabha): delete
 * UNDISMISSED rows of that combination (dismissed rows are history kept
 * forever), then the caller inserts the current run's set. NULL-safe on
 * sampark_sabha (report alerts are always sampark_sabha = NULL).
 */
const DELETE_UNDISMISSED_ALERTS_SQL = `
  DELETE FROM sync_alert
  WHERE source = $1
    AND kind = $2
    AND sabha_type = $3
    AND sampark_sabha IS NOT DISTINCT FROM $4
    AND dismissed = false
`;

const INSERT_MARK_CONFLICT_ALERTS_SQL = `
  INSERT INTO sync_alert (source, kind, sabha_type, sampark_sabha, member_name, ref_date, message, detail, dismissed, dismissed_at)
  SELECT $1, $2, $3, NULL, member_name, ref_date::date, message,
         jsonb_build_object(
           'scrapeSessionDate', scrape_session_date,
           'scrapePresent', scrape_present::boolean,
           'exportPresent', export_present::boolean,
           'sessionId', session_id),
         true, NOW()
  FROM unnest($4::text[], $5::text[], $6::text[], $7::text[], $8::boolean[], $9::boolean[], $10::text[])
       AS t(member_name, ref_date, scrape_session_date, message, scrape_present, export_present, session_id)
`;

/**
 * Snapshot of the merge-target scrape session's attendance rows BEFORE the
 * confirmation writes: one sampark-sync session (the current week's chosen
 * merge target), filtered again by sabha_type/created_by for safety.
 */
const SCRAPE_SNAPSHOT_SQL = `
  SELECT s.id AS session_id,
         s.session_date::text AS session_date,
         ar.member_id,
         ar.present
  FROM sabha_session s
  JOIN attendance_record ar ON ar.session_id = s.id
  WHERE s.sabha_type = $1
    AND s.created_by = $2
    AND s.id = $3::uuid
`;

/**
 * Pick the merge target for one (sabha_type, current-week) bucket: the
 * LATEST sampark-sync session dated inside [colDate - 6d .. colDate], but
 * never one keyed exactly ON the export column (report-imported rows share
 * the same created_by marker, so those are excluded here in code). Null when
 * the sabha has not met yet this week — confirmation is then skipped and no
 * session is ever created.
 */
async function loadMergeTarget(
  dbSabhaType: string,
  colDate: string
): Promise<{ sessionId: string; sessionDate: string } | null> {
  const weekStart = shiftIsoDate(colDate, -6);
  const result = await getPool().query<{ session_id: string; session_date: string }>(
    `SELECT s.id AS session_id, s.session_date::text AS session_date
     FROM sabha_session s
     WHERE s.sabha_type = $1
       AND s.created_by = $2
       AND s.session_date >= $3::date
       AND s.session_date <= $4::date
     ORDER BY s.session_date DESC`,
    [dbSabhaType, SESSION_CREATOR, weekStart, colDate]
  );
  // Sessions dated exactly ON the export column belong to earlier report
  // imports (same created_by marker) — they are not scrape sessions.
  const target = result.rows.find((row) => row.session_date !== colDate);
  if (!target) {
    log(
      "INFO",
      `[merge] no scraped session in the current week (${weekStart} .. ${colDate}) for "${dbSabhaType}" — confirmation skipped; marks remain as scraped`
    );
    return null;
  }
  if (result.rows.length > 1) {
    log(
      "INFO",
      `[merge] ${result.rows.length} scraped session(s) inside the current week for "${dbSabhaType}" — ` +
        `merging onto the latest (${target.session_date})`
    );
  }
  return { sessionId: target.session_id, sessionDate: target.session_date };
}

/**
 * Load the pre-confirmation snapshot of live-scrape marks per member for ONE
 * session (the merge target): every sampark-sync attendance row on that
 * session. Members without a snapshot row simply get a plain INSERT.
 */
async function loadScrapeSnapshot(
  dbSabhaType: string,
  sessionId: string
): Promise<Map<string, SnapshotMark[]>> {
  const result = await getPool().query<{
    session_id: string;
    session_date: string;
    member_id: string;
    present: boolean;
  }>(SCRAPE_SNAPSHOT_SQL, [dbSabhaType, SESSION_CREATOR, sessionId]);

  const snapshot = new Map<string, SnapshotMark[]>();
  for (const row of result.rows) {
    const mark: SnapshotMark = {
      sessionId: row.session_id,
      sessionDate: row.session_date,
      present: row.present,
    };
    const list = snapshot.get(row.member_id);
    if (list) list.push(mark);
    else snapshot.set(row.member_id, [mark]);
  }
  log(
    "INFO",
    `[alerts] scrape snapshot for "${dbSabhaType}" (session ${result.rows[0]?.session_date ?? sessionId}): ` +
      `${result.rows.length} pre-confirmation attendance row(s), ${snapshot.size} member(s)`
  );
  return snapshot;
}

/** Shift an ISO 'YYYY-MM-DD' date by whole days (UTC-safe, no DST drift). */
function shiftIsoDate(iso: string, days: number): string {
  const parts = iso.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** alert message per the approved wording (report value always applied). */
function conflictAlertMessage(conflict: RunReportConflict): string {
  return (
    `Fetched present=${conflict.scrapePresent ? "Y" : "N"} on ${conflict.scrapeSessionDate} ` +
    `but report says present=${conflict.exportPresent ? "Y" : "N"} for week of ${conflict.exportDate} ` +
    `— report value applied`
  );
}

/**
 * Derive scrape-vs-export conflicts for one sabha's CURRENT WEEK: for each
 * matched member's export cell, the merge-target scrape session whose mark
 * disagrees becomes a conflict (PRE-import comparison; the report value is
 * then applied in-transaction).
 */
function deriveMarkConflicts(
  entry: ReportSabhaImport,
  snapshotByMember: Map<string, SnapshotMark[]>
): RunReportConflict[] {
  const conflicts: RunReportConflict[] = [];
  if (!entry.mergeTarget) return conflicts;
  for (const member of entry.members) {
    const snapshot = snapshotByMember.get(member.memberId);
    if (!snapshot) continue;
    for (const mark of member.marks) {
      if (mark.iso !== entry.confirmableWeek?.iso) continue;
      for (const snap of snapshot) {
        if (snap.sessionId !== entry.mergeTarget.sessionId) continue;
        if (snap.present === mark.present) continue;
        conflicts.push({
          sabhaLabel: entry.mapping.label,
          sabhaType: entry.mapping.sabhaType,
          member: member.name,
          exportDate: mark.iso,
          scrapeSessionDate: snap.sessionDate,
          scrapePresent: snap.present,
          exportPresent: mark.present,
          sessionId: snap.sessionId,
        });
      }
    }
  }
  return conflicts;
}

/**
 * Record mark_conflict alerts (delete-then-insert per sabha) in their own
 * transaction — runs AFTER the confirmation transaction has committed, so
 * alert writes never disturb already-saved report marks. Each row is
 * immediately self-dismissed (dismissed=true, dismissed_at=NOW()): the
 * conflict is auto-resolved the moment the report value is applied; the row
 * remains as audit history but never appears in the dashboard's open list.
 */
async function writeMarkConflictAlerts(conflicts: RunReportConflict[]): Promise<number> {
  if (conflicts.length === 0) return 0;
  const bySabha = new Map<string, RunReportConflict[]>();
  for (const conflict of conflicts) {
    const list = bySabha.get(conflict.sabhaType);
    if (list) list.push(conflict);
    else bySabha.set(conflict.sabhaType, [conflict]);
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    let written = 0;
    for (const [sabhaType, sabhaConflicts] of bySabha) {
      // Dedupe on (member, exportDate, session): a same-name fan-out or a
      // repeated dated column would otherwise duplicate alert rows.
      const seen = new Set<string>();
      const unique = sabhaConflicts.filter((conflict) => {
        const key = `${conflict.member}|${conflict.exportDate}|${conflict.sessionId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await client.query(DELETE_UNDISMISSED_ALERTS_SQL, [
        ALERT_SOURCE_REPORT,
        ALERT_KIND_MARK_CONFLICT,
        sabhaType,
        null,
      ]);
      if (unique.length === 0) continue;
      await client.query(INSERT_MARK_CONFLICT_ALERTS_SQL, [
        ALERT_SOURCE_REPORT,
        ALERT_KIND_MARK_CONFLICT,
        sabhaType,
        unique.map((conflict) => conflict.member),
        unique.map((conflict) => conflict.exportDate),
        unique.map((conflict) => conflict.scrapeSessionDate),
        unique.map((conflict) => conflictAlertMessage(conflict)),
        unique.map((conflict) => conflict.scrapePresent),
        unique.map((conflict) => conflict.exportPresent),
        unique.map((conflict) => conflict.sessionId),
      ]);
      written += unique.length;
      log(
        "INFO",
        `[alerts] ${ALERT_SOURCE_REPORT}/${ALERT_KIND_MARK_CONFLICT} for "${sabhaType}": ` +
          `${unique.length} alert(s) written and auto-resolved (dismissed=true)`
      );
    }
    await client.query("COMMIT");
    return written;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Report rows carry no visit subtitles, so actual_* stay NULL (INSERT leaves
// them at their default; the conflict branch only corrects `present`).
const MARK_UPSERT_SQL = `
  INSERT INTO attendance_record (session_id, member_id, present, actual_sabha_type, actual_session_date)
  SELECT m.session_id, m.member_id, m.present, NULL::text, NULL::date
  FROM unnest($1::uuid[], $2::uuid[], $3::boolean[]) AS m(session_id, member_id, present)
  ON CONFLICT (session_id, member_id) DO UPDATE
    SET present = EXCLUDED.present,
        updated_at = NOW()
`;

async function loadRoster(dbSabhaType: string): Promise<MemberRow[]> {
  const result = await getPool().query<{
    id: string;
    full_name: string;
    sampark_sabha: string | null;
    transferred_out: boolean;
  }>(
    `SELECT id, full_name, sampark_sabha, transferred_out
     FROM member
     WHERE sabha_type = $1 OR sampark_sabha = $1`,
    [dbSabhaType]
  );
  log(
    "INFO",
    `Roster "${dbSabhaType}": ${result.rows.length} members in DB (sabha_type or sampark_sabha match)`
  );
  return result.rows;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

interface SelectorCandidate {
  name: string;
  locator: Locator;
}

async function clickFirstMatching(
  page: Page,
  tag: string,
  candidates: SelectorCandidate[],
  networkLog: string[]
): Promise<void> {
  for (const candidate of candidates) {
    try {
      await candidate.locator.waitFor({ state: "visible", timeout: 5_000 });
      await candidate.locator.click({ timeout: 10_000 });
      log("INFO", `[${tag}] clicked via selector: ${candidate.name}`);
      return;
    } catch {
      log("WARN", `[${tag}] selector did not match — trying next: ${candidate.name}`);
    }
  }
  await dumpPageState(page, `${tag}-selector-failed`, networkLog);
  throw new Error(
    `[${tag}] no selector matched — screenshot/HTML dumped to runs/. Tried: ${candidates
      .map((candidate) => candidate.name)
      .join(" | ")}`
  );
}

interface FilterCheckboxResult {
  found: boolean;
  checked: boolean;
  matchedText: string;
}

/**
 * Find the filter-screen checkbox whose nearest text-bearing ancestor row is
 * the given label, and (ensure mode) click it via the DOM so Angular handlers
 * fire even when the input itself is visually hidden. Label matching is exact
 * first ('Chirag Nagar' must not match 'Chirag Nagar (Kishore)'), then
 * prefix-based excluding rows that start with one of the OTHER labels.
 */
async function withFilterCheckbox(
  page: Page,
  label: string,
  allLabels: string[],
  mode: "read" | "ensure"
): Promise<FilterCheckboxResult> {
  return page.evaluate(
    ({ target, labels, ensure }: { target: string; labels: string[]; ensure: boolean }): FilterCheckboxResult => {
      const norm = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim().toLowerCase();
      const want = norm(target);
      const otherLabels = labels.map(norm).filter((other) => other !== want);

      const nodes = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLElement>("input[type='checkbox'], [role='checkbox']")
      );

      const readRowText = (element: Element): string => {
        let row: HTMLElement | null = element.parentElement;
        for (let depth = 0; row && depth < 8; depth++, row = row.parentElement) {
          const text = norm(row.innerText);
          if (text) return text;
        }
        return "";
      };

      const isChecked = (element: HTMLElement): boolean =>
        element.getAttribute("aria-checked") === "true" ||
        (element as HTMLInputElement).checked === true;

      let exact: HTMLElement | null = null;
      let prefix: { element: HTMLElement; text: string } | null = null;
      for (const element of nodes) {
        const rowText = readRowText(element);
        if (!rowText) continue;
        if (rowText === want) {
          exact = element;
          break;
        }
        if (
          !prefix &&
          rowText.startsWith(want) &&
          !otherLabels.some((other) => rowText.startsWith(other))
        ) {
          prefix = { element, text: rowText };
        }
      }

      const element = exact ?? prefix?.element ?? null;
      if (!element) return { found: false, checked: false, matchedText: "" };

      if (ensure && !isChecked(element)) element.click();

      return {
        found: true,
        checked: isChecked(element),
        matchedText: exact ? "exact row" : prefix?.text ?? "prefix row",
      };
    },
    { target: label, labels: allLabels, ensure: mode === "ensure" }
  );
}

async function ensureFilterRowChecked(
  page: Page,
  label: string,
  allLabels: string[],
  networkLog: string[]
): Promise<void> {
  let result = await withFilterCheckbox(page, label, allLabels, "ensure");
  if (!result.found) {
    await page.waitForTimeout(1_000);
    result = await withFilterCheckbox(page, label, allLabels, "ensure");
  }
  if (!result.found) {
    await dumpPageState(page, "report-filter-row-not-found", networkLog);
    throw new Error(`Filter screen row "${label}" not found — page state dumped to runs/`);
  }

  await page.waitForTimeout(500);
  const state = await withFilterCheckbox(page, label, allLabels, "read");
  if (!state.checked) {
    // Fallback: some filter UIs toggle on the visible row/label itself.
    try {
      await page.getByText(label, { exact: true }).first().click({ timeout: 5_000 });
      await page.waitForTimeout(500);
    } catch {
      // the final state check below decides
    }
    const finalState = await withFilterCheckbox(page, label, allLabels, "read");
    if (!finalState.checked) {
      await dumpPageState(page, "report-filter-row-not-checked", networkLog);
      throw new Error(
        `Filter row "${label}" could not be checked (matched: ${result.matchedText}) — page state dumped to runs/`
      );
    }
  }
  log("INFO", `Filter row "${label}" is checked`);
}

// ─── UI flow: login → Reports → Members Attendance → filter → export ─────────

async function exportMembersAttendanceReport(report: ReportFlowRunReport): Promise<string> {
  const websiteUrl = process.env.WEBSITE_URL?.trim() || "https://m.sampark369.org/";
  const filterSabhaLabels = REPORT_SABHA_MAP.map((mapping) => mapping.reportSabha);
  const { browser, context, page, networkLog } = await openSamparkSession();

  const waitOrDump = async (tag: string, action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      await dumpPageState(page, tag, networkLog);
      throw error;
    }
  };

  const readMemberCount = async (): Promise<number | null> => {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const match = text.match(/\((\d+)\s*Members\)/i);
    return match ? Number(match[1]) : null;
  };

  try {
    try {
      await loginToSampark(page, networkLog);
    } catch (error) {
      await dumpPageState(page, "report-login-failed", networkLog);
      throw error;
    }

    // ── Dashboard → hamburger menu → 'Reports' (/reports/landing) ────────────
    // The menu drawer may already be rendered open on the dashboard; only
    // click a toggle button when 'Reports' is not reachable yet.
    const reportsAlreadyVisible = await page
      .getByText(/^Reports$/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!reportsAlreadyVisible) {
      await clickFirstMatching(
        page,
        "menu-button",
        [
        { name: "role button /menu/i", locator: page.getByRole("button", { name: /menu/i }).first() },
        { name: "[aria-label*='menu']", locator: page.locator("[aria-label*='menu' i]").first() },
        {
          name: "mat-icon 'menu'",
          locator: page.locator("mat-icon").filter({ hasText: /^menu$/i }).first(),
        },
        { name: "button:has-text('menu')", locator: page.locator("button:has-text('menu')").first() },
        { name: "[class*='hamburger']", locator: page.locator("[class*='hamburger' i]").first() },
        { name: "[class*='menu-toggle']", locator: page.locator("[class*='menu-toggle' i]").first() },
        {
          name: "header first button",
          locator: page
            .locator("[class*='header'] button, header button, [class*='toolbar'] button")
            .first(),
        },
        ],
        networkLog
      );
    } else {
      console.log("[INFO] Menu drawer already open — skipping toggle click");
    }

    let reportsClicked = true;
    try {
      await clickFirstMatching(
        page,
        "reports-menu-item",
        [
          { name: "role link 'Reports'", locator: page.getByRole("link", { name: /^reports$/i }).first() },
          { name: "role button 'Reports'", locator: page.getByRole("button", { name: /^reports$/i }).first() },
          { name: "text 'Reports'", locator: page.getByText(/^Reports$/i).first() },
          {
            name: "menu container 'Reports'",
            locator: page
              .locator(
                "[class*='drawer'] :text('Reports'), [class*='menu'] :text('Reports'), a:has-text('Reports'), button:has-text('Reports')"
              )
              .first(),
          },
        ],
        networkLog
      );
    } catch {
      reportsClicked = false;
      log("WARN", "Menu item 'Reports' not found — falling back to direct /reports/landing navigation");
    }
    if (reportsClicked) {
      await waitOrDump("reports-landing-not-loaded", () =>
        page.waitForURL(/reports/i, { timeout: 30_000 })
      );
    } else {
      await page.goto(new URL("/reports/landing", websiteUrl).toString(), { waitUntil: "domcontentloaded" });
      await waitOrDump("reports-landing-not-loaded", () =>
        page.waitForURL(/reports/i, { timeout: 30_000 })
      );
    }
    await page.waitForTimeout(4_000);

    // ── Reports landing → 'Members Attendance' card ──────────────────────────
    await clickFirstMatching(
      page,
      "members-attendance-card",
      [
        {
          name: "text 'Members Attendance'",
          locator: page.getByText(/members\s+attendance/i).first(),
        },
        {
          name: "role link 'Members Attendance'",
          locator: page.getByRole("link", { name: /members\s+attendance/i }).first(),
        },
        {
          name: "role button 'Members Attendance'",
          locator: page.getByRole("button", { name: /members\s+attendance/i }).first(),
        },
        {
          name: "card/link/button container",
          locator: page
            .locator(
              "[class*='card']:has-text('Members Attendance'), a:has-text('Members Attendance'), button:has-text('Members Attendance')"
            )
            .first(),
        },
      ],
      networkLog
    );
    await waitOrDump("members-attendance-page-not-loaded", async () => {
      await page.getByText(/export\s*report/i).first().waitFor({ state: "visible", timeout: 30_000 });
    });
    await page.waitForTimeout(2_000);

    const beforeCount = await readMemberCount();
    if (beforeCount === null) {
      report.warnings.push(
        "Members Attendance header count could not be read (expected e.g. '(128 Members)') — continuing with the filter re-apply"
      );
    } else {
      log("INFO", `Members Attendance header member count before filter: ${beforeCount}`);
    }

    // ── Filter icon → re-apply Sabha rows → Apply ────────────────────────────
    await clickFirstMatching(
      page,
      "filter-icon",
      [
        { name: "a.modal-trigger[href='#filterlist']", locator: page.locator("a.modal-trigger[href='#filterlist']").first() },
        { name: "i.fa-sliders-h trigger", locator: page.locator("a.modal-trigger:has(i.far.fa-sliders-h)").first() },
        { name: ".filter-main badge trigger", locator: page.locator("span.filter-main").locator("xpath=..").first() },
        { name: "[aria-label*='filter']", locator: page.locator("[aria-label*='filter' i]").first() },
        { name: "role button /filter/i", locator: page.getByRole("button", { name: /filter/i }).first() },
        {
          name: "[class*='filter'] button/icon",
          locator: page
            .locator("button[class*='filter' i], [class*='filter-icon' i], [class*='filterIcon']")
            .first(),
        },
        {
          name: "mat-icon filter variants",
          locator: page
            .locator("mat-icon")
            .filter({ hasText: /^(filter_list|filter_alt|tune|sort)$/i })
            .first(),
        },
        {
          name: "svg[class*='filter']",
          locator: page.locator("svg[class*='filter' i]").first(),
        },
        {
          name: "header last svg button",
          locator: page
            .locator("[class*='header'] button:has(svg), header button:has(svg), [class*='toolbar'] button:has(svg)")
            .last(),
        },
      ],
      networkLog
    );
    await waitOrDump("filter-screen-not-loaded", async () => {
      await Promise.race([
        page.getByRole("button", { name: /apply/i }).first().waitFor({ state: "visible", timeout: 20_000 }),
        page.getByText(/^apply$/i).first().waitFor({ state: "visible", timeout: 20_000 }),
      ]);
    });

    for (const label of filterSabhaLabels) {
      await ensureFilterRowChecked(page, label, filterSabhaLabels, networkLog);
    }

    await clickFirstMatching(
      page,
      "apply-filter",
      [
        { name: "role button 'Apply'", locator: page.getByRole("button", { name: /^apply$/i }).first() },
        { name: "text 'Apply'", locator: page.getByText(/^apply$/i).first() },
        { name: "button:has-text('Apply')", locator: page.locator("button:has-text('Apply')").first() },
      ],
      networkLog
    );

    await waitOrDump("report-list-did-not-update", async () => {
      const handle = await page.waitForFunction(
        () => {
          const text = document.body?.innerText ?? "";
          const match = text.match(/\((\d+)\s*Members\)/i);
          if (match && Number(match[1]) > 200) return true;
          return /chirag nagar \(kishore\)/i.test(text);
        },
        undefined,
        { timeout: 45_000 }
      );
      await handle.dispose();
    });
    await page.waitForTimeout(3_000);

    const afterCount = await readMemberCount();
    log("INFO", `Members Attendance list after filter — header member count: ${afterCount ?? "?"}`);
    if (afterCount !== null && afterCount <= MEMBER_COUNT_AFTER_FILTER) {
      const warning = `Members Attendance header count after filter is ${afterCount} (expected > ${MEMBER_COUNT_AFTER_FILTER}) — 'Chirag Nagar (Kishore)' rows may be missing; continuing with the export`;
      report.warnings.push(warning);
      log("WARN", warning);
    }

    // ── Export Report → Download Locally → save xlsx ─────────────────────────
    const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
    await clickFirstMatching(
      page,
      "export-report-button",
      [
        {
          name: "role button 'Export Report'",
          locator: page.getByRole("button", { name: /export\s*report/i }).first(),
        },
        { name: "text 'Export Report'", locator: page.getByText(/export\s*report/i).first() },
        {
          name: "button/link 'Export Report'",
          locator: page
            .locator("button:has-text('Export Report'), a:has-text('Export Report')")
            .first(),
        },
      ],
      networkLog
    );

    await clickFirstMatching(
      page,
      "download-locally-item",
      [
        { name: "text 'Download Locally'", locator: page.getByText(/download\s*locally/i).first() },
        {
          name: "role button 'Download Locally'",
          locator: page.getByRole("button", { name: /download\s*locally/i }).first(),
        },
        {
          name: "menu item 'Download Locally'",
          locator: page
            .locator(
              "button:has-text('Download Locally'), a:has-text('Download Locally'), [class*='menu'] :text('Download Locally')"
            )
            .first(),
        },
      ],
      networkLog
    );

    let download: Download;
    try {
      download = await downloadPromise;
    } catch (error) {
      await dumpPageState(page, "download-event-timeout", networkLog);
      throw error;
    }

    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    // Stable canonical filename: every run overwrites the same file so any
    // deployment/automation always finds the report at one location.
    const filePath = path.join(DOWNLOADS_DIR, "Member_Attendance.xlsx");
    await download.saveAs(filePath);
    log(
      "INFO",
      `Downloaded Members Attendance report: ${filePath} (suggested filename: ${download.suggestedFilename()})`
    );
    return filePath;
  } finally {
    await context.close().catch((error: Error) => {
      log("WARN", `Browser context cleanup failed: ${error.message}`);
    });
    await browser.close().catch((error: Error) => {
      log("WARN", `Browser cleanup failed: ${error.message}`);
    });
  }
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function normalizeCell(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function parseCount(value: unknown): number | null {
  const text = normalizeCell(value);
  return /^\d+$/.test(text) ? Number(text) : null;
}

/** '27 Sep 2026' / '27-Sep-2026' / '27/Sep/2026' → '2026-09-27'. */
function parseDatedHeader(header: string): string | null {
  const match = header.match(/^(\d{1,2})[ \-/]([A-Za-z]{3,9})[ \-/](\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${match[3]}-${pad(month + 1)}-${pad(day)}`;
}

export function parseMemberAttendanceReport(filePath: string): ParsedReport {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames.find((name) =>
    REPORT_SHEET_PATTERN.test(name.replace(/\s+/g, " "))
  );
  if (!sheetName) {
    throw new Error(
      `No "Member Attendance" sheet found in ${filePath}. Sheets: ${workbook.SheetNames.join(", ")}`
    );
  }
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  if (grid.length === 0) {
    throw new Error(`Sheet "${sheetName}" in ${filePath} is empty`);
  }

  const header = (grid[0] ?? []).map(normalizeCell);
  const findColumn = (predicate: (normalized: string) => boolean): number =>
    header.findIndex(predicate);

  const sabhaIdx = findColumn((h) => h.toLowerCase() === "sabha");
  const nameIdx = findColumn((h) => h.toLowerCase() === "member name");
  const mobileIdx = findColumn((h) => h.toLowerCase() === "mobile");
  const followupIdx = findColumn((h) => /^followup$/i.test(h));
  const totalIdx = findColumn((h) => h.toLowerCase() === "total");
  const presentIdx = findColumn((h) => h.toLowerCase() === "present");

  if (nameIdx === -1 || sabhaIdx === -1) {
    throw new Error(
      `Sheet "${sheetName}" is missing required columns "Member Name" / "Sabha". Header row: ${header.join(" | ")}`
    );
  }

  const datedColumns: ReportDatedColumn[] = [];
  header.forEach((cell, columnIndex) => {
    if (columnIndex <= presentIdx) return;
    const iso = parseDatedHeader(cell);
    if (iso) datedColumns.push({ header: cell, columnIndex, iso });
  });
  if (datedColumns.length === 0) {
    throw new Error(
      `Sheet "${sheetName}" has no dated attendance columns (expected headers like "27 Sep 2026"). Header row: ${header.join(" | ")}`
    );
  }

  const rows: ReportMemberRow[] = [];
  let blankMarkCells = 0;
  const unrecognizedMarkValues = new Set<string>();
  let skippedNoMarkRows = 0;
  let skippedTotalRows = 0;

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const gridRow = grid[rowIndex] ?? [];
    const memberName = normalizeCell(gridRow[nameIdx]);
    if (!memberName) continue;
    if (/^(grand\s+)?total$/i.test(memberName)) {
      skippedTotalRows++;
      continue;
    }

    const marks: ReportMark[] = [];
    for (const column of datedColumns) {
      const value = normalizeCell(gridRow[column.columnIndex]).toUpperCase();
      if (!value) {
        blankMarkCells++;
        continue;
      }
      if (value === "Y") marks.push({ iso: column.iso, present: true });
      else if (value === "N") marks.push({ iso: column.iso, present: false });
      else unrecognizedMarkValues.add(value);
    }
    if (marks.length === 0) {
      skippedNoMarkRows++;
      log(
        "WARN",
        `Report row "${memberName}" (${normalizeCell(gridRow[sabhaIdx])}) has no Y/N marks — skipped`
      );
      continue;
    }

    rows.push({
      sabhaRaw: normalizeCell(gridRow[sabhaIdx]),
      memberName,
      mobile: mobileIdx >= 0 ? normalizeCell(gridRow[mobileIdx]) : "",
      followup: followupIdx >= 0 ? normalizeCell(gridRow[followupIdx]) : "",
      total: totalIdx >= 0 ? parseCount(gridRow[totalIdx]) : null,
      presentCount: presentIdx >= 0 ? parseCount(gridRow[presentIdx]) : null,
      marks,
    });
  }

  return {
    filePath,
    sheetName,
    datedColumns,
    rows,
    blankMarkCells,
    unrecognizedMarkValues: Array.from(unrecognizedMarkValues).sort(),
    skippedNoMarkRows,
    skippedTotalRows,
  };
}

// ─── Import (match → current-week merge onto scraped sessions) ────────────────

/**
 * Pick the CURRENT week's confirmation column: the parsed export's NEWEST
 * dated column (Sampark appends each generation week on the right). All older
 * columns are ignored entirely — never imported, never logged per-week. The
 * week bucket is always [col - 6d .. col] regardless of the column's weekday;
 * a non-Sunday newest column is logged as a WARN, not a hard failure (an
 * export produced mid-week still carries a usable confirmation column).
 */
function pickCurrentWeek(datedColumns: ReportDatedColumn[]): ConfirmableWeek {
  // Export column order is not guaranteed (newest-first here), so the
  // "current week" is the greatest ISO date among the columns.
  const newest = datedColumns.reduce((best, col) => (col.iso > best.iso ? col : best), datedColumns[0]);
  const weekday = new Date(`${newest.iso}T00:00:00Z`).getUTCDay();
  if (weekday !== 0) {
    log(
      "WARN",
      `Newest export column "${newest.header}" (${newest.iso}) is not a Sunday — the report flow expects week-ending (Sunday) generation dates; using the [col - 6d .. col] bucket as-is`
    );
  }
  return {
    header: newest.header,
    iso: newest.iso,
    weekStart: shiftIsoDate(newest.iso, -6),
    weekEnd: newest.iso,
  };
}

/**
 * Restrict the matched members' marks to the current week's column. Members
 * whose current-week cell is blank (no Y/N) are dropped — a blank cell is
 * "no confirmation", never a guess.
 */
function restrictToCurrentWeek(
  members: MemberWeekMarks[],
  colDate: string
): MemberWeekMarks[] {
  const restricted: MemberWeekMarks[] = [];
  for (const member of members) {
    const present = member.byDate.get(colDate);
    if (present !== undefined) {
      restricted.push({
        memberId: member.memberId,
        name: member.name,
        byDate: new Map([[colDate, present]]),
        marks: [{ iso: colDate, present }],
      });
    }
  }
  return restricted;
}

async function matchReportRows(
  grouped: Map<string, ReportMemberRow[]>,
  rosters: Map<string, MemberRow[]>,
  colDate: string
): Promise<ReportSabhaImport[]> {
  const imports: ReportSabhaImport[] = [];
  for (const mapping of REPORT_SABHA_MAP) {
    const rows = grouped.get(normalizeName(mapping.reportSabha)) ?? [];
    let roster = rosters.get(mapping.sabhaType);
    if (!roster) {
      roster = await loadRoster(mapping.sabhaType);
      rosters.set(mapping.sabhaType, roster);
    }

    const membersByCanonical = new Map<string, MemberRow[]>();
    for (const member of roster) {
      const key = normalizeName(member.full_name);
      if (!key) continue;
      const group = membersByCanonical.get(key);
      if (group) group.push(member);
      else membersByCanonical.set(key, [member]);
    }

    const memberMarksById = new Map<string, MemberWeekMarks>();
    const unknownNames: string[] = [];
    const seenNames = new Set<string>();
    let duplicateRows = 0;
    let sameNameGroups = 0;

    for (const row of rows) {
      const key = normalizeName(row.memberName);
      const group = membersByCanonical.get(key);
      if (!group || group.length === 0) {
        unknownNames.push(row.memberName);
        log(
          "WARN",
          `"${row.memberName}" — not found in the DB roster for "${mapping.sabhaType}". Skipped.`
        );
        continue;
      }
      if (seenNames.has(key)) {
        duplicateRows++;
        log(
          "WARN",
          `Duplicate report row for "${row.memberName}" in "${mapping.reportSabha}" — the last row wins`
        );
      } else {
        seenNames.add(key);
      }
      if (group.length > 1) sameNameGroups++;

      // Same-name fan-out: every matched member row gets this report row's
      // current-week Y/N (the only cell this flow imports).
      for (const member of group) {
        let memberMarks = memberMarksById.get(member.id);
        if (!memberMarks) {
          memberMarks = {
            memberId: member.id,
            name: member.full_name,
            byDate: new Map<string, boolean>(),
            marks: [],
          };
          memberMarksById.set(member.id, memberMarks);
        }
        const present = row.marks.find((mark) => mark.iso === colDate);
        if (present && !memberMarks.byDate.has(colDate)) {
          memberMarks.byDate.set(colDate, present.present);
          memberMarks.marks.push(present);
        }
      }
    }

    imports.push({
      mapping,
      rowsParsed: rows.length,
      duplicateRows,
      unknownNames,
      sameNameGroups,
      members: Array.from(memberMarksById.values()),
      confirmableWeek: null,
      mergeTarget: null,
      sessionsCreated: 0,
      marksUpserted: 0,
      presentMarks: 0,
      absentMarks: 0,
      newMarks: 0,
      correctedMarks: 0,
      conflicts: [],
    });
  }
  return imports;
}

function countMarks(imports: ReportSabhaImport[]): void {
  for (const entry of imports) {
    for (const member of entry.members) {
      for (const present of member.byDate.values()) {
        entry.marksUpserted++;
        if (present) entry.presentMarks++;
        else entry.absentMarks++;
      }
    }
  }
}

async function importReport(parsed: ParsedReport, dryRun: boolean): Promise<ImportOutcome> {
  const grouped = new Map<string, ReportMemberRow[]>();
  const unknownSabhaRows: Array<{ sabha: string; memberName: string }> = [];
  const mappingByNormalized = new Map(
    REPORT_SABHA_MAP.map((mapping) => [normalizeName(mapping.reportSabha), mapping] as const)
  );
  for (const row of parsed.rows) {
    const mapping = mappingByNormalized.get(normalizeName(row.sabhaRaw));
    if (!mapping) {
      unknownSabhaRows.push({ sabha: row.sabhaRaw, memberName: row.memberName });
      continue;
    }
    const key = normalizeName(mapping.reportSabha);
    const group = grouped.get(key);
    if (group) group.push(row);
    else grouped.set(key, [row]);
  }
  if (unknownSabhaRows.length > 0) {
    const values = Array.from(new Set(unknownSabhaRows.map((row) => row.sabha))).join(", ");
    log(
      "WARN",
      `${unknownSabhaRows.length} report row(s) carry an unmapped Sabha value (${values}) — skipped`
    );
  }

  // CURRENT-WEEK CONFIRMATION ONLY: pick the newest dated column already in
  // the export and ignore every older column completely.
  const confirmableWeek = pickCurrentWeek(parsed.datedColumns);
  log(
    "INFO",
    `[merge] current-week column: "${confirmableWeek.header}" (${confirmableWeek.iso}); ` +
      `week ${confirmableWeek.weekStart} .. ${confirmableWeek.weekEnd}; ` +
      `${parsed.datedColumns.length - 1} older column(s) ignored (no historical backfill)`
  );

  const rosters = new Map<string, MemberRow[]>();
  const imports = await matchReportRows(grouped, rosters, confirmableWeek.iso);

  for (const entry of imports) {
    entry.confirmableWeek = confirmableWeek;
    // Merge target: the DB's REAL scraped session of this sabha inside the
    // SAME week bucket [colDate - 6d .. colDate] (latest session_date wins).
    // Null when the sabha has not met yet this week — the confirmation for
    // that entry is then skipped; NO session is ever created.
    entry.mergeTarget = await loadMergeTarget(entry.mapping.sabhaType, confirmableWeek.iso);
    // Only members with an actual Y/N cell in the current-week column confirm.
    entry.members = restrictToCurrentWeek(entry.members, confirmableWeek.iso);
  }
  countMarks(imports);

  if (dryRun) {
    for (const entry of imports) {
      if (!entry.mergeTarget) {
        log(
          "INFO",
          `[DRY RUN] "${entry.mapping.sabhaType}": no scraped session in the current week — ` +
            `confirmation would be skipped (no session created, no marks written)`
        );
      } else {
        log(
          "INFO",
          `[DRY RUN] "${entry.mapping.sabhaType}": would confirm ${entry.marksUpserted} member mark(s) ` +
            `(${entry.presentMarks} present, ${entry.absentMarks} absent) onto scraped session ` +
            `${entry.mergeTarget.sessionDate} for week of ${confirmableWeek.iso}`
        );
      }
      if (entry.unknownNames.length > 0) {
        log(
          "INFO",
          `[DRY RUN] Would skip ${entry.unknownNames.length} unknown name(s): ${entry.unknownNames.join(", ")}`
        );
      }
    }
    log("INFO", "[DRY RUN] No rows were actually written to the DB.");
    return { imports, unknownSabhaRows };
  }

  // Pre-confirmation snapshot (read-only): capture OUR live-scrape marks per
  // member on the merge target BEFORE the confirmation writes, so
  // scrape-vs-export conflicts compare against the scraped DB state.
  const snapshotsByEntry = new Map<ReportSabhaImport, Map<string, SnapshotMark[]>>();
  for (const entry of imports) {
    if (!entry.mergeTarget) continue;
    snapshotsByEntry.set(
      entry,
      await loadScrapeSnapshot(entry.mapping.sabhaType, entry.mergeTarget.sessionId)
    );
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // NO session upserts: confirmations merge onto existing scraped sessions
    // only. An entry whose merge target is missing is skipped for this week.
    const existingByKey = new Map<string, boolean>();
    for (const entry of imports) {
      if (!entry.mergeTarget) continue;
      const existing = await client.query<{ member_id: string; present: boolean }>(
        "SELECT member_id, present FROM attendance_record WHERE session_id = $1",
        [entry.mergeTarget.sessionId]
      );
      for (const row of existing.rows) {
        existingByKey.set(`${entry.mergeTarget.sessionId}:${row.member_id}`, row.present);
      }
    }

    for (const entry of imports) {
      const target = entry.mergeTarget;
      if (!target) continue;
      entry.conflicts = deriveMarkConflicts(entry, snapshotsByEntry.get(entry) ?? new Map());
      const sessionIds: string[] = [];
      const memberIds: string[] = [];
      const presents: boolean[] = [];
      for (const member of entry.members) {
        // The export's current-week cell is keyed to the report-generation
        // date (confirmableWeek.iso); the merge target is the real scraped
        // sabha session (target.sessionDate) inside the same week bucket.
        // Map cell → target session, never by iso equality.
        const cell = member.byDate.get(confirmableWeek.iso);
        if (cell === undefined) continue;
        sessionIds.push(target.sessionId);
        memberIds.push(member.memberId);
        presents.push(cell);
        const was = existingByKey.get(`${target.sessionId}:${member.memberId}`);
        if (was === undefined) entry.newMarks++;
        else if (was !== cell) entry.correctedMarks++;
      }
      for (let start = 0; start < sessionIds.length; start += MARK_BATCH_SIZE) {
        const end = start + MARK_BATCH_SIZE;
        await client.query(MARK_UPSERT_SQL, [
          sessionIds.slice(start, end),
          memberIds.slice(start, end),
          presents.slice(start, end),
        ]);
      }
    }

    // unknown_name alerts ride in the confirmation transaction: refresh (delete
    // undismissed, insert the current set) per (source, kind, sabha_type).
    for (const entry of imports) {
      await writeUnknownNameAlerts(client, {
        source: ALERT_SOURCE_REPORT,
        sabhaType: entry.mapping.sabhaType,
        samparkSabha: null,
        refDate: entry.confirmableWeek?.iso ?? null,
        unknownNames: entry.unknownNames,
        presentCount: entry.presentMarks,
        absentCount: entry.absentMarks,
      });
    }

    await client.query("COMMIT");

    // Post-commit: record the derived conflicts as alerts. Each row is
    // auto-resolved (dismissed=true, dismissed_at=NOW()) because the report
    // value was already applied in-transaction; a failed alert write must not
    // fail the import.
    for (const entry of imports) {
      if (entry.conflicts.length > 0) {
        log(
          "WARN",
          `[alerts] ${entry.conflicts.length} mark_conflict(s) for "${entry.mapping.sabhaType}" — report value applied: ` +
            entry.conflicts
              .slice(0, MAX_MISMATCH_DETAILS)
              .map((conflict) => conflictAlertMessage(conflict))
              .join("; ")
        );
      }
    }
    try {
      await writeMarkConflictAlerts(imports.flatMap((entry) => entry.conflicts));
    } catch (alertError) {
      log(
        "ERROR",
        `[alerts] mark_conflict alert writes failed (import already committed): ` +
          `${alertError instanceof Error ? alertError.message : String(alertError)}`
      );
    }

    for (const entry of imports) {
      log(
        "INFO",
        entry.mergeTarget
          ? `Report confirmation saved for "${entry.mapping.sabhaType}" — merged onto scraped session ` +
              `${entry.mergeTarget.sessionDate} (0 sessions created); ${entry.marksUpserted} marks ` +
              `(${entry.presentMarks} present, ${entry.absentMarks} absent; ${entry.newMarks} new, ` +
              `${entry.correctedMarks} corrected, ` +
              `${entry.marksUpserted - entry.newMarks - entry.correctedMarks} unchanged); ` +
              `${entry.conflicts.length} mark conflict(s) auto-resolved; ` +
              `${entry.unknownNames.length} unknown skipped; ${entry.sameNameGroups} same-name group(s).`
          : `Report confirmation skipped for "${entry.mapping.sabhaType}" — no scraped session in the current ` +
              `week (${entry.confirmableWeek?.weekStart ?? "?"} .. ${entry.confirmableWeek?.iso ?? "?"}); ` +
              `marks remain as scraped (no session created, no marks written).`
      );
    }
    return { imports, unknownSabhaRows };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// ─── Cross-verification ───────────────────────────────────────────────────────

async function verifySabhaImport(entry: ReportSabhaImport): Promise<SabhaVerification> {
  // Verify ONLY the current week's confirmation: compare every member's Y/N
  // cell for the newest export column against the merge-target scrape session
  // in the DB. There is no backfill to re-verify — historical columns were
  // never imported.
  const confirmedWeek = entry.confirmableWeek;
  if (!confirmedWeek || !entry.mergeTarget) {
    // No scraped session in the current week (or no dated column): nothing
    // was compared — a skipped confirmation is NOT counted as drift.
    return {
      label: entry.mapping.label,
      reportSabha: entry.mapping.reportSabha,
      dbSabhaType: entry.mapping.sabhaType,
      membersCompared: 0,
      fullyMatching: 0,
      mismatchDetails: [],
      unknownNames: entry.unknownNames,
      dbSessionsConsidered: 0,
      latestVerifiedDate: null,
      confirmedWeek: confirmedWeek?.iso ?? null,
      mergeTargetDate: entry.mergeTarget?.sessionDate ?? null,
    };
  }
  const latestDate = confirmedWeek.iso;
  const sessions = await getPool().query<{ id: string; session_date: string }>(
    `SELECT id, session_date::text AS session_date
     FROM sabha_session
     WHERE sabha_type = $1 AND session_date::text = $2::text
     ORDER BY session_date`,
    [entry.mapping.sabhaType, entry.mergeTarget.sessionDate]
  );
  const sessionIds = sessions.rows.map((row) => row.id);

  const presentByMemberSession = new Set<string>();
  if (sessionIds.length > 0) {
    const records = await getPool().query<{ member_id: string; session_id: string; present: boolean }>(
      "SELECT member_id, session_id, present FROM attendance_record WHERE session_id = ANY($1::uuid[])",
      [sessionIds]
    );
    for (const record of records.rows) {
      if (record.present) presentByMemberSession.add(`${record.session_id}:${record.member_id}`);
    }
  }
  const sessionIdByDate = new Map(sessions.rows.map((row) => [row.session_date, row.id] as const));

  let fullyMatching = 0;
  const mismatchDetails: string[] = [];
  for (const member of entry.members) {
    // Current-week-only verification: confirmation cell vs the merge target.
    const mark = member.marks.find((markItem) => markItem.iso === latestDate);
    if (!mark) continue;
    const sessionId = sessionIdByDate.get(entry.mergeTarget.sessionDate);
    const dbPresentHere = sessionId
      ? presentByMemberSession.has(`${sessionId}:${member.memberId}`)
      : null;

    if (dbPresentHere === null || dbPresentHere === mark.present) {
      fullyMatching++;
    } else {
      mismatchDetails.push(
        `"${member.name}": export ${mark.present ? "Y" : "N"} vs DB ${dbPresentHere ? "Y" : "N"} (${mark.iso})`
      );
    }
  }

  return {
    label: entry.mapping.label,
    reportSabha: entry.mapping.reportSabha,
    dbSabhaType: entry.mapping.sabhaType,
    // Members with no current-week cell were never confirmed — not compared.
    membersCompared: entry.members.length,
    fullyMatching,
    mismatchDetails,
    unknownNames: entry.unknownNames,
    dbSessionsConsidered: sessionIds.length,
    latestVerifiedDate: entry.mergeTarget.sessionDate,
    confirmedWeek: confirmedWeek.iso,
    mergeTargetDate: entry.mergeTarget.sessionDate,
  };
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

export async function runReportFlowCli(options: ReportFlowOptions): Promise<void> {
  const dryRun = options.dryRun;
  const report: ReportFlowRunReport = createRunReport(dryRun, false);
  report.job = {
    id: "report",
    label: "Members Attendance report (export & import)",
    samparkSabhaName: "Reports → Members Attendance",
    sabhaType: "Chirag Nagar + Chirag Nagar(Kishor)",
  };

  let stage = "startup";
  try {
    stage = "export-report";
    let source: "download" | "file" = "download";
    let filePath: string;
    if (options.reportPath?.trim()) {
      source = "file";
      filePath = path.resolve(options.reportPath.trim());
      if (!fs.existsSync(filePath)) {
        throw new Error(`--report file not found: ${filePath}`);
      }
      log("INFO", `Importing Members Attendance report from file: ${filePath}`);
    } else {
      filePath = await exportMembersAttendanceReport(report);
    }

    stage = "parse-xlsx";
    const parsed = parseMemberAttendanceReport(filePath);
    if (parsed.unrecognizedMarkValues.length > 0) {
      const warning = `Unrecognized mark cell value(s) ignored: ${parsed.unrecognizedMarkValues.join(", ")}`;
      report.warnings.push(warning);
      log("WARN", warning);
    }
    if (parsed.blankMarkCells > 0) {
      log(
        "WARN",
        `${parsed.blankMarkCells} blank dated cell(s) in the export — treated as "no mark" (not written)`
      );
    }
    log(
      "INFO",
      `Parsed "${parsed.sheetName}": ${parsed.rows.length} member row(s), ${parsed.datedColumns.length} dated column(s) ` +
        `(${parsed.datedColumns[0]?.header} → ${parsed.datedColumns[parsed.datedColumns.length - 1]?.header})`
    );

    stage = "import-db";
    const { imports, unknownSabhaRows } = await importReport(parsed, dryRun);
    const conflicts = imports.flatMap((entry) => entry.conflicts);

    stage = "verify";
    const verification: SabhaVerification[] = [];
    for (const entry of imports) {
      verification.push(await verifySabhaImport(entry));
    }
    // Auto-resolved conflicts are the confirmation policy doing its job, not
    // unresolved drift — they surface as alerts, not as a drift verdict.
    const driftCount = verification.reduce(
      (acc, item) => acc + (item.membersCompared - item.fullyMatching) + item.unknownNames.length,
      0
    );
    const result: "match" | "drift" = driftCount === 0 ? "match" : "drift";

    const summaryLines: string[] = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ` Members Attendance Report — Current-Week Confirmation${dryRun ? " (DRY RUN)" : ""}`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ` Source: ${source === "download" ? "fresh download" : "file"} — ${filePath}`,
      ` Rows: ${parsed.rows.length} across ${imports.length} sabha(s); dated columns: ${parsed.datedColumns.length}`,
    ];
    if (imports[0]?.confirmableWeek) {
      summaryLines.push(
        ` Current week: ${imports[0].confirmableWeek.iso} ` +
          `(${imports[0].confirmableWeek.weekStart} .. ${imports[0].confirmableWeek.weekEnd}); ` +
          `older columns ignored`
      );
    }
    for (const entry of imports) {
      summaryLines.push(
        ` [${entry.mapping.label}] ${entry.mapping.reportSabha} → ${entry.mapping.sabhaType}: ` +
          `${entry.members.length} member row(s) matched, ` +
          (entry.mergeTarget
            ? `merge target ${entry.mergeTarget.sessionDate}`
            : `no scrape session in current week (confirmation skipped)`) +
          `, ${entry.marksUpserted} marks (${entry.presentMarks} present, ${entry.absentMarks} absent` +
          `${dryRun ? "" : `; ${entry.newMarks} new, ${entry.correctedMarks} corrected`})`
      );
      if (entry.unknownNames.length > 0) {
        summaryLines.push(
          ` [${entry.mapping.label}] Not in roster (${entry.unknownNames.length}): ${entry.unknownNames.join(", ")}`
        );
      }
    }
    summaryLines.push(` Cross-verification (current-week confirmation only):`);
    for (const item of verification) {
      let line = ` ${item.label} (${item.latestVerifiedDate ?? "no dated cell"}): ${item.fullyMatching}/${item.membersCompared} members fully matching`;
      const details = item.mismatchDetails
        .slice(0, MAX_MISMATCH_DETAILS)
        .join("; ")
        .concat(
          item.mismatchDetails.length > MAX_MISMATCH_DETAILS
            ? ` …(+${item.mismatchDetails.length - MAX_MISMATCH_DETAILS} more)`
            : ""
        );
      if (details || item.unknownNames.length > 0) {
        line += ",";
        if (details) line += ` mismatches: ${details}`;
        if (item.unknownNames.length > 0) {
          line += `${details ? ";" : ""} not in DB roster: ${item.unknownNames.join(", ")}`;
        }
      }
      summaryLines.push(line);
    }
    if (conflicts.length > 0) {
      summaryLines.push(
        ` Mark conflicts (${conflicts.length}) — fetched flag vs report; report value applied, alerts auto-resolved:`
      );
      for (const conflict of conflicts.slice(0, MAX_MISMATCH_DETAILS)) {
        summaryLines.push(
          ` [${conflict.sabhaLabel}] ${conflict.member}: scrape ${conflict.scrapePresent ? "Y" : "N"} ` +
            `on ${conflict.scrapeSessionDate} vs report ${conflict.exportPresent ? "Y" : "N"} for week of ${conflict.exportDate}`
        );
      }
      if (conflicts.length > MAX_MISMATCH_DETAILS) {
        summaryLines.push(` …(+${conflicts.length - MAX_MISMATCH_DETAILS} more)`);
      }
    }
    summaryLines.push(` RESULT: ${result} (${driftCount})`);
    if (dryRun) {
      summaryLines.push(
        " (DRY RUN — DB was not updated; verification reflects the pre-import state)"
      );
    }
    summaryLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log("INFO", summaryLines.join("\n"));

    report.reportFlow = {
      source,
      filePath,
      sheetName: parsed.sheetName,
      rowsParsed: parsed.rows.length,
      datedColumns: parsed.datedColumns.map((column) => column.iso),
      confirmedWeek: imports[0]?.confirmableWeek?.iso ?? null,
      confirmedWeekStart: imports[0]?.confirmableWeek?.weekStart,
      confirmedWeekEnd: imports[0]?.confirmableWeek?.weekEnd,
      mergeTargetDate: imports.find((entry) => entry.mergeTarget)?.mergeTarget?.sessionDate ?? null,
      confirmationSkipped: imports.every((entry) => !entry.mergeTarget),
      blankMarkCells: parsed.blankMarkCells,
      unrecognizedMarkValues: parsed.unrecognizedMarkValues,
      skippedNoMarkRows: parsed.skippedNoMarkRows,
      skippedTotalRows: parsed.skippedTotalRows,
      unknownSabhaRows,
      perSabha: imports.map((entry) => ({
        label: entry.mapping.label,
        reportSabha: entry.mapping.reportSabha,
        dbSabhaType: entry.mapping.sabhaType,
        rowsParsed: entry.rowsParsed,
        membersMatched: entry.members.length,
        sameNameGroups: entry.sameNameGroups,
        duplicateRows: entry.duplicateRows,
        confirmedWeek: entry.confirmableWeek?.iso ?? null,
        mergeTargetDate: entry.mergeTarget?.sessionDate ?? null,
        sessionsCreated: entry.sessionsCreated,
        marksUpserted: entry.marksUpserted,
        presentMarks: entry.presentMarks,
        absentMarks: entry.absentMarks,
        newMarks: entry.newMarks,
        correctedMarks: entry.correctedMarks,
        markConflicts: entry.conflicts.length,
        unknownNames: entry.unknownNames,
      })),
      verification,
      conflicts,
      result,
      driftCount,
    };

    if (source === "download") {
      try {
        fs.rmSync(filePath, { force: true });
        log("INFO", `Cleaned up downloaded Members Attendance report: ${filePath}`);
      } catch (cleanupError) {
        log(
          "WARN",
          `Could not delete the downloaded report (kept at ${filePath}): ` +
            `${cleanupError instanceof Error ? cleanupError.message : cleanupError}`
        );
      }
    }
    report.status = "success";
    try {
      const reportPath = saveRunReport(report);
      log("INFO", `Full report saved: ${reportPath}`);
    } catch (reportError) {
      log("ERROR", "Report flow completed, but the run report could not be saved", reportError);
    }
  } catch (error) {
    report.status = "failed";
    report.failedStage = stage;
    report.error = error instanceof Error ? error.message : String(error);
    log("ERROR", `Members Attendance report flow FAILED during stage "${stage}"`, error);
    try {
      const reportPath = saveRunReport(report);
      log("ERROR", `Run report saved after failure: ${reportPath}`);
    } catch (reportError) {
      log("ERROR", "Could not save the failure report; preserving the original run error", reportError);
    }
    throw error;
  }
}
