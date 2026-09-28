import { createHmac } from 'node:crypto';
import type { JobType } from './jobRunner';

export interface HermesCronNotification {
  jobType: JobType;
  scheduleDay: string;
  reason: string;
  outcome: 'success' | 'failed';
  attempts: number;
  maxAttempts: number;
  jobId?: string;
  durationSeconds?: number;
  error?: string;
  result?: unknown;
}

export interface HermesDeliveryResult {
  status: 'delivered' | 'skipped' | 'failed';
  attempts: number;
  error?: string;
}

const DELIVERY_TIMEOUT_MS = 10_000;
const DELIVERY_ATTEMPTS = 3;
const MAX_MESSAGE_LENGTH = 3_900;

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)));
}

function nestedRecord(parent: Record<string, unknown> | undefined, key: string) {
  return asRecord(parent?.[key]);
}

function formatAttendanceDate(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function appendNameSection(lines: string[], label: string, names: string[]): void {
  if (names.length === 0) return;
  lines.push('', `${label} (${names.length})`, ...names.map((name) => `• ${name}`));
}

function truncateMessage(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) return message;
  const suffix = '\n\n… Message shortened. Open the Sabha dashboard for the full report.';
  const availableLength = MAX_MESSAGE_LENGTH - suffix.length;
  const shortened = message.slice(0, availableLength);
  const lastLineBreak = shortened.lastIndexOf('\n');
  return `${shortened.slice(0, lastLineBreak > 0 ? lastLineBreak : availableLength)}${suffix}`;
}

