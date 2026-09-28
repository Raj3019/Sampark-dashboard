import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGS_DIR = path.join(process.cwd(), "..", "logs");
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const MAX_FILES_FOR_ALL = 31;
const MAX_BYTES_PER_FILE = 512 * 1024;

interface LogFileInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(100, Math.trunc(parsed)));
}

function isSafeLogFileName(value: string): boolean {
  return path.basename(value) === value && value.toLowerCase().endsWith(".log");
}

async function listLogFiles(): Promise<LogFileInfo[]> {
  try {
    const entries = await fs.readdir(LOGS_DIR, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isSafeLogFileName(entry.name))
        .map(async (entry) => {
          const stat = await fs.stat(path.join(LOGS_DIR, entry.name));
          return { name: entry.name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
        })
    );
    return files.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readTail(fileName: string): Promise<{ lines: string[]; truncated: boolean }> {
  const filePath = path.join(LOGS_DIR, fileName);
  const stat = await fs.stat(filePath);
  const bytesToRead = Math.min(stat.size, MAX_BYTES_PER_FILE);
  if (bytesToRead === 0) return { lines: [], truncated: false };

  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, stat.size - bytesToRead);
    let content = buffer.toString("utf8");
    if (stat.size > bytesToRead) {
      const firstNewline = content.indexOf("\n");
      content = firstNewline >= 0 ? content.slice(firstNewline + 1) : "";
    }
    return {
      lines: content.split(/\r?\n/).filter(Boolean),
      truncated: stat.size > bytesToRead,
    };
  } finally {
    await handle.close();
  }
}

export async function GET(request: NextRequest) {
  try {
    const files = await listLogFiles();
    const requestedFile = request.nextUrl.searchParams.get("file") || "all";
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    if (requestedFile !== "all" && !isSafeLogFileName(requestedFile)) {
      return NextResponse.json({ error: "Invalid log file name" }, { status: 400 });
    }
    if (requestedFile !== "all" && !files.some((file) => file.name === requestedFile)) {
      return NextResponse.json({ error: "Log file not found" }, { status: 404 });
    }

    const selectedFiles = requestedFile === "all"
      ? files.slice(0, MAX_FILES_FOR_ALL).reverse()
      : files.filter((file) => file.name === requestedFile);
    const chunks = await Promise.all(
      selectedFiles.map(async (file) => ({ file, ...(await readTail(file.name)) }))
    );
    const combined = chunks.flatMap(({ file, lines }) =>
      requestedFile === "all" ? lines.map((line) => "[" + file.name + "] " + line) : lines
    );
    const outputLines = combined.slice(-limit);
    const truncated =
      outputLines.length < combined.length ||
      chunks.some((chunk) => chunk.truncated) ||
      files.length > selectedFiles.length;

    return NextResponse.json(
      {
        files,
        selectedFile: requestedFile,
        lines: outputLines,
        truncated,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Could not read application logs", error);
    return NextResponse.json({ error: "Could not read application logs" }, { status: 500 });
  }
}
