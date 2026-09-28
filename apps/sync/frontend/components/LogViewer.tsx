"use client";

import { useEffect, useRef, useState } from "react";

interface LogViewerProps {
  jobId: string;
  onDone: (exitCode: number, status: "done" | "error" | "terminated") => void;
}

type FinishedState = {
  exitCode: number;
  status: "done" | "error" | "terminated";
} | null;

export default function LogViewer({ jobId, onDone }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [finished, setFinished] = useState<FinishedState>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // stable ref so the useEffect cleanup doesn't depend on onDone identity
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setLines([]);
    setFinished(null);
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let completed = false;
    let reconnects = 0;
    let receivedCount = 0;
    const MAX_RECONNECTS = 4;

    const finish = (
      exitCode: number,
      status: "done" | "error" | "terminated"
    ) => {
      if (completed || stopped) return;
      completed = true;
      source?.close();
      setFinished({ exitCode, status });
      onDoneRef.current(exitCode, status);
    };

    const connect = () => {
      if (stopped || completed) return;
      source = new EventSource(`/api/logs/${jobId}`);
      let eventIndex = 0;

      source.onopen = () => {
        if (reconnects > 0) {
          setLines((prev) => [...prev, "[SYSTEM] Live log connection restored."]);
        }
      };

      source.onmessage = (event) => {
        const line = JSON.parse(event.data as string) as string;
        // Reconnections replay buffered logs. Skip the part already displayed,
        // then continue appending new events.
        if (eventIndex++ < receivedCount) return;
        receivedCount++;
        setLines((prev) => [...prev, line]);
      };

      source.addEventListener("done", (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data as string) as {
            exitCode: number;
            status: "done" | "error" | "terminated";
          };
          finish(payload.exitCode, payload.status);
        } catch {
          finish(1, "error");
        }
      });

      source.onerror = () => {
        source?.close();
        if (completed || stopped) return;

        reconnects++;
        if (reconnects <= MAX_RECONNECTS) {
          setLines((prev) => [
            ...prev,
            `[SYSTEM WARN] Live log connection lost; reconnecting (${reconnects}/${MAX_RECONNECTS})...`,
          ]);
          reconnectTimer = setTimeout(connect, 2_000);
          return;
        }

        setLines((prev) => [
          ...prev,
          "[SYSTEM ERROR] Live logs could not be restored after multiple attempts.",
        ]);
        finish(1, "error");
      };
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [jobId]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, finished]);

  const isSuccess = finished?.status === "done" && finished.exitCode === 0;
  const isTerminated = finished?.status === "terminated";
  const isError = finished !== null && !isSuccess;

  return (
    <div
      className={`mt-2 rounded-lg border overflow-hidden ${
        isTerminated
          ? "border-orange-700"
          : isError
          ? "border-red-700"
          : isSuccess
          ? "border-green-700"
          : "border-gray-700"
      }`}
    >
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700">
        <span className="w-3 h-3 rounded-full bg-red-500" />
        <span className="w-3 h-3 rounded-full bg-yellow-500" />
        <span className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-2 text-xs text-gray-400 font-mono">
          {finished === null ? "● Live Output" : "Output"}
        </span>
        {finished !== null && (
          <span
            className={`ml-auto text-xs font-mono px-2 py-0.5 rounded ${
              isTerminated
                ? "bg-orange-900 text-orange-300"
                : isSuccess
                ? "bg-green-900 text-green-300"
                : "bg-red-900 text-red-300"
            }`}
          >
            {isTerminated ? "Stopped" : isSuccess ? "✓ Success" : `✗ Exit ${finished.exitCode}`}
          </span>
        )}
      </div>

      {/* Log lines */}
      <div className="h-72 overflow-y-auto p-4 bg-gray-950 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <span className="text-gray-600">Starting process…</span>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={
                line.includes("[ERROR]") || line.includes("SYSTEM ERROR")
                  ? "text-red-400"
                  : line.includes("[WARN]")
                  ? "text-yellow-400"
                  : line.includes("[SYSTEM]")
                  ? "text-blue-400"
                  : "text-green-300"
              }
            >
              {line}
            </div>
          ))
        )}

        {/* Final status line */}
        {finished !== null && (
          <div
            className={`mt-3 pt-3 border-t font-semibold ${
              isTerminated
                ? "border-orange-800 text-orange-400"
                : isSuccess
                ? "border-green-800 text-green-400"
                : "border-red-800 text-red-400"
            }`}
          >
            {isTerminated
              ? "Job was stopped manually."
              : isSuccess
              ? "✓ Attendance sync completed successfully."
              : `✗ Job failed (exit code ${finished.exitCode}). Check the output above for details.`}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