export function buildHermesCronPayload(input: HermesCronNotification) {
  const result = asRecord(input.result);
  const sabha = nestedRecord(result, 'sabha');
  const sampark = nestedRecord(result, 'sampark');
  const sheet = nestedRecord(result, 'sheet');
  const comparison = nestedRecord(result, 'comparison');
  const names = nestedRecord(result, 'names');
  const completedWithWarnings = result?.completedWithWarnings === true;
  const label = asString(sabha?.label) ?? (input.jobType === 'kishor' ? 'Kishor' : 'Yuva');
  const attendanceDate = formatAttendanceDate(sabha?.date);
  const icon = input.outcome === 'failed' ? '❌' : completedWithWarnings ? '⚠️' : '✅';
  const outcomeText = input.outcome === 'failed'
    ? 'failed after final retry'
    : completedWithWarnings
      ? 'completed with warnings'
      : 'completed successfully';

  const lines: string[] = [
    `${icon} ${label}`,
    `Attendance sync ${outcomeText}`,
    '',
    'RUN DETAILS',
  ];

  if (attendanceDate) lines.push(`📅 Attendance: ${attendanceDate}`);
  lines.push(`🗓 Scheduled: ${input.scheduleDay}`);
  if (input.durationSeconds !== undefined) {
    lines.push(`⏱ Duration: ${formatDuration(input.durationSeconds)}`);
  }
  lines.push(`🔁 Attempt: ${input.attempts}/${input.maxAttempts}`);

  const samparkPresent = asNumber(sampark?.present);
  const samparkAbsent = asNumber(sampark?.absent);
  const samparkTotal = asNumber(sampark?.total);
  const sheetYes = asNumber(sheet?.yes);
  const sheetNo = asNumber(sheet?.no);
  const sheetTotal = asNumber(sheet?.total);
  const hasSamparkCounts =
    samparkPresent !== undefined || samparkAbsent !== undefined || samparkTotal !== undefined;
  const hasSheetCounts =
    sheetYes !== undefined || sheetNo !== undefined || sheetTotal !== undefined;

  if (hasSamparkCounts || hasSheetCounts) lines.push('', 'ATTENDANCE SUMMARY');

  if (hasSamparkCounts) {
    lines.push(
      `Sampark  • Present ${samparkPresent ?? '?'}  • Absent ${samparkAbsent ?? '?'}  • Total ${samparkTotal ?? '?'}`
    );
  }

  if (hasSheetCounts) {
    lines.push(`Sheet       • Yes ${sheetYes ?? '?'}  • No ${sheetNo ?? '?'}  • Total ${sheetTotal ?? '?'}`);
  }

  const presentDifference = asNumber(comparison?.presentDifference);
  if (presentDifference !== undefined && presentDifference !== 0) {
    const differenceText = presentDifference > 0
      ? `Sampark has ${presentDifference} more present`
      : `Sheet has ${Math.abs(presentDifference)} more Yes`;
    lines.push(`⚠️ ${differenceText}`);
  }

  const onlyInSampark = asStringArray(names?.onlyInSampark);
  const skippedOrUnwritten = asStringArray(names?.skippedOrUnwritten);
  const onlyInSheetEntries = Array.isArray(names?.onlyInSheet) ? names.onlyInSheet : [];
  const onlyInSheetSections = onlyInSheetEntries.flatMap((entry) => {
    const record = asRecord(entry);
    const entryNames = asStringArray(record?.names);
    if (entryNames.length === 0) return [];
    return [{
      label: `Only in Sheet — ${asString(record?.tabName) ?? 'Unknown sheet'}`,
      names: entryNames,
    }];
  });

  if (onlyInSampark.length > 0 || onlyInSheetSections.length > 0) {
    lines.push('', 'ROSTER DIFFERENCES');
  }
  appendNameSection(lines, 'Only in Sampark', onlyInSampark);
  for (const section of onlyInSheetSections) {
    appendNameSection(lines, section.label, section.names);
  }

  if (skippedOrUnwritten.length > 0) {
    lines.push('', 'NOT WRITTEN TO SHEET');
    lines.push(...skippedOrUnwritten.map((name) => `• ${name}`));
  }

  const failedStage = asString(result?.failedStage);
  const reportError = asString(result?.error);
  if (failedStage || input.error || reportError || !result) lines.push('', 'ERROR DETAILS');
  if (failedStage) lines.push(`Stage: ${failedStage}`);
  if (input.error || reportError) lines.push(input.error ?? reportError ?? 'Unknown error');
  if (!result) lines.push('Structured report unavailable');

  const status = input.outcome === 'failed'
    ? 'failed'
    : completedWithWarnings
      ? 'completed_with_warnings'
      : 'success';
  // Hermes uses the request ID for idempotency. A schedule-day-based ID causes
  // later manual or test runs on the same day to be accepted but not delivered.
  // The scheduler job ID is unique per run, while notifyHermes reuses this
  // payload across delivery retries, so retries remain safely idempotent.
  const runId = input.jobId ?? `${input.jobType}-${input.scheduleDay}-${Date.now()}`;

  return {
    event_type: `sabha_sync.${status}`,
    source: 'sabha-sync',
    request_id: `sabha-sync-${runId}-${status}`,
    job_id: input.jobId,
    job_type: input.jobType,
    schedule_day: input.scheduleDay,
    trigger_reason: input.reason,
    status,
    attempts: input.attempts,
    message: truncateMessage(lines.join('\n')),
    result: input.result,
  };
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function notifyHermes(
  input: HermesCronNotification
): Promise<HermesDeliveryResult> {
  if (!isEnabled(process.env.HERMES_NOTIFICATIONS_ENABLED)) {
    return { status: 'skipped', attempts: 0 };
  }

  const rawUrl = process.env.HERMES_WEBHOOK_URL?.trim();
  const secret = process.env.HERMES_WEBHOOK_SECRET?.trim();
  if (!rawUrl || !secret) {
    return {
      status: 'failed',
      attempts: 0,
      error: 'Hermes notifications are enabled but webhook URL or secret is missing',
    };
  }

  let webhookUrl: URL;
  try {
    webhookUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(webhookUrl.protocol)) throw new Error('unsupported protocol');
  } catch {
    return { status: 'failed', attempts: 0, error: 'HERMES_WEBHOOK_URL is invalid' };
  }

  const payload = buildHermesCronPayload(input);
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureV2 = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  // Hermes V2 binds the timestamp to the body for replay protection. Keep the
  // legacy body-only signature alongside it so older Hermes deployments that
  // do not know the V2 header can still authenticate the same request. Newer
  // Hermes versions always prefer and enforce V2 when both headers are sent.
  const signatureV1 = createHmac('sha256', secret).update(body).digest('hex');

  let lastError = 'Unknown Hermes delivery error';
  for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Signature-V2': signatureV2,
          'X-Webhook-Signature': signatureV1,
          'X-Request-ID': payload.request_id,
        },
        body,
        signal: controller.signal,
      });

      if (response.ok) return { status: 'delivered', attempts: attempt };
      const responseDetail = (await response.text().catch(() => '')).trim().slice(0, 300);
      lastError =
        `Hermes webhook returned HTTP ${response.status}` +
        (responseDetail ? `: ${responseDetail}` : '');
      if (!shouldRetry(response.status)) {
        return { status: 'failed', attempts: attempt, error: lastError };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }

    if (attempt < DELIVERY_ATTEMPTS) await sleep(attempt * 1_000);
  }

  return { status: 'failed', attempts: DELIVERY_ATTEMPTS, error: lastError };
}
