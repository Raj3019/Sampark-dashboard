import { NextResponse } from "next/server";
import { getSheetUrl } from "@/lib/config";
import { formatDailySchedule, getSchedulerConfig } from "@/lib/scheduleConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const scheduler = getSchedulerConfig();
  const schedules = Object.fromEntries(
    scheduler.schedules.map(({ jobType, time }) => [
      jobType,
      { time, label: formatDailySchedule(time) },
    ])
  );

  return NextResponse.json({
    sheetUrl: getSheetUrl(),
    scheduler: {
      timezone: scheduler.timezone,
      schedules,
    },
  });
}
