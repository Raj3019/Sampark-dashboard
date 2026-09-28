import { z } from 'zod';
import { getPastDates, getSessionTrend, getAttendanceStatus } from '@/lib/analytics';
import { ParsedSheetData, SabhaType, Yuvak } from '@/lib/types';
import { AttendingFilter, ChartSpec, TrendMode } from '@/lib/ai/types';

const MAX_CHART_POINTS = 24;
const MAX_CHART_SERIES = 4;
const MAX_RESULT_ROWS = 200;

export const attendingFilterSchema = z.enum(['yes', 'no', 'all']);
export const sabhaTypeSchema = z.enum(['Chirag Nagar', 'Chirag Nagar(Kishor)']);
export const trendModeSchema = z.enum(['attending', 'nonAttending', 'all']);
export const statusFilterSchema = z.enum(['green', 'yellow', 'red', 'all']);

export const chartSpecSchema = z.object({
  type: z.enum(['bar', 'line', 'pie']),
  title: z.string().min(1).max(120),
  labels: z.array(z.string().min(1).max(60)).min(1).max(MAX_CHART_POINTS),
  series: z.array(z.object({
    name: z.string().min(1).max(60),
    data: z.array(z.number().finite().min(0).max(100000)),
    color: z.string().min(3).max(30).optional(),
  })).min(1).max(MAX_CHART_SERIES),
}).superRefine((value, ctx) => {
  for (const [i, series] of value.series.entries()) {
    if (series.data.length !== value.labels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Series ${i + 1} length must match labels length`,
        path: ['series', i, 'data'],
      });
    }
  }

  if (value.type === 'pie' && value.series.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pie chart requires exactly one series',
      path: ['series'],
    });
  }
});

export function sanitizeMonths(months?: number): number {
  const safe = Number.isFinite(months) ? Math.round(months as number) : 3;
  return Math.min(12, Math.max(1, safe || 3));
}

function sanitizeLimit(limit?: number): number {
  const safe = Number.isFinite(limit) ? Math.round(limit as number) : 50;
  return Math.min(MAX_RESULT_ROWS, Math.max(1, safe || 50));
}

function parseDate(dateLabel: string): Date {
  const normalized = dateLabel
    .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`)
    .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, (_m, day, mon, yyyy) => `${mon} ${day} ${yyyy}`);
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function datesForMonths(dates: string[], months?: number): string[] {
  const safeMonths = sanitizeMonths(months);
  const past = getPastDates(dates);
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - safeMonths, now.getDate());
  return past.filter((d) => parseDate(d) >= cutoff);
}

function filterBySabha(yuvaks: Yuvak[], sabhaType: SabhaType): Yuvak[] {
  return yuvaks.filter((y) => y.sabhaType === sabhaType);
}

function filterByAttending(yuvaks: Yuvak[], filter: AttendingFilter): Yuvak[] {
  if (filter === 'all') return yuvaks;
  return yuvaks.filter((y) => (filter === 'yes' ? y.attendingSabha : !y.attendingSabha));
}

function activeDates(yuvaks: Yuvak[], dates: string[]): string[] {
  return dates.filter((date) => yuvaks.some((y) => y.dateAttendance[date]));
}

function summarizeStatuses(yuvaks: Yuvak[], dates: string[]) {
  const statuses = yuvaks.map((y) => getAttendanceStatus(y, dates));
  return {
    activeCount: statuses.filter((s) => s === 'green').length,
    atRiskCount: statuses.filter((s) => s === 'yellow').length,
    inactiveCount: statuses.filter((s) => s === 'red').length,
  };
}

function applyOptionalFilters(yuvaks: Yuvak[], options?: { sabhaType?: SabhaType; attendingFilter?: AttendingFilter }) {
  const bySabha = options?.sabhaType ? filterBySabha(yuvaks, options.sabhaType) : yuvaks;
  return options?.attendingFilter ? filterByAttending(bySabha, options.attendingFilter) : bySabha;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Supports partial phrase and "skip-middle-name" matching:
// query: "milind shah" -> target: "milind priyesh shah" (match)
function matchesPersonLikeQuery(targetName: string, queryText: string): boolean {
  const target = normalizeName(targetName);
  const query = normalizeName(queryText);

  if (!target || !query) return false;
  if (target.includes(query)) return true;

  const targetTokens = target.split(' ').filter(Boolean);
  const queryTokens = query.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return false;

  let qi = 0;
  for (const token of targetTokens) {
    if (token.includes(queryTokens[qi])) {
      qi++;
      if (qi === queryTokens.length) return true;
    }
  }
  return false;
}

export function getChiragSummary(data: ParsedSheetData, options?: { months?: number; attendingFilter?: AttendingFilter }) {
  const attendingFilter = options?.attendingFilter ?? 'yes';
  const windowDates = datesForMonths(data.dates, options?.months);
  const chiragAll = filterBySabha(data.yuvaks, 'Chirag Nagar');
  const filtered = filterByAttending(chiragAll, attendingFilter);
  const windowActiveDates = activeDates(chiragAll, windowDates);
  const status = summarizeStatuses(filtered, windowActiveDates);
  const trend = getSessionTrend(filtered, windowActiveDates);

  const avgAttendancePercent = filtered.length > 0
    ? Math.round((trend.reduce((sum, row) => sum + row.percentage, 0) / Math.max(1, trend.length)) * 10) / 10
    : 0;

  const latestSession = trend[trend.length - 1];

  return {
    sabhaType: 'Chirag Nagar' as const,
    months: sanitizeMonths(options?.months),
    attendingFilter,
    totalYuvaks: filtered.length,
    sessionsConsidered: trend.length,
    activeCount: status.activeCount,
    atRiskCount: status.atRiskCount,
    inactiveCount: status.inactiveCount,
    avgAttendancePercent,
    latestSession,
    insight: buildChiragInsight({
      total: filtered.length,
      ...status,
      avgAttendancePercent,
      latestSessionPct: latestSession?.percentage ?? 0,
    }),
  };
}

function buildChiragInsight(params: { total: number; activeCount: number; atRiskCount: number; inactiveCount: number; avgAttendancePercent: number; latestSessionPct: number }) {
  if (params.total === 0) return 'No yuvaks available for this filter and period.';
  return [
    `Active ${params.activeCount}/${params.total}`,
    `At risk ${params.atRiskCount}`,
    `Inactive ${params.inactiveCount}`,
    `Average attendance ${params.avgAttendancePercent}%`,
    `Latest session ${params.latestSessionPct}%`,
  ].join(' | ');
}

export function getAttendanceTrend(data: ParsedSheetData, options: { sabhaType: SabhaType; months?: number; mode?: TrendMode }) {
  const mode = options.mode ?? 'attending';
  const windowDates = datesForMonths(data.dates, options.months);
  const sabhaYuvaks = filterBySabha(data.yuvaks, options.sabhaType);
  const dates = activeDates(sabhaYuvaks, windowDates);
  const trend = getSessionTrend(sabhaYuvaks, dates);

  const labels = trend.map((row) => row.date);
  const attending = trend.map((row) => row.count);
  const nonAttending = trend.map((row) => Math.max(0, sabhaYuvaks.length - row.count));

  return {
    sabhaType: options.sabhaType,
    months: sanitizeMonths(options.months),
    mode,
    totalYuvaks: sabhaYuvaks.length,
    points: trend,
    labels,
    series: mode === 'nonAttending'
      ? [{ name: 'Not Attending', data: nonAttending, color: '#ef4444' }]
      : mode === 'all'
      ? [
          { name: 'Attending', data: attending, color: '#22c55e' },
          { name: 'Not Attending', data: nonAttending, color: '#ef4444' },
        ]
      : [{ name: 'Attending', data: attending, color: '#f97316' }],
  };
}

export function getStatusBreakdown(data: ParsedSheetData, options: { sabhaType: SabhaType; months?: number }) {
  const windowDates = datesForMonths(data.dates, options.months);
  const sabhaYuvaks = filterBySabha(data.yuvaks, options.sabhaType);
  const dates = activeDates(sabhaYuvaks, windowDates);
  const status = summarizeStatuses(sabhaYuvaks, dates);

  return {
    sabhaType: options.sabhaType,
    months: sanitizeMonths(options.months),
    totalYuvaks: sabhaYuvaks.length,
    ...status,
  };
}

export function getYuvaksByKK(
  data: ParsedSheetData,
  options: { kkName: string; sabhaType?: SabhaType; attendingFilter?: AttendingFilter; limit?: number }
) {
  const limited = sanitizeLimit(options.limit);
  const filtered = applyOptionalFilters(data.yuvaks, {
    sabhaType: options.sabhaType,
    attendingFilter: options.attendingFilter,
  });

  const matches = filtered
    .filter((y) => matchesPersonLikeQuery(y.followUpKK ?? '', options.kkName))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    kkName: options.kkName,
    sabhaType: options.sabhaType ?? 'all',
    attendingFilter: options.attendingFilter ?? 'all',
    totalMatches: matches.length,
    yuvaks: matches.slice(0, limited).map((y) => ({
      name: y.name,
      followUpKK: y.followUpKK,
      sabhaType: y.sabhaType,
      area: y.area,
      std: y.std,
      attendingSabha: y.attendingSabha,
      attendancePercent: y.attendancePercent,
    })),
  };
}

export function getYuvakDirectory(
  data: ParsedSheetData,
  options?: {
    sabhaType?: SabhaType;
    attendingFilter?: AttendingFilter;
    statusFilter?: 'green' | 'yellow' | 'red' | 'all';
    kkName?: string;
    query?: string;
    limit?: number;
  }
) {
  const attendingFilter = options?.attendingFilter ?? 'all';
  const statusFilter = options?.statusFilter ?? 'all';
  const limit = sanitizeLimit(options?.limit);
  const q = normalizeName(options?.query ?? '');
  const kkQ = normalizeName(options?.kkName ?? '');

  const base = applyOptionalFilters(data.yuvaks, {
    sabhaType: options?.sabhaType,
    attendingFilter,
  });

  const past = getPastDates(data.dates);
  const sabhaActiveDates: Record<SabhaType, string[]> = {
    'Chirag Nagar': activeDates(filterBySabha(data.yuvaks, 'Chirag Nagar'), past),
    'Chirag Nagar(Kishor)': activeDates(filterBySabha(data.yuvaks, 'Chirag Nagar(Kishor)'), past),
  };

  const withStatus = base.map((y) => ({
    ...y,
    computedStatus: getAttendanceStatus(y, sabhaActiveDates[y.sabhaType]),
  }));

  const filtered = withStatus
    .filter((y) => (statusFilter === 'all' ? true : y.computedStatus === statusFilter))
    .filter((y) => (kkQ ? matchesPersonLikeQuery(y.followUpKK ?? '', kkQ) : true))
    .filter((y) => {
      if (!q) return true;
      return (
        matchesPersonLikeQuery(y.name, q) ||
        matchesPersonLikeQuery(y.followUpKK ?? '', q) ||
        normalizeName(y.area).includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    lastUpdated: data.lastUpdated,
    sabhaType: options?.sabhaType ?? 'all',
    attendingFilter,
    statusFilter,
    totalMatches: filtered.length,
    yuvaks: filtered.slice(0, limit).map((y) => ({
      name: y.name,
      followUpKK: y.followUpKK || '',
      sabhaType: y.sabhaType,
      area: y.area,
      std: y.std,
      attendingSabha: y.attendingSabha,
      attendancePercent: y.attendancePercent,
      status: y.computedStatus,
    })),
  };
}
export function validateChartSpec(chart: ChartSpec): ChartSpec {
  return chartSpecSchema.parse(chart);
}

