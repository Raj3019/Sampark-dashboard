import fs from "fs";
import path from "path";
import pino from "pino";

// Shared pretty-ish log destination for the sync app. Writes to:
//  - stdout (captured by `docker logs` / Dokploy log viewer)
//  - apps/sync/logs/YYYY-MM-DD.log (read by /api/application-logs -> Logs page)
const LOGS_DIR = path.join(process.cwd(), "..", "logs");

let destinationPath: string | null = null;

try {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  destinationPath = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
} catch {
  destinationPath = null;
}

const streams: pino.StreamEntry[] = [{ stream: process.stdout, level: "info" as const }];

if (destinationPath) {
  streams.push({ stream: pino.destination({ dest: destinationPath, mkdir: true, append: true }) });
}

export const appLogger = pino(
  {
    base: { app: "sync-frontend" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  pino.multistream(streams)
);

export function logEvent(
  level: "info" | "warn" | "error" | "debug",
  event: string,
  data: Record<string, unknown> = {}
): void {
  appLogger[level]({ event, ...data });
}
