import type { JobType } from "./jobRunner";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_TIMES: Record<JobType, string> = {
  kishor: "23:55",
  yuvak: "23:55",
  report: "23:55",
};

const TIME_ENV_NAMES: Record<JobType, string> = {
  kishor: "KISHOR_CRON_TIME",
  yuvak: "YUVAK_CRON_TIME",
  report: "REPORT_CRON_TIME",
};

/** Cron day-of-week defaults (0 = Sunday, 3 = Wednesday, 5 = Friday). */
const DEFAULT_DAYS: Record<JobType, number> = {
  kishor: 3,
  yuvak: 5,
  report: 0,
};

const DAY_ENV_NAMES: Record<JobType, string> = {
  kishor: "KISHOR_CRON_DAY",
  yuvak: "YUVAK_CRON_DAY",
  report: "REPORT_CRON_DAY",
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
  rawValue: string | undefined,
  day: number
): { schedule: SabhaSchedule; warning?: string } {
  const envName = TIME_ENV_NAMES[jobType];
  const fallback = DEFAULT_TIMES[jobType];
  const value = rawValue?.trim() || fallback;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return {
      schedule: buildSchedule(jobType, fallback, day),
      warning: `${envName}="${value}" is invalid; expected HH:mm (00:00-23:59). Using ${fallback}.`,
    };
  }

  return {
    schedule: buildSchedule(jobType, value, day),
  };
}

export function parseCronDay(jobType: JobType, rawValue: string | undefined): {
  day?: number;
  warning?: string;
} {
  const envName = DAY_ENV_NAMES[jobType];
  const fallback = DEFAULT_DAYS[jobType];
  const value = rawValue?.trim();

  if (!value) {
    return { day: fallback };
  }

  const day = Number(value);

  if (!/^\d$/.test(value) || day > 6) {
    return {
      day: fallback,
      warning: `${envName}="${value}" is invalid; expected a single day-of-week 0-6 (0=Sunday). Using ${fallback}.`,
    };
  }

  return { day };
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
  const kishor = parseCronDay("kishor", process.env.KISHOR_CRON_DAY);
  const yuvak = parseCronDay("yuvak", process.env.YUVAK_CRON_DAY);
  const report = parseCronDay("report", process.env.REPORT_CRON_DAY);

  const kishorSchedule = parseTime("kishor", process.env.KISHOR_CRON_TIME, kishor.day!);
  const yuvakSchedule = parseTime("yuvak", process.env.YUVAK_CRON_TIME, yuvak.day!);
  const reportSchedule = parseTime("report", process.env.REPORT_CRON_TIME, report.day!);

  const timezone = parseTimezone(process.env.CRON_TIMEZONE);

  return {
    timezone: timezone.timezone,
    schedules: [kishorSchedule.schedule, yuvakSchedule.schedule, reportSchedule.schedule],
    warnings: [
      kishorSchedule.warning,
      yuvakSchedule.warning,
      reportSchedule.warning,
      kishor.warning,
      yuvak.warning,
      report.warning,
      timezone.warning,
    ].filter((warning): warning is string => Boolean(warning)),
  };
}

export function formatDailySchedule(time: string): string {
  return formatScheduleLabel(time);
}

export function formatScheduleLabel(time: string, day?: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const prefix = day === undefined ? "Daily" : dayNames[day];
  const padMinute = String(minute).padStart(2, "0");
  return prefix + " " + displayHour + ":" + padMinute + " " + period;
}
