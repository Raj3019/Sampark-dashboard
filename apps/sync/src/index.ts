// Load apps/sync/.env robustly: resolve relative to this file so the run works
// whether ts-node is started from apps/sync or from the repo root.
import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

import { createInterface } from "node:readline/promises";
import { type AIResolverConfig, type ScrapedRowInput } from "./aiResolver";
import { upsertAttendance, type DbUpdateSummary } from "./dbUpdater";
import { getJobById, JOBS, type SyncJob } from "./jobs";
import { log } from "./logger";
import { runReportFlowCli } from "./reportFlow";
import { createRunReport, saveRunReport } from "./runReport";
import { scrapeAttendance } from "./scraper";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getFlagValue(flag: string): string | undefined {
  const equalsArg = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (equalsArg) return equalsArg.slice(flag.length + 1).trim();

  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1]?.trim();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
void parseBoolean;

async function selectJob(): Promise<SyncJob> {
  const jobId = getFlagValue("--job");
  if (jobId) {
    const job = getJobById(jobId);
    if (!job) {
      throw new Error(
        `Unknown --job "${jobId}". Available jobs: ${JOBS.map((j) => j.id).join(", ")}. ` +
          `For the Members Attendance report use --job report (pnpm run sync:report).`
      );
    }
    if (!job.enabled) {
      throw new Error(`Job "${jobId}" is currently disabled. Enabled jobs: ${JOBS.filter((j) => j.enabled).map((j) => j.id).join(", ")}`);
    }
    return job;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `Missing --job. Available jobs: ${JOBS.filter((j) => j.enabled).map((j) => j.id).join(", ")}. ` +
        `For the Members Attendance report export & import run: pnpm run sync:report (or --job report).`
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("Which Sabha do you want to sync?");
    JOBS.filter((job) => job.enabled).forEach((job, index) => {
      console.log(`${index + 1}. ${job.label} -> ${job.sabhaType}`);
    });

    const answer = (await rl.question("Enter number or job id: ")).trim().toLowerCase();
    const byNumber = Number(answer);
    const enabledJobs = JOBS.filter((job) => job.enabled);
    const selected =
      Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= enabledJobs.length
        ? enabledJobs[byNumber - 1]
        : getJobById(answer);

    if (!selected || !selected.enabled) {
      throw new Error(`Invalid or disabled job selection "${answer}".`);
    }

    return selected;
  } finally {
    rl.close();
  }
}

function getAIConfig(): AIResolverConfig {
  return {
    // AI name resolution is intentionally disabled. Attendance reconciliation
    // must use deterministic exact normalized roster matches only.
    enabled: false,
    apiKey: process.env.OPENROUTER_API_KEY?.trim() ?? "",
    model: process.env.AI_MODEL?.trim() || "google/gemini-flash-1.5",
    baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
  };
}

/**
 * Combine per-page DbUpdateSummary objects into ONE run-level summary.
 * Counts are summed; list fields concatenated (deduped for unknownNames);
 * sessionCreated is true if ANY page created the shared session row.
 * Single-page runs return the page summary untouched (legacy shape).
 */
function mergeDbUpdateSummaries(summaries: DbUpdateSummary[], sabhaType: string): DbUpdateSummary {
  if (summaries.length === 1) return summaries[0];
  const [first] = summaries;
  const unknownNames = Array.from(new Set(summaries.flatMap((s) => s.unknownNames)));
  const visited = summaries.flatMap((s) => s.visited);
  return {
    sabhaType,
    sessionDate: first?.sessionDate ?? null,
    sessionDateDisplay: first?.sessionDateDisplay ?? "unknown date",
    dryRun: first?.dryRun ?? false,
    matched: summaries.reduce((acc, s) => acc + s.matched, 0),
    matchedPresent: summaries.reduce((acc, s) => acc + s.matchedPresent, 0),
    matchedAbsent: summaries.reduce((acc, s) => acc + s.matchedAbsent, 0),
    correctedCount: summaries.reduce((acc, s) => acc + s.correctedCount, 0),
    newCount: summaries.reduce((acc, s) => acc + s.newCount, 0),
    unknownNames,
    visitors: summaries.reduce((acc, s) => acc + s.visitors, 0),
    visitedCount: summaries.reduce((acc, s) => acc + s.visitedCount, 0),
    visited,
    sameNameGroups: summaries.reduce((acc, s) => acc + s.sameNameGroups, 0),
    transferredOutCount: summaries.reduce((acc, s) => acc + s.transferredOutCount, 0),
    restoredCount: summaries.reduce((acc, s) => acc + s.restoredCount, 0),
    sessionCreated: summaries.some((s) => s.sessionCreated),
  };
}

