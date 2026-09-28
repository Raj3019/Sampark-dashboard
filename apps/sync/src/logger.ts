import fs from "node:fs";
import path from "node:path";

export type LogLevel = "INFO" | "WARN" | "ERROR";

const logsDir = path.resolve(process.cwd(), "logs");

function todayLogPath(): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logsDir, `${date}.log`);
}

/**
 * Pull the most human-readable detail out of an unknown thrown value.
 * Google API errors (googleapis) hide the real reason in
 * `error.response.data.error.message`, so we surface that first, then fall back
 * to a stack trace, then to the plain message.
 */
function describeError(err: unknown): string {
  const anyErr = err as {
    response?: { data?: { error?: { message?: string; status?: string; code?: number } } };
    code?: string | number;
    stack?: string;
    message?: string;
  };

  const apiError = anyErr?.response?.data?.error;
  const parts: string[] = [];

  if (apiError?.message) {
    const status = apiError.status ?? apiError.code;
    parts.push(`Google API: ${apiError.message}${status ? ` (${status})` : ""}`);
  }
  if (anyErr?.code !== undefined) parts.push(`code: ${anyErr.code}`);

  if (err instanceof Error && err.stack) {
    parts.push(err.stack);
  } else if (anyErr?.message) {
    parts.push(anyErr.message);
  } else if (parts.length === 0) {
    parts.push(String(err));
  }

  return parts.join("\n    ");
}

export function log(level: LogLevel, message: string, err?: unknown): void {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${level}] ${message}`;
  if (err !== undefined) {
    line += `\n    ↳ ${describeError(err)}`;
  }

  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }

  try {
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(todayLogPath(), `${line}\n`, "utf8");
  } catch (writeError) {
    // Logging must never hide or replace the application error being reported.
    console.error(
      `[${timestamp}] [ERROR] Could not write application log: ${describeError(writeError)}`
    );
  }
}
