export async function register() {
  // Scheduler uses the filesystem and child processes, so it must only load in
  // the Node.js runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerScheduler } = await import("./lib/scheduler");
    registerScheduler();
  }
}
