import fs from "fs";
import path from "path";
import cron from "node-cron";
import { getJob, getStatus, startJob, type JobType } from "./jobRunner";
import { getAgentJobResult } from "./agentJobResult";
import { notifyHermes, type HermesCronNotification } from "./hermesNotifier";
import { getSchedulerConfig } from "./scheduleConfig";

type ScheduleStatus = "queued" | "running" | "retrying" | "success" | "failed";

interface ScheduleStateEntry {
  status: ScheduleStatus;
  attempts: number;
  reason: string;
  updatedAt: string;
  jobId?: string;
  exitCode?: number;
  error?: string;
}

interface SchedulerState {
  version: 1;
  days: Record<string, Partial<Record<JobType, ScheduleStateEntry>>>;
}

interface QueueItem {
  jobType: JobType;
  scheduleDay: string;
  reason: "scheduled" | "startup-catch-up" | "retry";
}

const AUTO_ROOT = path.join(process.cwd(), "..");
const LOGS_DIR = path.join(AUTO_ROOT, "logs");
const STATE_PATH = path.join(AUTO_ROOT, "runs", "scheduler-state.json");
const MAX_ATTEMPTS = 3;
const BUSY_RECHECK_MS = 30_000;
const RETRY_DELAY_MS = 5 * 60_000;
const MIDNIGHT_CATCH_UP_CUTOFF_MINUTES = 6 * 60;
const SCHEDULER_CONFIG = getSchedulerConfig();
const TIMEZONE = SCHEDULER_CONFIG.timezone;
const SCHEDULES = SCHEDULER_CONFIG.schedules;

interface SchedulerRegistry {
  registered: boolean;
  draining: boolean;
  queue: QueueItem[];
}

const globalForScheduler = globalThis as unknown as {
  __sabhaScheduler?: SchedulerRegistry;
};

const registry =
  globalForScheduler.__sabhaScheduler ??
  (globalForScheduler.__sabhaScheduler = {
    registered: false,
    draining: false,
    queue: [],
  });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function schedulerClock(date = new Date()): {
  day: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function previousDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, date - 1));
  return previous.toISOString().slice(0, 10);
}

/** Cron day-of-week (0 = Sunday) for an ISO 'YYYY-MM-DD' schedule day. */
function dayOfWeek(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatJobList(schedules: typeof SCHEDULES): string {
  return schedules
    .map(({ jobType, time }) => `${jobType === "report" ? "Report" : jobType === "kishor" ? "Kishor" : "Yuvak"} ${time}`)
    .join(", ");
}

function schedulerLog(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  jobType?: JobType
): void {
  const prefix = `[${new Date().toISOString()}] [${level}] [SCHEDULER]`;
  const line = `${prefix}${jobType ? ` [job=${jobType}]` : ""} ${message}`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);

  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const logDay = schedulerClock().day;
    fs.appendFileSync(path.join(LOGS_DIR, `scheduler-${logDay}.log`), `${line}\n`, "utf8");
  } catch (error) {
    console.error("[SCHEDULER] Could not write scheduler log:", error);
  }
}

function loadState(): SchedulerState {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as SchedulerState;
    if (parsed.version === 1 && parsed.days) return parsed;
  } catch {
    // Missing or invalid state starts clean; the event is logged by registration.
  }
  return { version: 1, days: {} };
}

function saveState(state: SchedulerState): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const recentDays = Object.keys(state.days).sort().slice(-45);
  state.days = Object.fromEntries(recentDays.map((day) => [day, state.days[day]]));
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function getEntry(day: string, jobType: JobType): ScheduleStateEntry | undefined {
  return loadState().days[day]?.[jobType];
}

function updateEntry(
  day: string,
  jobType: JobType,
  update: ScheduleStateEntry
): void {
  try {
    const state = loadState();
    state.days[day] = state.days[day] ?? {};
    state.days[day][jobType] = update;
    saveState(state);
  } catch (error) {
    // State persistence improves recovery, but a disk problem must not prevent
    // the actual attendance job from running.
    schedulerLog(
      "ERROR",
      `Could not persist scheduler state: ${error instanceof Error ? error.message : String(error)}`,
      jobType
    );
  }
}

function waitForJob(jobId: string): Promise<number> {
  const job = getJob(jobId);
  if (!job) return Promise.resolve(1);
  if (job.status !== "running") return Promise.resolve(job.exitCode ?? (job.status === "done" ? 0 : 1));

  return new Promise((resolve) => {
    job.emitter.once("done", (code: number | null) => resolve(code ?? 1));
  });
}

