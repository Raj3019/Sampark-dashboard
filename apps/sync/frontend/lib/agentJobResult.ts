import fs from 'node:fs';
import path from 'node:path';
import { getJob } from '@/lib/jobRunner';

interface AttendanceCount {
  present?: number;
  absent?: number;
  total?: number;
}

/**
 * Shapes mirrored from apps/sync/src (runReport.ts, dbUpdater.ts, reportFlow.ts).
 * Fields are optional so pre-migration run reports (sheet-era shapes) still
 * summarize without crashing.
 */
interface StoredRunReport {
  runnerJobId?: string;
  runId?: string;
  startedAt?: string;
  finishedAt?: string;
  status?: 'running' | 'success' | 'failed';
  failedStage?: string;
  error?: string;
  dryRun?: boolean;
  sabhaDate?: string;
  job?: {
    id?: string;
    label?: string;
    primarySheetTab?: string;
  };
  scraped?: {
    present?: string[];
    absent?: string[];
    totalRows?: number;
  };
  countValidation?: {
    matched?: boolean;
    sampark?: AttendanceCount;
    scraped?: AttendanceCount;
  };
  nameComparison?: {
    samparkOnly?: string[];
    sheetOnly?: Array<{ tabName?: string; names?: string[] }>;
  };
  warnings?: string[];
  // Sheet-era shape (pre-migration reports only).
  sheetUpdates?: Array<{
    tabName?: string;
    present?: string[];
    absent?: string[];
    summary?: {
      matched?: number;
      unmatched?: string[];
      skippedBecauseDuplicate?: boolean;
    };
  }>;
  // Current scrape-shape (kishor/yuvak).
  visited?: Array<{
    name: string;
    actualSabha: string | null;
    actualDate: string | null;
    matchedMemberId?: string;
  }>;
  sameNameGroups?: number;
  restoredCount?: number;
  dbUpdate?: {
    sabhaType?: string;
    sessionDate?: string | null;
    sessionDateDisplay?: string;
    dryRun?: boolean;
    matched?: number;
    matchedPresent?: number;
    matchedAbsent?: number;
    correctedCount?: number;
    newCount?: number;
    unknownNames?: string[];
    visitors?: number;
    visitedCount?: number;
    visited?: Array<{
      name: string;
      actualSabha: string | null;
      actualDate: string | null;
      matchedMemberId?: string;
    }>;
    sameNameGroups?: number;
    transferredOutCount?: number;
    restoredCount?: number;
    sessionCreated?: boolean;
  };
  // Report-job shape (reportFlow.ts).
  reportFlow?: {
    source?: 'download' | 'file';
    rowsParsed?: number;
    datedColumns?: string[];
    confirmedWeek?: string | null;
    confirmedWeekStart?: string;
    confirmedWeekEnd?: string;
    mergeTargetDate?: string | null;
    confirmationSkipped?: boolean;
    blankMarkCells?: number;
    unrecognizedMarkValues?: string[];
    skippedNoMarkRows?: number;
    skippedTotalRows?: number;
    unknownSabhaRows?: Array<{ sabha?: string; memberName?: string }>;
    perSabha?: Array<{
      label?: string;
      reportSabha?: string;
      dbSabhaType?: string;
      rowsParsed?: number;
      membersMatched?: number;
      sameNameGroups?: number;
      duplicateRows?: number;
      confirmedWeek?: string | null;
      mergeTargetDate?: string | null;
      sessionsCreated?: number;
      marksUpserted?: number;
      presentMarks?: number;
      absentMarks?: number;
      newMarks?: number;
      correctedMarks?: number;
      markConflicts?: number;
      unknownNames?: string[];
    }>;
    verification?: Array<{
      label?: string;
      membersCompared?: number;
      fullyMatching?: number;
      mismatchDetails?: string[];
      unknownNames?: string[];
      confirmedWeek?: string | null;
    }>;
    conflicts?: Array<{
      sabhaLabel?: string;
      sabhaType?: string;
      member?: string;
      exportDate?: string;
      scrapeSessionDate?: string;
      scrapePresent?: boolean;
      exportPresent?: boolean;
      sessionId?: string;
    }>;
    result?: 'match' | 'drift';
    driftCount?: number;
  };
}

const AUTO_ROOT = path.join(process.cwd(), '..');
const RUNS_DIR = path.join(AUTO_ROOT, 'runs');
const REPORT_SCAN_LIMIT = 250;

function uniqueNames(names: string[]): string[] {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readReportForJob(jobId: string): StoredRunReport | undefined {
  if (!fs.existsSync(RUNS_DIR)) return undefined;

  let files: string[];
  try {
    files = fs
      .readdirSync(RUNS_DIR)
      .filter((file) => file.endsWith('.json') && file !== 'latest.json')
      .sort()
      .reverse()
      .slice(0, REPORT_SCAN_LIMIT);
  } catch {
    return undefined;
  }

  for (const file of files) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(RUNS_DIR, file), 'utf8')
      ) as StoredRunReport;
      if (parsed.runnerJobId === jobId) return parsed;
    } catch {
      // Ignore incomplete or unrelated report files and keep searching.
    }
  }

  return undefined;
}

