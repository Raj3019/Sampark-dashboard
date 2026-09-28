import { NextResponse } from "next/server";
import { getStatus } from "@/lib/jobRunner";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getStatus());
}
