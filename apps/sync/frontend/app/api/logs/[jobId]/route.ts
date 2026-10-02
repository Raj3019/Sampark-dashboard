import { NextRequest } from "next/server";
import { getJob } from "@/lib/jobRunner";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = getJob(params.jobId);

  if (!job) {
    return new Response(
      `Job "${params.jobId}" not found in the server's registry. ` +
        `It likely never started, already expired, or the server restarted/hot-reloaded since it was launched.`,
      { status: 404 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Client disconnected
        }
      };

      // Flush all buffered log lines immediately
      for (const line of job.logs) {
        send(`data: ${JSON.stringify(line)}\n\n`);
      }

      // If job is already finished, send done event and close
      if (job.status !== "running") {
        send(
          `event: done\ndata: ${JSON.stringify({
            exitCode: job.exitCode ?? (job.status === "done" ? 0 : 1),
            status: job.status,
          })}\n\n`
        );
        controller.close();
        return;
      }

      // Subscribe to live log events
      const onLog = (line: string) => {
        send(`data: ${JSON.stringify(line)}\n\n`);
      };

      const onDone = (code: number) => {
        send(
          `event: done\ndata: ${JSON.stringify({
            exitCode: code,
            status: job.status,
          })}\n\n`
        );
        cleanup();
        controller.close();
      };

      const cleanup = () => {
        job.emitter.off("log", onLog);
        job.emitter.off("done", onDone);
      };

      job.emitter.on("log", onLog);
      job.emitter.on("done", onDone);

      // Clean up if the client disconnects
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
