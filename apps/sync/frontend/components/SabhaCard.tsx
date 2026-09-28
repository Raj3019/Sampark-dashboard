"use client";

import { useState } from "react";
import LogViewer from "./LogViewer";

export type CardStatus = "idle" | "running" | "done" | "error" | "terminated";

interface SabhaCardProps {
  jobType: "kishor" | "yuvak";
  label: string;
  schedule: string;
  status: CardStatus;
  activeJobId: string | null;
  isAnyRunning: boolean;
  lastRun?: { finishedAt?: string; status: string; trigger: string } | null;
  onRun: () => void;
  onDone: (exitCode: number) => void;
  onTerminated: () => void;
}

const STATUS_BADGE: Record<CardStatus, { text: string; classes: string }> = {
  idle:       { text: "Idle",       classes: "bg-gray-700 text-gray-300" },
  running:    { text: "Running",    classes: "bg-blue-600 text-white animate-pulse" },
  done:       { text: "Done",       classes: "bg-green-700 text-white" },
  error:      { text: "Error",      classes: "bg-red-700 text-white" },
  terminated: { text: "Terminated", classes: "bg-orange-700 text-white" },
};

const BORDER: Record<CardStatus, string> = {
  idle:       "border-gray-700",
  running:    "border-blue-500",
  done:       "border-green-600",
  error:      "border-red-600",
  terminated: "border-orange-600",
};

function formatTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SabhaCard({
  jobType,
  label,
  schedule,
  status,
  activeJobId,
  isAnyRunning,
  lastRun,
  onRun,
  onDone,
  onTerminated,
}: SabhaCardProps) {
  const [terminating, setTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);

  const badge = STATUS_BADGE[status];
  const isThisRunning = status === "running";
  const canRun = !isAnyRunning;

  const handleTerminate = async () => {
    if (!activeJobId || terminating) return;
    setTerminating(true);
    setTerminateError(null);
    try {
      const response = await fetch("/api/terminate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: activeJobId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Stop request failed with HTTP ${response.status}`);
      }
      // UI update happens via onDone callback when the process actually closes
    } catch (error) {
      setTerminating(false);
      setTerminateError(error instanceof Error ? error.message : "Could not stop the job");
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 sm:p-6 flex flex-col gap-4 bg-gray-900 transition-colors ${BORDER[status]}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-white truncate">{label}</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Scheduled: <span className="text-gray-300">{schedule}</span>
          </p>
          {lastRun && (
            <p className="text-xs text-gray-500 mt-1">
              Last: {formatTime(lastRun.finishedAt)} · {lastRun.trigger}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge.classes}`}
        >
          {badge.text}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Run / Running button */}
        <button
          onClick={onRun}
          disabled={!canRun}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
            canRun
              ? jobType === "kishor"
                ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white"
                : "bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isThisRunning ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
              Running…
            </span>
          ) : (
            "Run Now"
          )}
        </button>

        {/* Terminate button — only visible while this job is running */}
        {isThisRunning && (
          <button
            onClick={handleTerminate}
            disabled={terminating}
            className="px-4 py-2.5 rounded-lg font-medium text-sm bg-red-700 hover:bg-red-600 active:bg-red-800 disabled:bg-red-900 disabled:text-red-500 text-white transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            {terminating ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Stopping…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                Stop
              </>
            )}
          </button>
        )}
      </div>

      {/* Status banners */}
      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950 border border-red-700 px-3 py-2 text-sm text-red-300">
          <span className="shrink-0">⚠</span>
          <span>Job failed. See the output below for details.</span>
        </div>
      )}
      {status === "terminated" && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-950 border border-orange-700 px-3 py-2 text-sm text-orange-300">
          <span className="shrink-0">◼</span>
          <span>Job was manually stopped.</span>
        </div>
      )}
      {terminateError && (
        <div className="rounded-lg bg-red-950 border border-red-700 px-3 py-2 text-sm text-red-300">
          Could not stop job: {terminateError}
        </div>
      )}

      {/* Log viewer — stays visible after finish */}
      {activeJobId && (
        <LogViewer
          jobId={activeJobId}
          onDone={(code, terminalStatus) => {
            setTerminating(false);
            if (terminalStatus === "terminated") {
              onTerminated();
            } else {
              onDone(code);
            }
          }}
        />
      )}
    </div>
  );
}