function summarizeReport(jobId: string, report: StoredRunReport) {
  const warnings = uniqueNames(report.warnings ?? []);
  const isReportJob = Boolean(report.reportFlow?.perSabha);
  const dbUpdate = report.dbUpdate;

  // ── Tabs ───────────────────────────────────────────────────────────────────
  // scrape jobs (kishor/yuvak): one tab from report.dbUpdate.
  // report job: one tab per reportFlow.perSabha entry.
  // sheet-era reports fall back to the legacy sheetUpdates mapping.
  let tabs: Array<{
    tabName: string;
    yes: number;
    no: number;
    total: number;
    unmatched: string[];
    skippedBecauseDuplicate: boolean;
  }>;

  if (isReportJob) {
    tabs = (report.reportFlow!.perSabha ?? []).map((perSabha) => ({
      tabName: perSabha.label ?? 'Unknown sabha',
      yes: finiteNumber(perSabha.presentMarks),
      no: finiteNumber(perSabha.absentMarks),
      total: finiteNumber(perSabha.membersMatched),
      unmatched: uniqueNames(perSabha.unknownNames ?? []),
      skippedBecauseDuplicate: false,
    }));
  } else if (dbUpdate) {
    tabs = [
      {
        tabName: report.job?.label ?? dbUpdate.sabhaType ?? 'Unknown sabha',
        yes: finiteNumber(dbUpdate.matchedPresent),
        no: finiteNumber(dbUpdate.matchedAbsent),
        total: finiteNumber(dbUpdate.matched),
        unmatched: uniqueNames(dbUpdate.unknownNames ?? []),
        skippedBecauseDuplicate: false,
      },
    ];
  } else {
    // Legacy sheet-era shape (kept so old on-disk reports still summarize).
    tabs = (report.sheetUpdates ?? []).map((update) => {
      const matched = finiteNumber(update.summary?.matched);
      const unmatched = uniqueNames(update.summary?.unmatched ?? []);
      const requestedPresent = uniqueNames(update.present ?? []).length;
      const yes = Math.max(0, Math.min(matched, requestedPresent - unmatched.length));
      const no = Math.max(0, matched - yes);

      return {
        tabName: update.tabName ?? 'Unknown sheet',
        yes,
        no,
        total: matched,
        unmatched,
        skippedBecauseDuplicate: Boolean(update.summary?.skippedBecauseDuplicate),
      };
    });
  }

  const sheet = tabs.reduce(
    (total, tab) => ({
      yes: total.yes + tab.yes,
      no: total.no + tab.no,
      total: total.total + tab.total,
    }),
    { yes: 0, no: 0, total: 0 }
  );

  // ── Semantics from the new shapes ─────────────────────────────────────────
  const reportFlow = report.reportFlow;
  const unknownNamesAll = uniqueNames(tabs.flatMap((tab) => tab.unmatched));
  const conflicts = reportFlow?.conflicts ?? [];
  const transfersOut = finiteNumber(dbUpdate?.transferredOutCount);
  const transfersRestored = finiteNumber(
    dbUpdate?.restoredCount ?? report.restoredCount
  );
  const visited = uniqueNames(
    (dbUpdate?.visited ?? report.visited ?? []).map(
      (entry) => `${entry.name ?? ''} (${entry.actualSabha ?? 'unknown sabha'}${entry.actualDate ? `, ${entry.actualDate}` : ''})`
    )
  );
  const confirmedWeekISO = reportFlow?.confirmedWeek ?? undefined;
  const driftCount = finiteNumber(reportFlow?.driftCount);
  const verdict = reportFlow?.result;

  // ── Counters (scraped / sampark) ───────────────────────────────────────────
  const scrapedPresent = uniqueNames(report.scraped?.present ?? []).length;
  const scrapedAbsent = uniqueNames(report.scraped?.absent ?? []).length;
  const scrapedFromValidation = report.countValidation?.scraped;
  const scraped = isReportJob
    ? {
        present: sheet.yes,
        absent: sheet.no,
        total: sheet.yes + sheet.no,
      }
    : {
        present: finiteNumber(scrapedFromValidation?.present, scrapedPresent),
        absent: finiteNumber(scrapedFromValidation?.absent, scrapedAbsent),
        total: finiteNumber(
          scrapedFromValidation?.total,
          finiteNumber(report.scraped?.totalRows, scrapedPresent + scrapedAbsent)
        ),
      };
  const sampark = isReportJob
    ? {
        present: sheet.yes,
        absent: sheet.no,
        total: sheet.total,
      }
    : {
        present: finiteNumber(report.countValidation?.sampark?.present, scraped.present),
        absent: finiteNumber(report.countValidation?.sampark?.absent, scraped.absent),
        total: finiteNumber(report.countValidation?.sampark?.total, scraped.total),
      };

  // ── Name comparison ────────────────────────────────────────────────────────
  // Keys kept for Hermes compatibility; the new shapes have no nameComparison
  // source, so they stay empty. skippedOrUnwritten now carries the names the
  // run could not match to the roster (unknownNames).
  const onlyInSampark = uniqueNames(report.nameComparison?.samparkOnly ?? []);
  const onlyInSheet = (report.nameComparison?.sheetOnly ?? []).map((entry) => ({
    tabName: entry.tabName ?? 'Unknown sheet',
    names: uniqueNames(entry.names ?? []),
  }));
  const skippedOrUnwritten = uniqueNames([
    ...unknownNamesAll,
    ...onlyInSampark,
  ]);

  // ── Warnings ──────────────────────────────────────────────────────────────
  const samparkVsScrape = report.countValidation?.matched ?? null;
  const samparkPresentVsSheetYes = tabs.length > 0
    ? sampark.present === sheet.yes
    : null;
  const presentDifference = tabs.length > 0
    ? sampark.present - sheet.yes
    : null;

  if (onlyInSampark.length > 0) {
    warnings.push(`${onlyInSampark.length} name(s) are only in Sampark`);
  }
  if (onlyInSheet.some((entry) => entry.names.length > 0)) {
    warnings.push('One or more names are only in the Sheet roster');
  }
  if (presentDifference !== null && presentDifference !== 0) {
    warnings.push(`Sampark present and Sheet Yes differ by ${presentDifference}`);
  }
  if (tabs.some((tab) => tab.skippedBecauseDuplicate)) {
    warnings.push('One or more Sheet updates were skipped as duplicates');
  }
  if (unknownNamesAll.length > 0) {
    warnings.push(`${unknownNamesAll.length} name(s) skipped — not in roster`);
  }
  if (transfersOut > 0) {
    warnings.push(`${transfersOut} roster member(s) marked transferred_out (missing from the scrape)`);
  }
  if (transfersRestored > 0) {
    warnings.push(`${transfersRestored} transferred-out member(s) restored (seen in the scrape again)`);
  }
  if (conflicts.length > 0) {
    warnings.push(
      `${conflicts.length} scrape-vs-report conflict(s) — report value applied (auto-resolved)`
    );
  }
  if (verdict) {
    warnings.push(`RESULT: ${verdict} (drift=${driftCount})`);
  }

  const startedAt = report.startedAt;
  const finishedAt = report.finishedAt;
  const durationSeconds = startedAt && finishedAt
    ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000))
    : undefined;

  return {
    jobId,
    runId: report.runId,
    status: report.status ?? 'failed',
    completedWithWarnings: warnings.length > 0,
    startedAt,
    finishedAt,
    durationSeconds,
    sabha: {
      id: report.job?.id,
      label: report.job?.label,
      date: report.sabhaDate,
      primarySheetTab: report.job?.primarySheetTab,
    },
    sampark,
    scraped,
    sheet: { ...sheet, tabs },
    comparison: {
      samparkVsScrape,
      samparkPresentVsSheetYes,
      presentDifference,
    },
    names: {
      onlyInSampark,
      onlyInSheet,
      skippedOrUnwritten,
    },
    warnings: uniqueNames(warnings),
    // New optional fields (unknown extra fields are safely ignored by Hermes):
    jobRunKind: (reportFlow ? 'confirm' : 'scrape') as 'scrape' | 'confirm',
    ...(confirmedWeekISO ? { confirmedWeekISO } : {}),
    ...(conflicts.length > 0 ? { conflictsAutoResolved: conflicts.length } : {}),
    ...(transfersOut > 0 ? { transfersOut } : {}),
    ...(transfersRestored > 0 ? { transfersRestored } : {}),
    ...(visited.length > 0 ? { visited } : {}),
    ...(verdict ? { verdict, driftCount } : {}),
    dryRun: Boolean(report.dryRun),
    failedStage: report.failedStage,
    error: report.error,
  };
}

export function getAgentJobResult(jobId: string) {
  if (!/^(kishor|yuvak|report)-\d+$/.test(jobId)) return undefined;

  const job = getJob(jobId);
  if (job?.status === 'running') {
    return {
      jobId: job.id,
      jobType: job.jobType,
      status: 'running',
      startedAt: job.startedAt.toISOString(),
      trigger: job.trigger,
    };
  }

  const report = readReportForJob(jobId);
  if (report) return summarizeReport(jobId, report);

  if (!job) return undefined;

  return {
    jobId: job.id,
    jobType: job.jobType,
    status: job.status,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString(),
    exitCode: job.exitCode,
    error: 'The job finished but its structured run report is unavailable',
  };
}
