import { EventEmitter } from "events";
import { spawn, type ChildProcess } from "child_process";
import path from "path";

export type JobType = "kishor" | "yuvak" | "report";
export type JobStatus = "running" | "done" | "error" | "terminated";
export type JobTrigger = "manual" | "cron" | "agent";

export interface Job {
  id: string;
  jobType: JobType;
  status: JobStatus;
  logs: string[];
  emitter: EventEmitter;
  startedAt: Date;
  finishedAt?: Date;
  exitCode?: number;
  trigger: JobTrigger;
  child?: ChildProcess;
  terminationRequested?: boolean;
  timedOut?: boolean;
}

// The job registry must survive Next.js dev-mode module re-evaluation. Fast
// Refresh / HMR recompiles route modules, which would reset plain module-level
// variables and "lose" a job created moments earlier by a different route —
// causing /api/logs to 404 with "Job not found". Storing it on globalThis keeps
// a single shared registry across recompiles and any module duplication.
interface JobRegistry {
  jobs: Map<string, Job>;
  isAnyJobRunning: boolean;
  currentJobId: string | null;
}

const globalForJobs = globalThis as unknown as {
  __sabhaSyncJobs?: JobRegistry;
};

const registry: JobRegistry =
  globalForJobs.__sabhaSyncJobs ??
  (globalForJobs.__sabhaSyncJobs = {
    jobs: new Map<string, Job>(),
    isAnyJobRunning: false,
    currentJobId: null,
  });

// `jobs` is a reference type, so this alias stays valid; the scalar flags
// (isAnyJobRunning / currentJobId) must always be read/written via `registry`.
const jobs = registry.jobs;

// Root of the Auto project (one level up from frontend/)
const AUTO_ROOT = path.join(process.cwd(), "..");
const JOB_TIMEOUT_MS = 20 * 60_000;

function appendJobLog(job: Job, line: string): void {
  job.logs.push(line);
  job.emitter.emit("log", line);
}

export function startJob(jobType: JobType, trigger: JobTrigger = "manual"): string {
  if (registry.isAnyJobRunning) {
    throw new Error("A job is already running. Wait for it to finish before starting another.");
  }

  const jobId = `${jobType}-${Date.now()}`;
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const job: Job = {
    id: jobId,
    jobType,
    status: "running",
    logs: [],
    emitter,
    startedAt: new Date(),
    trigger,
  };

  jobs.set(jobId, job);
  registry.isAnyJobRunning = true;
  registry.currentJobId = jobId;

  const addLog = (line: string) => appendJobLog(job, line);

  addLog(`[SYSTEM] Starting ${jobType} job (trigger: ${trigger})`);
  addLog(`[SYSTEM] Working directory: ${AUTO_ROOT}`);
  addLog(`[SYSTEM] Command: npx ts-node src/index.ts --job ${jobType}`);

  const child = spawn(
    "npx",
    ["ts-node", "src/index.ts", "--job", jobType],
    {
      cwd: AUTO_ROOT,
      env: {
        ...process.env,
        SABHA_SYNC_TRIGGER: trigger,
        SABHA_SYNC_JOB_ID: jobId,
      },
      // shell: true is required on Windows — .cmd scripts (npx.cmd, ts-node.cmd)
      // cannot be spawned directly; they need a shell interpreter to execute.
      shell: true,
    }
  );

  job.child = child;
  let finalized = false;

  const timeout = setTimeout(() => {
    if (finalized || !job.child) return;
    job.timedOut = true;
    addLog(`[SYSTEM ERROR] Job exceeded ${JOB_TIMEOUT_MS / 60_000} minutes and will be stopped.`);
    if (process.platform === "win32" && job.child.pid) {
      spawn("taskkill", ["/pid", String(job.child.pid), "/f", "/t"], { shell: false });
    } else {
      job.child.kill("SIGTERM");
    }
  }, JOB_TIMEOUT_MS);

  const finalize = (code: number | null, spawnError?: Error) => {
    if (finalized) return;
    finalized = true;
    clearTimeout(timeout);

    if (spawnError) addLog(`[SYSTEM ERROR] Could not run attendance process: ${spawnError.message}`);
    job.status = job.terminationRequested
      ? "terminated"
      : code === 0 && !job.timedOut
        ? "done"
        : "error";
    job.exitCode = code ?? (spawnError ? 1 : undefined);
    job.finishedAt = new Date();
    job.child = undefined;
    registry.isAnyJobRunning = false;
    registry.currentJobId = null;

    if (job.status === "terminated") addLog("[SYSTEM] Job was terminated by the user.");
    else if (job.timedOut) addLog("[SYSTEM ERROR] Job failed because it timed out.");
    else if (!spawnError) {
      addLog(code === 0 ? "[SYSTEM] Job completed successfully." : `[SYSTEM] Job finished with exit code ${code}.`);
    }
    emitter.emit("done", job.exitCode ?? 1);
  };

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  const handleChunk = (chunk: string) => {
    chunk
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .forEach(addLog);
  };

  child.stdout.on("data", handleChunk);
  child.stderr.on("data", handleChunk);

  child.on("error", (err: Error) => {
    finalize(1, err);
  });

  child.on("close", (code: number | null) => {
    finalize(code);
  });

  return jobId;
}

export function terminateJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job || job.status !== "running" || !job.child) {
    throw new Error("No running job found with that ID.");
  }

  const pid = job.child.pid;
  job.terminationRequested = true;
  appendJobLog(job, "[SYSTEM] Terminating job...");

  if (process.platform === "win32" && pid) {
    // taskkill /f /t kills the full process tree (cmd.exe + ts-node + Chromium)
    const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], { shell: false });
    killer.on("error", (error) => {
      job.terminationRequested = false;
      appendJobLog(job, `[SYSTEM ERROR] Could not start taskkill: ${error.message}`);
    });
    killer.on("close", (code) => {
      if (code !== 0 && job.child) {
        job.terminationRequested = false;
        appendJobLog(job, `[SYSTEM ERROR] taskkill failed with exit code ${code}; job may still be running.`);
      }
    });
  } else {
    const signalled = job.child.kill("SIGTERM");
    if (!signalled) {
      job.terminationRequested = false;
      appendJobLog(job, "[SYSTEM ERROR] Failed to send SIGTERM; job may still be running.");
    }
  }
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function getStatus() {
  const currentJob = registry.currentJobId ? jobs.get(registry.currentJobId) : undefined;
  const allJobs = Array.from(jobs.values());
  const lastDoneJob = allJobs
    .filter((j) => j.status !== "running")
    .sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))[0];

  return {
    isRunning: registry.isAnyJobRunning,
    currentJob: currentJob
      ? {
          id: currentJob.id,
          jobType: currentJob.jobType,
          status: currentJob.status,
          startedAt: currentJob.startedAt.toISOString(),
          trigger: currentJob.trigger,
        }
      : null,
    lastJob: lastDoneJob
      ? {
          id: lastDoneJob.id,
          jobType: lastDoneJob.jobType,
          status: lastDoneJob.status,
          startedAt: lastDoneJob.startedAt.toISOString(),
          finishedAt: lastDoneJob.finishedAt?.toISOString(),
          exitCode: lastDoneJob.exitCode,
          trigger: lastDoneJob.trigger,
        }
      : null,
  };
}