async function sendHermesNotification(
  input: Omit<HermesCronNotification, "result">
): Promise<void> {
  try {
    const result = input.jobId ? getAgentJobResult(input.jobId) : undefined;
    const delivery = await notifyHermes({ ...input, result });

    if (delivery.status === "delivered") {
      schedulerLog(
        "INFO",
        `Hermes notification delivered in ${delivery.attempts} attempt(s)`,
        input.jobType
      );
    } else if (delivery.status === "failed") {
      schedulerLog(
        "WARN",
        `Hermes notification failed after ${delivery.attempts} attempt(s): ${delivery.error}`,
        input.jobType
      );
    }
  } catch (error) {
    schedulerLog(
      "WARN",
      `Hermes notification crashed safely: ${error instanceof Error ? error.message : String(error)}`,
      input.jobType
    );
  }
}

function enqueue(item: QueueItem): void {
  const duplicate = registry.queue.some(
    (queued) => queued.jobType === item.jobType && queued.scheduleDay === item.scheduleDay
  );
  if (duplicate) {
    schedulerLog(
      "INFO",
      `Queue already contains the ${item.scheduleDay} run; duplicate trigger ignored`,
      item.jobType
    );
    return;
  }

  const existing = getEntry(item.scheduleDay, item.jobType);
  if (existing?.status === "success") {
    schedulerLog(
      "INFO",
      `${item.scheduleDay} already completed successfully as ${existing.jobId}; trigger ignored`,
      item.jobType
    );
    return;
  }
  if (existing?.status === "failed" && existing.attempts >= MAX_ATTEMPTS) {
    schedulerLog(
      "WARN",
      `${item.scheduleDay} already exhausted ${existing.attempts} attempts; not starting again automatically`,
      item.jobType
    );
    return;
  }

  registry.queue.push(item);
  updateEntry(item.scheduleDay, item.jobType, {
    status: "queued",
    attempts: existing?.attempts ?? 0,
    reason: item.reason,
    updatedAt: new Date().toISOString(),
  });
  schedulerLog(
    "INFO",
    `Queued ${item.scheduleDay} run (reason=${item.reason}, queueDepth=${registry.queue.length})`,
    item.jobType
  );
  void drainQueue().catch((error) => {
    schedulerLog(
      "ERROR",
      `Queue processing failed unexpectedly: ${error instanceof Error ? error.message : String(error)}`,
      item.jobType
    );
  });
}

async function drainQueue(): Promise<void> {
  if (registry.draining) return;
  registry.draining = true;

  try {
    while (registry.queue.length > 0) {
      const item = registry.queue[0];
      let busyLogged = false;

      while (getStatus().isRunning) {
        if (!busyLogged) {
          schedulerLog(
            "WARN",
            "Another attendance job is active; scheduled run will wait instead of being dropped",
            item.jobType
          );
          busyLogged = true;
        }
        await sleep(BUSY_RECHECK_MS);
      }

      registry.queue.shift();
      const previous = getEntry(item.scheduleDay, item.jobType);
      const attempt = (previous?.attempts ?? 0) + 1;
      let jobId: string;

      try {
        jobId = startJob(item.jobType, "cron");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        schedulerLog("ERROR", `Could not start attempt ${attempt}: ${message}`, item.jobType);

        if (/already running/i.test(message)) {
          updateEntry(item.scheduleDay, item.jobType, {
            status: "queued",
            attempts: previous?.attempts ?? 0,
            reason: item.reason,
            updatedAt: new Date().toISOString(),
            error: message,
          });
          registry.queue.unshift(item);
          await sleep(BUSY_RECHECK_MS);
          continue;
        }

        updateEntry(item.scheduleDay, item.jobType, {
          status: attempt < MAX_ATTEMPTS ? "retrying" : "failed",
          attempts: attempt,
          reason: item.reason,
          updatedAt: new Date().toISOString(),
          error: message,
        });
        if (attempt < MAX_ATTEMPTS) {
          schedulerLog(
            "WARN",
            `Start failed; retry ${attempt + 1}/${MAX_ATTEMPTS} in ${RETRY_DELAY_MS / 60_000} minutes`,
            item.jobType
          );
          await sleep(RETRY_DELAY_MS);
          registry.queue.unshift({ ...item, reason: "retry" });
        } else {
          await sendHermesNotification({
            jobType: item.jobType,
            scheduleDay: item.scheduleDay,
            reason: item.reason,
            outcome: "failed",
            attempts: attempt,
            maxAttempts: MAX_ATTEMPTS,
            error: message,
          });
        }
        continue;
      }

      updateEntry(item.scheduleDay, item.jobType, {
        status: "running",
        attempts: attempt,
        reason: item.reason,
        updatedAt: new Date().toISOString(),
        jobId,
      });
      schedulerLog(
        "INFO",
        `Started jobId=${jobId}, attempt=${attempt}/${MAX_ATTEMPTS}`,
        item.jobType
      );

      const startedAt = Date.now();
      const exitCode = await waitForJob(jobId);
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

      if (exitCode === 0) {
        updateEntry(item.scheduleDay, item.jobType, {
          status: "success",
          attempts: attempt,
          reason: item.reason,
          updatedAt: new Date().toISOString(),
          jobId,
          exitCode,
        });
        schedulerLog(
          "INFO",
          `Completed jobId=${jobId}, exitCode=0, duration=${durationSeconds}s`,
          item.jobType
        );
        await sendHermesNotification({
          jobType: item.jobType,
          scheduleDay: item.scheduleDay,
          reason: item.reason,
          outcome: "success",
          attempts: attempt,
          maxAttempts: MAX_ATTEMPTS,
          jobId,
          durationSeconds,
        });
        continue;
      }

      const willRetry = attempt < MAX_ATTEMPTS;
      updateEntry(item.scheduleDay, item.jobType, {
        status: willRetry ? "retrying" : "failed",
        attempts: attempt,
        reason: item.reason,
        updatedAt: new Date().toISOString(),
        jobId,
        exitCode,
        error: `Job exited with code ${exitCode}`,
      });
      schedulerLog(
        willRetry ? "WARN" : "ERROR",
        `JobId=${jobId} failed with exitCode=${exitCode} after ${durationSeconds}s` +
          (willRetry ? `; retry ${attempt + 1}/${MAX_ATTEMPTS} in ${RETRY_DELAY_MS / 60_000} minutes` : ""),
        item.jobType
      );

      if (willRetry) {
        await sleep(RETRY_DELAY_MS);
        registry.queue.unshift({ ...item, reason: "retry" });
      } else {
        await sendHermesNotification({
          jobType: item.jobType,
          scheduleDay: item.scheduleDay,
          reason: item.reason,
          outcome: "failed",
          attempts: attempt,
          maxAttempts: MAX_ATTEMPTS,
          jobId,
          durationSeconds,
          error: `Job exited with code ${exitCode}`,
        });
      }
    }
  } finally {
    registry.draining = false;
  }
}

