import fs from 'node:fs';
import path from 'node:path';
import { getJob } from '@/lib/jobRunner';

interface AttendanceCount {
  present?: number;
  absent?: number;
  total?: number;
}

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
  const updates = report.sheetUpdates ?? [];
  const tabs = updates.map((update) => {
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

  const sheet = tabs.reduce(
    (total, tab) => ({
      yes: total.yes + tab.yes,
      no: total.no + tab.no,
      total: total.total + tab.total,
    }),
    { yes: 0, no: 0, total: 0 }
  );

  const scrapedPresent = uniqueNames(report.scraped?.present ?? []).length;
  const scrapedAbsent = uniqueNames(report.scraped?.absent ?? []).length;
  const scraped = {
    present: finiteNumber(report.countValidation?.scraped?.present, scrapedPresent),
    absent: finiteNumber(report.countValidation?.scraped?.absent, scrapedAbsent),
    total: finiteNumber(
      report.countValidation?.scraped?.total,
      finiteNumber(report.scraped?.totalRows, scrapedPresent + scrapedAbsent)
    ),
  };
  const sampark = {
    present: finiteNumber(report.countValidation?.sampark?.present, scraped.present),
    absent: finiteNumber(report.countValidation?.sampark?.absent, scraped.absent),
    total: finiteNumber(report.countValidation?.sampark?.total, scraped.total),
  };

  const onlyInSampark = uniqueNames(report.nameComparison?.samparkOnly ?? []);
  const onlyInSheet = (report.nameComparison?.sheetOnly ?? []).map((entry) => ({
    tabName: entry.tabName ?? 'Unknown sheet',
    names: uniqueNames(entry.names ?? []),
  }));
  const skippedOrUnwritten = uniqueNames([
    ...onlyInSampark,
    ...tabs.flatMap((tab) => tab.unmatched),
  ]);

  const warnings = uniqueNames(report.warnings ?? []);
  const samparkVsScrape = report.countValidation?.matched ?? null;
  const samparkPresentVsSheetYes = updates.length > 0
    ? sampark.present === sheet.yes
    : null;
  const presentDifference = updates.length > 0
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
    dryRun: Boolean(report.dryRun),
    failedStage: report.failedStage,
    error: report.error,
  };
}

export function getAgentJobResult(jobId: string) {
  if (!/^(kishor|yuvak)-\d+$/.test(jobId)) return undefined;

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