async function main(): Promise<void> {
  const dryRun = hasFlag("--dry-run");
  const force = hasFlag("--force");
  void force;

  // Members Attendance report export & import — runs independently of the
  // kishor/yuvak/bal scrape jobs (--job report, or --report <path> to import
  // an already-downloaded xlsx).
  const jobIdFlag = getFlagValue("--job");
  if (jobIdFlag?.trim().toLowerCase() === "report") {
    await runReportFlowCli({ dryRun, reportPath: getFlagValue("--report") });
    return;
  }

  const report = createRunReport(dryRun, force);

  // Tracks which phase we're in so a failure log can say WHERE it broke.
  let stage = "startup";

  try {
    stage = "select-job";
    const selectedJob = await selectJob();
    // Jobs either sync ONE Sampark page (kishor/yuvak: samparkSabhaName) or
    // SEVERAL pages feeding one dashboard sabha (bal: samparkSabhaNames —
    // Sampark exposes Bal Sabha as 'Chirag Nagar (Bal)' + 'Maneklal (Bal)').
    const samparkSabhaNames =
      selectedJob.samparkSabhaNames ?? [selectedJob.samparkSabhaName];
    report.job = {
      id: selectedJob.id,
      label: selectedJob.label,
      samparkSabhaName: selectedJob.samparkSabhaName,
      samparkSabhaNames,
      sabhaType: selectedJob.sabhaType,
    };
    log("INFO", [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ` ${selectedJob.label} — Attendance Sync${dryRun ? " (DRY RUN)" : ""}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ` Pages: ${samparkSabhaNames.join(" + ")}`,
    ].join("\n"));

    stage = "scrape-attendance";
    /** One scrape + DB summary per Sampark page, in page order. */
    const pageResults: Array<{
      samparkSabha: string;
      sabhaDate: Date;
      attendance: Awaited<ReturnType<typeof scrapeAttendance>>;
      dbUpdate: DbUpdateSummary;
    }> = [];

    const scopeByPage = selectedJob.memberScopeBySamparkSabha;
    // Multi-page jobs scope each page's roster to its member.sampark_sabha
    // value; single-page jobs stay on the legacy roster filter (undefined).
    const memberScopeFor = (samparkSabha: string): string | undefined =>
      scopeByPage?.[samparkSabha];

    for (let pageIndex = 0; pageIndex < samparkSabhaNames.length; pageIndex++) {
      const samparkSabha = samparkSabhaNames[pageIndex];
      const memberScope = memberScopeFor(samparkSabha);
      const scopeSuffix = memberScope ? ` (roster scope: ${memberScope})` : "";
      log("INFO", `Page ${pageIndex + 1}/${samparkSabhaNames.length}: ${samparkSabha}${scopeSuffix}`);

      stage = "scrape-attendance";
      const attendance = await scrapeAttendance({
        sabhaName: samparkSabha,
        sabhaPattern: selectedJob.samparkSabhaPattern,
      });

      if (pageIndex === 0) {
        report.sabhaDate = attendance.sabhaDate.toISOString();
        report.scraped = {
          present: attendance.present.map((entry) => entry.name),
          absent: attendance.absent.map((entry) => entry.name),
          totalRows: attendance.rows.length,
        };
        report.countValidation = attendance.countValidation;
      }

      if (!attendance.countValidation.matched) {
        const { sampark, scraped } = attendance.countValidation;
        const warning =
          `Sampark/scraper count mismatch for "${samparkSabha}": ` +
          `Sampark P=${sampark.present}, A=${sampark.absent}, T=${sampark.total}; ` +
          `scraped P=${scraped.present}, A=${scraped.absent}, T=${scraped.total}. ` +
          `Sync will continue with the scraped rows.`;
        report.warnings.push(warning);
        log("WARN", warning);
      }

      log("INFO", `Sabha date: ${formatDate(attendance.sabhaDate)}`);

      const scrapedRows: ScrapedRowInput[] = attendance.rows.map((row, rowIndex) => ({
        ...row,
        rowIndex,
      }));

      stage = "update-db";
      const dbUpdate = await upsertAttendance(
        {
          sabhaType: selectedJob.sabhaType,
          sessionDate: attendance.sabhaDate,
          sessionDateDisplay: formatDate(attendance.sabhaDate),
          present: attendance.present,
          absent: attendance.absent,
          rows: scrapedRows,
          // Only set for multi-page jobs; kishor/yuvak keep the legacy filter.
          memberScope,
        },
        { dryRun, aiConfig: getAIConfig() }
      );

      pageResults.push({ samparkSabha, sabhaDate: attendance.sabhaDate, attendance, dbUpdate });

      if (memberScope) {
        log(
          "INFO",
          `[${samparkSabha}] matched ${dbUpdate.matched} member(s) ` +
            `(${dbUpdate.matchedPresent} present, ${dbUpdate.matchedAbsent} absent); ` +
            `auto-transfer ${dbUpdate.transferredOutCount} out / ${dbUpdate.restoredCount} restored`
        );
      } else {
        log(
          "INFO",
          `DB update done: matched ${dbUpdate.matched} member(s), visited ${dbUpdate.visitedCount}, ` +
            `auto-transfer ${dbUpdate.transferredOutCount} out / ${dbUpdate.restoredCount} restored`
        );
      }
    }

    // Pages unexpectedly yielding different sabha dates (shouldn't happen —
    // both pages report the same Sabha day): keep each page's own date, i.e.
    // TWO sessions keyed (sabha_type, its own date). ONE date is the expected
    // case, where BOTH pages reuse the SAME session row.
    const distinctSessionDates = new Set(
      pageResults.map((page) => page.dbUpdate.sessionDate ?? page.sabhaDate.toISOString())
    );
    if (samparkSabhaNames.length > 1 && distinctSessionDates.size > 1) {
      const detail = Array.from(
        new Set(pageResults.map((page) => `${page.samparkSabha} → ${page.dbUpdate.sessionDateDisplay}`))
      ).join("; ");
      const warning = `Pages returned DIFFERENT sabha dates (${detail}) — each page wrote its OWN session keyed (${selectedJob.sabhaType}, <its own date>) instead of sharing one.`;
      report.warnings.push(warning);
      log("WARN", warning);
    } else if (samparkSabhaNames.length > 1) {
      log("INFO", `All pages share one sabha session (${selectedJob.sabhaType} on ${pageResults[0].dbUpdate.sessionDateDisplay}); marks merged into it.`);
    }

    // ── Run report: merge per-page summaries under the legacy fields ──────────
    const mergedDbUpdate = mergeDbUpdateSummaries(
      pageResults.map((page) => page.dbUpdate),
      selectedJob.sabhaType
    );
    report.dbUpdate = mergedDbUpdate;
    report.visited = pageResults.flatMap((page) =>
      page.dbUpdate.visited.map((visit) => ({
        name: visit.name,
        actualSabha: visit.actualSabha,
        actualDate: visit.actualDate,
        matchedMemberId: visit.matchedMemberId,
      }))
    );
    report.sameNameGroups = mergedDbUpdate.sameNameGroups;
    report.restoredCount = mergedDbUpdate.restoredCount;
    if (pageResults.length > 1) {
      report.pages = pageResults.map((page) => ({
        samparkSabha: page.samparkSabha,
        presentCount: page.attendance.present.length,
        absentCount: page.attendance.absent.length,
        matched: page.dbUpdate.matched,
      }));
    }

    // ── Final summary ───────────────────────────────────────────────────────────
    const summaryLines: string[] = [
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ` Done! ${formatDate(pageResults[0].sabhaDate)} — ${selectedJob.label}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    if (pageResults.length === 1) {
      // Legacy single-page summary — identical to the pre-bal output.
      const { attendance, dbUpdate } = pageResults[0];
      summaryLines.push(
        ` Read from app   : ${attendance.present.length} attended, ${attendance.absent.length} absent`,
        ` Written to DB   : ${dbUpdate.matched} marks upserted (${dbUpdate.matchedPresent} present, ${dbUpdate.matchedAbsent} absent)`,
        ` Visited other sabha: ${dbUpdate.visitedCount}` +
          (dbUpdate.visited.length
            ? ` (${dbUpdate.visited.map((v) => `${v.name} → ${v.actualSabha} ${v.actualDate ?? "?"}`).join("; ")})`
            : ``),
        ` Auto-transfer: ${dbUpdate.transferredOutCount} marked out, ${dbUpdate.restoredCount} restored`,
        ` Same-name groups: ${dbUpdate.sameNameGroups}`
      );
      if (dbUpdate.unknownNames.length > 0) {
        summaryLines.push(
          ` Not in roster (${dbUpdate.unknownNames.length}): ${dbUpdate.unknownNames.join(", ")}`
        );
      }
      if (!attendance.countValidation.matched) {
        const { sampark, scraped } = attendance.countValidation;
        summaryLines.push(
          ` WARNING: count mismatch - Sampark P=${sampark.present}, A=${sampark.absent}, T=${sampark.total}; ` +
            `scraped P=${scraped.present}, A=${scraped.absent}, T=${scraped.total}`
        );
      }
    } else {
      // Multi-page summary: per-page lines first, then run-level TOTALS.
      for (const page of pageResults) {
        const { samparkSabha, attendance, dbUpdate } = page;
        summaryLines.push(
          ` [${samparkSabha}] Read from app  : ${attendance.present.length} attended, ${attendance.absent.length} absent`,
          ` [${samparkSabha}] Written to DB  : ${dbUpdate.matched} marks upserted (${dbUpdate.matchedPresent} present, ${dbUpdate.matchedAbsent} absent), ${dbUpdate.newCount} new, ${dbUpdate.correctedCount} corrected`,
          ` [${samparkSabha}] Visited other sabha: ${dbUpdate.visitedCount}` +
            (dbUpdate.visited.length
              ? ` (${dbUpdate.visited.map((v) => `${v.name} → ${v.actualSabha} ${v.actualDate ?? "?"}`).join("; ")})`
              : ``),
          ` [${samparkSabha}] Auto-transfer: ${dbUpdate.transferredOutCount} marked out, ${dbUpdate.restoredCount} restored`
        );
        if (dbUpdate.unknownNames.length > 0) {
          summaryLines.push(
            ` [${samparkSabha}] Not in roster (${dbUpdate.unknownNames.length}): ${dbUpdate.unknownNames.join(", ")}`
          );
        }
        if (!attendance.countValidation.matched) {
          const { sampark, scraped } = attendance.countValidation;
          summaryLines.push(
            ` [${samparkSabha}] WARNING: count mismatch - Sampark P=${sampark.present}, A=${sampark.absent}, T=${sampark.total}; ` +
              `scraped P=${scraped.present}, A=${scraped.absent}, T=${scraped.total}`
          );
        }
      }
      summaryLines.push(
        ` TOTALS (run) : ${mergedDbUpdate.matched} marks upserted (${mergedDbUpdate.matchedPresent} present, ${mergedDbUpdate.matchedAbsent} absent; ${mergedDbUpdate.newCount} new, ${mergedDbUpdate.correctedCount} corrected), ` +
          `visited ${mergedDbUpdate.visitedCount}, ` +
          `auto-transfer ${mergedDbUpdate.transferredOutCount} out / ${mergedDbUpdate.restoredCount} restored, ` +
          `same-name groups ${mergedDbUpdate.sameNameGroups}`
      );
      if (mergedDbUpdate.unknownNames.length > 0) {
        summaryLines.push(
          ` Not in roster (${mergedDbUpdate.unknownNames.length}): ${mergedDbUpdate.unknownNames.join(", ")}`
        );
      }
      if (distinctSessionDates.size > 1) {
        summaryLines.push(
          ` WARNING: pages produced different session dates — separate sessions written per date (see warnings)`
        );
      }
    }

    if (dryRun) summaryLines.push(` (DRY RUN — nothing was actually written)`);
    summaryLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log("INFO", summaryLines.join("\n"));

    report.status = "success";
    try {
      const reportPath = saveRunReport(report);
      log("INFO", `Full report saved: ${reportPath}`);
    } catch (reportError) {
      log("ERROR", "Attendance completed, but the run report could not be saved", reportError);
    }
  } catch (error) {
    report.status = "failed";
    report.failedStage = stage;
    report.error = error instanceof Error ? error.message : String(error);
    log("ERROR", `Run FAILED during stage "${stage}"`, error);
    try {
      const reportPath = saveRunReport(report);
      log("ERROR", `Run report saved after failure: ${reportPath}`);
    } catch (reportError) {
      log("ERROR", "Could not save the failure report; preserving the original run error", reportError);
    }
    throw error;
  }
}

void main;

main().catch((error: unknown) => {
  // main()'s inner catch already logged the full detail with stage context, so
  // here we only emit a short one-liner to avoid duplicating the whole stack.
  const message = error instanceof Error ? error.message : String(error);
  log("ERROR", `Sync exited with an error: ${message}`);
  process.exitCode = 1;
});
