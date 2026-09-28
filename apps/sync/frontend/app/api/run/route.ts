import { NextRequest, NextResponse } from "next/server";
import { startJob, type JobType } from "@/lib/jobRunner";

export async function POST(req: NextRequest) {
  let body: { jobType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobType } = body;
  if (jobType !== "kishor" && jobType !== "yuvak") {
    return NextResponse.json(
      { error: 'jobType must be "kishor" or "yuvak"' },
      { status: 400 }
    );
  }

  try {
    const jobId = startJob(jobType as JobType, "manual");
    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
