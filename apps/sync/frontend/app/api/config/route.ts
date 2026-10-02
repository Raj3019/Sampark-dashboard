import { NextResponse } from "next/server";
import { formatScheduleLabel, getSchedulerConfig } from "@/lib/scheduleConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const scheduler = getSchedulerConfig();
  const schedules = Object.fromEntries(
    scheduler.schedules.map(({ jobType, time, dayOfWeek }) => [
      jobType,
      { time, label: formatScheduleLabel(time, dayOfWeek), dayOfWeek },
    ])
  );

  return NextResponse.json({
    scheduler: {
      timezone: scheduler.timezone,
      schedules,
    },
  });
}
