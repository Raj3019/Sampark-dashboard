"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

interface LogResponse {
  files: LogFileInfo[];
  selectedFile: string;
  lines: string[];
  truncated: boolean;
  generatedAt: string;
  error?: string;
}

type LevelFilter = "all" | "error" | "warn" | "info";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function lineClass(line: string): string {
  if (line.includes("[ERROR]") || line.includes("SYSTEM ERROR")) return "text-red-400";
  if (line.includes("[WARN]") || line.includes("SYSTEM WARN")) return "text-yellow-300";
  if (line.includes("[INFO]")) return "text-green-300";
  if (line.includes("[SYSTEM]")) return "text-blue-300";
  return "text-gray-300";
}

export default function LogsPage() {
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState("all");
  const [lines, setLines] = useState<string[]>([]);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(
        "/api/application-logs?file=" + encodeURIComponent(selectedFile) + "&limit=5000",
        { cache: "no-store" }
      );
      const payload = (await response.json()) as LogResponse;
      if (!response.ok) throw new Error(payload.error || "HTTP " + response.status);
      setFiles(payload.files);
      setLines(payload.lines);
      setTruncated(payload.truncated);
      setUpdatedAt(payload.generatedAt);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [selectedFile]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => void loadLogs(true), 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadLogs]);

  const filteredLines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lines.filter((line) => {
      const normalized = line.toLowerCase();
      const matchesSearch = !query || normalized.includes(query);
      const matchesLevel =
        level === "all" ||
        (level === "error" && (normalized.includes("[error]") || normalized.includes("system error"))) ||
        (level === "warn" && (normalized.includes("[warn]") || normalized.includes("system warn"))) ||
        (level === "info" && normalized.includes("[info]"));
      return matchesSearch && matchesLevel;
    });
  }, [level, lines, search]);

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="mb-3 inline-flex text-sm text-blue-400 hover:text-blue-300">
              &larr; Back to dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Application Logs</h1>
            <p className="mt-1.5 text-sm text-gray-400">
              Persistent sync and scheduler logs from this application.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </header>

        <section className="mb-4 grid gap-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4 md:grid-cols-[minmax(220px,1fr)_minmax(180px,1fr)_140px_auto]">
          <label className="text-xs font-medium text-gray-400">
            Log file
            <select
              value={selectedFile}
              onChange={(event) => setSelectedFile(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200"
            >
              <option value="all">All recent logs</option>
              {files.map((file) => (
                <option key={file.name} value={file.name}>
                  {file.name + " (" + formatSize(file.size) + ")"}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-gray-400">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, error, stage..."
              className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
            />
          </label>

          <label className="text-xs font-medium text-gray-400">
            Level
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as LevelFilter)}
              className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200"
            >
              <option value="all">All levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
            </select>
          </label>

          <label className="flex items-end gap-2 pb-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-950"
            />
            Auto-refresh
          </label>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 bg-gray-900 px-4 py-2 text-xs text-gray-400">
            <span>{filteredLines.length + " of " + lines.length + " lines"}</span>
            {truncated && <span className="text-yellow-400">Showing the newest bounded history</span>}
            {updatedAt && <span className="ml-auto">Updated {new Date(updatedAt).toLocaleTimeString()}</span>}
          </div>

          {error ? (
            <div className="p-6 text-sm text-red-400">Could not load logs: {error}</div>
          ) : (
            <div className="h-[65vh] overflow-auto p-4 font-mono text-xs leading-relaxed">
              {loading && lines.length === 0 ? (
                <div className="text-gray-500">Loading logs...</div>
              ) : filteredLines.length === 0 ? (
                <div className="text-gray-500">No matching log lines.</div>
              ) : (
                filteredLines.map((line, index) => (
                  <div
                    key={index + "-" + line.slice(0, 32)}
                    className={"whitespace-pre-wrap break-words " + lineClass(line)}
                  >
                    {line}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          )}
          <div className="flex justify-end border-t border-gray-800 bg-gray-900 px-4 py-2">
            <button
              type="button"
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Jump to latest
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
