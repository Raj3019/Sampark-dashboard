# Sabha Sync — Web App

Next.js 14 web interface for the Sabha attendance sync tool.

- **Two buttons** — trigger Kishor or Yuva Sabha sync manually
- **Live log streaming** — real-time terminal output in the browser via SSE
- **Persistent log browser** - `/logs` shows combined sync and scheduler logs with search and severity filters
- **Stop button** — terminate a running job at any time
- **Auto cron** — daily at 11:30 PM IST (Kishor) and 11:50 PM IST (Yuva); Sunday report job at 11:00 PM IST

The web app spawns the existing CLI (`../src/index.ts`) as a child process and streams its output to the browser. All scraping logic stays in the parent project.

---

## Prerequisites

Complete the root project setup first — `.env`, Google service account, and Playwright browsers must all be configured in `Auto/` before the web app will work.

See [`../README.md`](../README.md) for those steps.

---

## Development

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:3000`. Hot-reloads on file changes. Cron jobs are active in dev mode too.

---

## Production (Running Persistently)

Use `npm run start` (production build) for always-on use. This is required for cron jobs to fire reliably.

```bash
cd frontend
npm run build
npm run start
```

The server runs on `http://localhost:3000` by default. Keep this terminal open, or use pm2 (recommended).

### Hermes Agent API

Set `AGENT_API_SECRET` in the Sabha application to enable the protected endpoints:

```text
POST /api/agent/jobs
GET  /api/agent/jobs/{jobId}
```

Send the secret as `Authorization: Bearer <secret>`. The start endpoint accepts `kishor`, `yuvak`, or `report`. The status endpoint returns the structured run report after completion. Keep this secret server-side and use the same value as Hermes `SABHA_AGENT_API_SECRET`.

> **Note:** the existing deployment at `https://sabha.rajachauhan.dev` must be
> re-deployed from THIS repository's `frontend/` to receive the fixed result
> format (the report-flow job result sourcing and Hermes message content).
> Re-deploying Hermes itself is NOT required — the payload field names and
> routes are unchanged; only new optional result fields were added.

| Env var (Sabha application) | Purpose |
|---|---|
| `AGENT_API_SECRET` | Must match Hermes `SABHA_AGENT_API_SECRET`; enables the protected endpoints |
| `HERMES_NOTIFICATIONS_ENABLED` | `true`/`1`/`on`/`yes` enables the Hermes webhook delivery |
| `HERMES_WEBHOOK_URL` | Hermes webhook endpoint URL |
| `HERMES_WEBHOOK_SECRET` | HMAC secret for `X-Webhook-Signature-V2` / legacy `X-Webhook-Signature` |
| `REPORT_CRON_TIME` | Weekly report job time (default `23:00`), Sunday-only |

---

## Running as a Background Service with pm2

pm2 keeps the server running in the background, survives terminal closes, and auto-restarts on crashes or Windows reboots.

### 1. Install pm2

```bash
npm install -g pm2
```

### 2. Build the app

```bash
cd frontend
npm run build
```

### 3. Start with pm2

Run this from inside the `frontend/` folder:

```bash
pm2 start "npm run start" --name "sabha-sync"
```

### 4. Auto-start on Windows reboot

```bash
pm2 startup
pm2 save
```

`pm2 startup` prints a command — run it as Administrator if prompted.

### Useful pm2 commands

```bash
pm2 list                  # show all running processes
pm2 logs sabha-sync       # tail live logs
pm2 restart sabha-sync    # restart the server
pm2 stop sabha-sync       # stop the server
pm2 delete sabha-sync     # remove from pm2
```

---

## Deployment Options

This app needs Playwright (a real Chromium browser), long-running processes (~3–5 min per sync), and persistent memory for cron jobs. Most free serverless platforms do not support this.

### Option 1 — Local Windows Machine (Recommended)

Run on the same machine where you already use the CLI. No extra setup needed.

```bash
npm install -g pm2
cd frontend && npm run build
pm2 start "npm run start" --name "sabha-sync"
pm2 startup && pm2 save
```

Access at `http://localhost:3000`. Cron fires automatically as long as the machine is on.

### Option 2 — Oracle Cloud Always Free (Best free server option)

Oracle offers a permanently free ARM VM (4 CPUs, 24 GB RAM) — enough for this app.