function queueStartupCatchUp(): void {
  const now = schedulerClock();
  const minutesNow = now.hour * 60 + now.minute;

  for (const schedule of SCHEDULES) {
    if (schedule.dayOfWeek !== undefined && dayOfWeek(now.day) !== schedule.dayOfWeek) {
      continue;
    }
    const scheduledMinutes = schedule.hour * 60 + schedule.minute;
    if (minutesNow >= scheduledMinutes) {
      enqueue({
        jobType: schedule.jobType,
        scheduleDay: now.day,
        reason: "startup-catch-up",
      });
    }
  }

  // A restart shortly after midnight should recover the jobs from the previous
  // evening rather than waiting almost 24 hours for the next trigger.
  if (minutesNow < MIDNIGHT_CATCH_UP_CUTOFF_MINUTES) {
    const yesterday = previousDay(now.day);
    for (const schedule of SCHEDULES.filter(
      ({ hour, minute }) =>
        hour * 60 + minute >= MIDNIGHT_CATCH_UP_CUTOFF_MINUTES
    )) {
      if (schedule.dayOfWeek !== undefined && dayOfWeek(yesterday) !== schedule.dayOfWeek) {
        continue;
      }
      enqueue({
        jobType: schedule.jobType,
        scheduleDay: yesterday,
        reason: "startup-catch-up",
      });
    }
  }
}

export function registerScheduler(): void {
  if (registry.registered) {
    schedulerLog("INFO", "Registration already active in this process; duplicate registration skipped");
    return;
  }
  registry.registered = true;

  for (const warning of SCHEDULER_CONFIG.warnings) {
    schedulerLog("WARN", warning);
  }

  for (const schedule of SCHEDULES) {
    cron.schedule(
      schedule.expression,
      () => {
        const day = schedulerClock().day;
        schedulerLog(
          "INFO",
          `Cron fired for scheduleDay=${day} at ${schedule.time} ${TIMEZONE}`,
          schedule.jobType
        );
        enqueue({ jobType: schedule.jobType, scheduleDay: day, reason: "scheduled" });
      },
      { timezone: TIMEZONE }
    );
  }

  schedulerLog(
    "INFO",
    `Scheduler registered: ${formatJobList(SCHEDULES)} ${TIMEZONE}; ` +
      `state=${STATE_PATH}; retries=${MAX_ATTEMPTS}`
  );

  setTimeout(() => {
    try {
      queueStartupCatchUp();
    } catch (error) {
      schedulerLog(
        "ERROR",
        `Startup catch-up check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, 2_000);
}
