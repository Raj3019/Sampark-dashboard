import type { JobType } from "./jobRunner";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_TIMES: Record<JobType, string> = {
  kishor: "23:30",
  yuvak: "23:50",
};

const TIME_ENV_NAMES: Record<JobType, string> = {
  kishor: "KISHOR_CRON_TIME",
  yuvak: "YUVAK_CRON_TIME",
};

export interface SabhaSchedule {
  jobType: JobType;
  time: string;
  hour: number;
  minute: number;
  expression: string;
}

export interface SchedulerConfig {
  timezone: string;
  schedules: SabhaSchedule[];
  warnings: string[];
}

function buildSchedule(jobType: JobType, time: string): SabhaSchedule {
  const [hour, minute] = time.split(":").map(Number);
  return {
    jobType,
    time,
    hour,
    minute,
    expression: `${minute} ${hour} * * *`,
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
      schedule: buildSchedule(jobType, fallback),
      warning: `${envName}="${value}" is invalid; expected HH:mm (00:00-23:59). Using ${fallback}.`,
    };
  }

  return { schedule: buildSchedule(jobType, value) };
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
  const timezone = parseTimezone(process.env.CRON_TIMEZONE);

  return {
    timezone: timezone.timezone,
    schedules: [kishor.schedule, yuvak.schedule],
    warnings: [kishor.warning, yuvak.warning, timezone.warning].filter(
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
