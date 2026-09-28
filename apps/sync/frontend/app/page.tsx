"use client";

import { useCallback, useEffect, useState } from "react";
import SabhaCard, { type CardStatus } from "@/components/SabhaCard";

interface JobMeta {
  id: string;
  jobType: "kishor" | "yuvak";
  status: string;
  startedAt: string;
  finishedAt?: string;
  trigger: string;
}

interface AppState {
  isRunning: boolean;
  kishorStatus: CardStatus;
  yuvakStatus: CardStatus;
  kishorJobId: string | null;
  yuvakJobId: string | null;
  lastKishor: JobMeta | null;
  lastYuvak: JobMeta | null;
}

interface ScheduleDisplay {
  timezone: string;
  kishor: string;
  yuvak: string;
}

const INITIAL_STATE: AppState = {
  isRunning: false,
  kishorStatus: "idle",
  yuvakStatus: "idle",
  kishorJobId: null,
  yuvakJobId: null,
  lastKishor: null,
  lastYuvak: null,
};

const DEFAULT_SCHEDULE_DISPLAY: ScheduleDisplay = {
  timezone: "Asia/Kolkata",
  kishor: "Daily 11:30 PM",
  yuvak: "Daily 11:50 PM",
};

export default function HomePage() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [scheduleDisplay, setScheduleDisplay] = useState<ScheduleDisplay>(
    DEFAULT_SCHEDULE_DISPLAY
  );

  // On mount: fetch the Google Sheet link to show in the header
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(
        (data: {
          sheetUrl: string | null;
          scheduler?: {
            timezone?: string;
            schedules?: {
              kishor?: { label?: string };
              yuvak?: { label?: string };
            };
          };
        }) => {
          setSheetUrl(data.sheetUrl);
          setScheduleDisplay({
            timezone:
              data.scheduler?.timezone ?? DEFAULT_SCHEDULE_DISPLAY.timezone,
            kishor:
              data.scheduler?.schedules?.kishor?.label ??
              DEFAULT_SCHEDULE_DISPLAY.kishor,
            yuvak:
              data.scheduler?.schedules?.yuvak?.label ??
              DEFAULT_SCHEDULE_DISPLAY.yuvak,
          });
        }
      )
      .catch(() => {});
  }, []);

  // On mount: fetch current server state to restore UI if a cron job is running
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(
        (data: {
          isRunning: boolean;
          currentJob: JobMeta | null;
          lastJob: JobMeta | null;
        }) => {
          if (data.isRunning && data.currentJob) {
            const jt = data.currentJob.jobType;
            setState((prev) => ({
              ...prev,
              isRunning: true,
              [`${jt}Status`]: "running" as CardStatus,
              [`${jt}JobId`]: data.currentJob!.id,
            }));
          }
          if (data.lastJob) {
            const jt = data.lastJob.jobType;
            const lastKey = jt === "kishor" ? "lastKishor" : "lastYuvak";
            setState((prev) => ({
              ...prev,
              [lastKey]: data.lastJob,
              ...(!data.isRunning && {
                [`${jt}Status`]: data.lastJob!.status as CardStatus,
              }),
            }));
          }
        }
      )
      .catch(() => {});
  }, []);

  const handleRun = useCallback(async (jobType: "kishor" | "yuvak") => {
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error?: string }).error || "Unknown server error");
      }

      const { jobId } = (await res.json()) as { jobId?: string };
      if (!jobId) throw new Error("Server accepted the request but returned no job ID");

      const cardKey = jobType === "kishor" ? "kishorJobId" : "yuvakJobId";
      const statusKey = jobType === "kishor" ? "kishorStatus" : "yuvakStatus";
      setState((prev) => ({
        ...prev,
        isRunning: true,
        [cardKey]: jobId,
        [statusKey]: "running" as CardStatus,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Could not start ${jobType} job: ${message}`);
    }
  }, []);

  const handleDone = useCallback(
    (jobType: "kishor" | "yuvak", exitCode: number) => {
      const statusKey = jobType === "kishor" ? "kishorStatus" : "yuvakStatus";
      const lastKey = jobType === "kishor" ? "lastKishor" : "lastYuvak";
      const jobIdKey = jobType === "kishor" ? "kishorJobId" : "yuvakJobId";

      setState((prev) => ({
        ...prev,
        isRunning: false,
        [statusKey]: (exitCode === 0 ? "done" : "error") as CardStatus,
        [lastKey]: {
          id: prev[jobIdKey] ?? "",
          jobType,
          status: exitCode === 0 ? "done" : "error",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          trigger: "manual",
        } satisfies JobMeta,
      }));
    },
    []
  );

  const handleTerminated = useCallback((jobType: "kishor" | "yuvak") => {
    const statusKey = jobType === "kishor" ? "kishorStatus" : "yuvakStatus";
    const lastKey = jobType === "kishor" ? "lastKishor" : "lastYuvak";
    const jobIdKey = jobType === "kishor" ? "kishorJobId" : "yuvakJobId";

    setState((prev) => ({
      ...prev,
      isRunning: false,
      [statusKey]: "terminated" as CardStatus,
      [lastKey]: {
        id: prev[jobIdKey] ?? "",
        jobType,
        status: "terminated",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        trigger: "manual",
      } satisfies JobMeta,
    }));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="w-full max-w-3xl mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Sabha Sync
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Chirag Nagar attendance automation — Sampark → Google Sheets
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <a
            href="/logs"
            className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            View Logs
          </a>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-green-700 bg-green-900/30 px-3 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-900/60 hover:text-green-200"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h8v1.5H8V13zm0 3h8v1.5H8V16zm0-6h4v1.5H8V10z" />
              </svg>
              <span className="hidden sm:inline">Open Google Sheet</span>
              <span className="sm:hidden">Sheet</span>
            </a>
          )}
        </div>
      </div>

      {/* Global running banner */}
      {state.isRunning && (
        <div className="w-full max-w-3xl mb-6 rounded-lg bg-blue-900/40 border border-blue-700 px-4 py-3 text-sm text-blue-300 flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
          A job is running. Use the Stop button to cancel it, or wait for it to
          finish.
        </div>
      )}

      {/* Cards — stack on mobile, side by side on sm+ */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <SabhaCard
          jobType="kishor"
          label="Chirag Nagar (Kishor)"
          schedule={scheduleDisplay.kishor}
          status={state.kishorStatus}
          activeJobId={state.kishorJobId}
          isAnyRunning={state.isRunning}
          lastRun={state.lastKishor}
          onRun={() => handleRun("kishor")}
          onDone={(code) => handleDone("kishor", code)}
          onTerminated={() => handleTerminated("kishor")}
        />
        <SabhaCard
          jobType="yuvak"
          label="Chirag Nagar (Yuva)"
          schedule={scheduleDisplay.yuvak}
          status={state.yuvakStatus}
          activeJobId={state.yuvakJobId}
          isAnyRunning={state.isRunning}
          lastRun={state.lastYuvak}
          onRun={() => handleRun("yuvak")}
          onDone={(code) => handleDone("yuvak", code)}
          onTerminated={() => handleTerminated("yuvak")}
        />
      </div>

      {/* Footer */}
      <div className="mt-12 text-xs text-gray-600 text-center">
        Kishor {scheduleDisplay.kishor.replace("Daily ", "")} | Yuva{" "}
        {scheduleDisplay.yuvak.replace("Daily ", "")} | {scheduleDisplay.timezone}
      </div>
    </main>
  );
}