Steps:
1. Sign up at [cloud.oracle.com](https://cloud.oracle.com) → create an Always Free ARM instance (Ubuntu)
2. SSH into the server
3. Install Node.js 18+: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`
4. Install Chromium dependencies: `sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2`
5. Clone your repo and run `npx playwright install chromium`
6. Set up `.env` with your credentials
7. `cd frontend && npm install && npm run build`
8. Use pm2 to keep it running (steps above)

### Option 3 — Railway (~$5/month, easiest paid option)

Railway supports long-running Node.js with persistent state.

1. Push code to GitHub
2. Create a new Railway project → connect your repo
3. Set the root directory to `frontend/`
4. Add environment variables (same as `.env`)
5. Railway auto-builds and deploys on push

Note: Playwright needs `npx playwright install chromium` during build. Add this to your Railway build command:
```
npm run build && npx playwright install chromium
```

### Option 4 — Fly.io (Free tier available)

Similar to Railway. Run from the `Auto/` root with a `Dockerfile`.

### Why Vercel / Netlify won't work

These platforms use serverless functions with a 10–30 second timeout. The Sabha scraper takes 3–5 minutes and requires a persistent browser — neither platform supports this.

---

## File Structure

```
frontend/
  app/
    page.tsx                    — Main UI (two Sabha cards)
    layout.tsx                  — Root HTML layout
    globals.css                 — Tailwind base styles
    api/
      run/route.ts              — POST /api/run — start a job
      terminate/route.ts        — POST /api/terminate — kill running job
      logs/[jobId]/route.ts     — GET /api/logs/:id — SSE log stream
      application-logs/route.ts - GET /api/application-logs - bounded persistent history
    logs/page.tsx               - Persistent log browser UI
      status/route.ts           — GET /api/status — current state
  components/
    SabhaCard.tsx               — Per-Sabha card with Run/Stop buttons
    LogViewer.tsx               — Live terminal output component
  lib/
    jobRunner.ts                — Singleton: spawns CLI, buffers logs, EventEmitter
  instrumentation.ts            — Cron job registration (runs on server start)
  next.config.mjs               — Next.js config (enables instrumentation hook)
  package.json
  tsconfig.json
```

---

## Cron Schedule

Cron jobs are registered in `instrumentation.ts` when the Next.js server starts. They fire automatically — no separate process needed.

| Sabha | Day | Time | Timezone |
|---|---|---|---|
| Kishor | Every day | `KISHOR_CRON_TIME` (default `23:30`) | `CRON_TIMEZONE` |
| Yuva | Every day | `YUVAK_CRON_TIME` (default `23:50`) | `CRON_TIMEZONE` |
| Report | Sunday only | `REPORT_CRON_TIME` (default `23:00`) | `CRON_TIMEZONE` |

Configure the schedule in the Sabha application environment:

```env
KISHOR_CRON_TIME=23:30
YUVAK_CRON_TIME=23:50
REPORT_CRON_TIME=23:00
CRON_TIMEZONE=Asia/Kolkata
```

Times must use 24-hour `HH:mm` format. Invalid values are logged at startup and
fall back to the defaults above. `CRON_TIMEZONE` must be a valid IANA timezone.
Changing these values requires restarting or redeploying the Sabha application.

Scheduled runs are queued when another job is active instead of being dropped.
Failures retry up to three times at five-minute intervals. Scheduler state is
stored in `runs/scheduler-state.json`, and events are written to
`logs/scheduler-YYYY-MM-DD.log`.

The server must still be kept running with pm2. If it restarts after a scheduled
time, the scheduler catches up that day's missed run (schedule-day aware: the
Sunday-only report job is only caught up on Sundays); restarts before 6 AM also
recover the previous evening's missed runs.

### Hermes notification content sample (report job)

The `report` job notification message carries the structured result, including
this summary line inside `message`:

```text
✅ Members Attendance report
Attendance sync completed successfully

RUN DETAILS
🗓 Scheduled: 2026-10-04
⏱ Duration: 1m 1s
🔁 Attempt: 1/3
📊 Sunday confirmation (week 2026-09-27) — Yuva 61/126 · Kishor 26/104 → RESULT: match (0)

ATTENDANCE SUMMARY
Sampark  • Present 87  • Absent 143  • Total 230
Sheet       • Yes 87  • No 143  • Total 230
...
```

---

## How It Works

1. User clicks "Run Now" (or cron fires)
2. `POST /api/run` calls `startJob()` in `lib/jobRunner.ts`
3. `jobRunner` spawns `npx ts-node src/index.ts --job <id>` from the `Auto/` root with `shell: true` (required on Windows)
4. stdout/stderr are captured line-by-line and emitted via `EventEmitter`
5. Browser connects to `GET /api/logs/:jobId` — an SSE stream
6. Buffered lines are flushed immediately; live lines stream as they arrive
7. On process exit, an `event: done` SSE event closes the stream
8. UI updates status badge (Done / Error / Terminated)

To terminate: clicking Stop calls `POST /api/terminate`, which runs `taskkill /pid <pid> /f /t` on Windows (kills the full process tree including Chromium).
