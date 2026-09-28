import fs from "node:fs";
import path from "node:path";
import type { ResolvedRow } from "./aiResolver";
import type { DbUpdateSummary } from "./dbUpdater";
import type { AttendanceCountValidation } from "./scraper";

export interface RunReport {
  runId: string;
  runnerJobId?: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "failed";
  failedStage?: string;
  trigger: "manual" | "cron" | "agent" | "cli";
  job?: {
    id: string;
    label: string;
    samparkSabhaName: string;
    /** All Sampark pages synced in one run (multi-page jobs such as bal). */
    samparkSabhaNames?: string[];
    sabhaType: string;
  };
  dryRun: boolean;
  force: boolean;
  sabhaDate?: string;
  scraped?: {
    present: string[];
    absent: string[];
    totalRows: number;
  };
  /** Members who attended another sabha (from "SABHA | date" subtitles). */
  visited?: Array<{
    name: string;
    actualSabha: string | null;
    actualDate: string | null;
    matchedMemberId?: string;
  }>;
  /** Scraped names that matched more than one same-name member row. */
  sameNameGroups?: number;
  /** Roster members restored (seen again in the scrape) from transferred_out. */
  restoredCount?: number;
  /** Per-page scrape+DB results for multi-page jobs (e.g. bal syncing two Sampark pages). */
  pages?: Array<{
    samparkSabha: string;
    presentCount: number;
    absentCount: number;
    matched: number;
  }>;
  countValidation?: AttendanceCountValidation;
  warnings: string[];
  resolver?: {
    fallbackUsed: boolean;
    resolved: ResolvedRow[];
  };
  dbUpdate?: DbUpdateSummary;
  error?: string;
}

const reportsDir = path.resolve(process.cwd(), "runs");

export function createRunReport(dryRun: boolean, force: boolean): RunReport {
  const startedAt = new Date().toISOString();
  return {
    runnerJobId: process.env.SABHA_SYNC_JOB_ID?.trim() || undefined,
    runId: startedAt.replace(/[:.]/g, "-"),
    startedAt,
    status: "running",
    trigger:
      process.env.SABHA_SYNC_TRIGGER === "cron" ||
      process.env.SABHA_SYNC_TRIGGER === "manual" ||
      process.env.SABHA_SYNC_TRIGGER === "agent"
        ? process.env.SABHA_SYNC_TRIGGER
        : "cli",
    dryRun,
    force,
    warnings: [],
  };
}

export function saveRunReport(report: RunReport): string {
  fs.mkdirSync(reportsDir, { recursive: true });
  report.finishedAt = report.finishedAt ?? new Date().toISOString();

  const filePath = path.join(reportsDir, `${report.runId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const latestPath = path.join(reportsDir, "latest.json");
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return filePath;
}
