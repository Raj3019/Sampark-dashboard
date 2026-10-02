import type { JobType } from "./jobRunner";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_TIMES: Record<JobType, string> = {
  kishor: "23:30",
  yuvak: "23:50",
  report: "23:00",
};

const TIME_ENV_NAMES: Record<JobType, string> = {
  kishor: "KISHOR_CRON_TIME",
  yuvak: "YUVAK_CRON_TIME",
  report: "REPORT_CRON_TIME",
};

export interface SabhaSchedule {
  jobType: JobType;
  time: string;
  hour: number;
  minute: number;
  expression: string;
  /** Optional cron day-of-week filter (0 = Sunday). Undefined = every day. */
  dayOfWeek?: number;
}

export interface SchedulerConfig {
  timezone: string;
  schedules: SabhaSchedule[];
  warnings: string[];
}

function buildSchedule(jobType: JobType, time: string, dayOfWeek?: number): SabhaSchedule {
  const [hour, minute] = time.split(":").map(Number);
  return {
    jobType,
    time,
    hour,
    minute,
    dayOfWeek,
    expression: `${minute} ${hour} * * ${dayOfWeek ?? "*"}`,
  };
}

function parseTime(
  jobType: JobType,
  rawValue: string | undefined
): { schedule: SabhaSchedule; warning?: string } {
  const envName = TIME_ENV_NAMES[jobType];
  const fallback = DEFAULT_TIMES[jobType];
  const value = rawValue?.trim() || fallback;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return {
      schedule: buildSchedule(jobType, fallback, jobType === "report" ? 0 : undefined),
      warning: `${envName}="${value}" is invalid; expected HH:mm (00:00-23:59). Using ${fallback}.`,
    };
  }

  return {
    schedule: buildSchedule(jobType, value, jobType === "report" ? 0 : undefined),
  };
}

function parseTimezone(rawValue: string | undefined): {
  timezone: string;
  warning?: string;
} {
  const value = rawValue?.trim() || DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return { timezone: value };
  } catch {
    return {
      timezone: DEFAULT_TIMEZONE,
      warning: `CRON_TIMEZONE="${value}" is invalid. Using ${DEFAULT_TIMEZONE}.`,
    };
  }
}

export function getSchedulerConfig(): SchedulerConfig {
  const kishor = parseTime("kishor", process.env.KISHOR_CRON_TIME);
  const yuvak = parseTime("yuvak", process.env.YUVAK_CRON_TIME);
  const report = parseTime("report", process.env.REPORT_CRON_TIME);
  const timezone = parseTimezone(process.env.CRON_TIMEZONE);

  return {
    timezone: timezone.timezone,
    schedules: [kishor.schedule, yuvak.schedule, report.schedule],
    warnings: [kishor.warning, yuvak.warning, report.warning, timezone.warning].filter(
      (warning): warning is string => Boolean(warning)
    ),
  };
}

export function formatDailySchedule(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `Daily ${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}
