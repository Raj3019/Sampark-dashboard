'use client';

import { Fragment, useMemo } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useSheetData } from '@/hooks/useSheetData';
import {
  getHighestSessions,
  getKKStats,
  getLowestSessions,
  getPastDates,
  getSabhaStats,
  predictNextAttendance,
} from '@/lib/analytics';
import { SABHA_DISPLAY, SABHA_TYPES } from '@/lib/sabha';
import { SabhaType } from '@/lib/types';
import SabhaMetaPanel from '@/components/SabhaMetaPanel';
import StatsCard from '@/components/StatsCard';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading Sabha data...</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-4xl">⚠️</div>
        <p className="text-slate-300 font-medium">Failed to load data</p>
        <p className="text-slate-500 text-sm">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function getSabhaAccentClasses(sabhaType: SabhaType) {
  switch (SABHA_DISPLAY[sabhaType]?.accent) {
    case 'purple':
      return {
        border: 'border-purple-500/20',
        title: 'text-purple-400',
        chip: 'bg-purple-500/15 text-purple-300',
        expected: 'text-purple-400',
      };
    case 'orange':
      return {
        border: 'border-orange-500/20',
        title: 'text-orange-400',
        chip: 'bg-orange-500/15 text-orange-300',
        expected: 'text-orange-400',
      };
    default:
      return {
        border: 'border-blue-500/20',
        title: 'text-blue-400',
        chip: 'bg-blue-500/15 text-blue-300',
        expected: 'text-blue-400',
      };
  }
}

function getKkYuvakRowKey(prefix: string, kkName: string | undefined, yuvak: {
  name: string;
  area: string;
  std: string;
  attendancePercent: number;
}, index: number) {
  return [
    prefix,
    kkName ?? 'unknown-kk',
    yuvak.name,
    yuvak.area || 'unknown-area',
    yuvak.std || 'unknown-std',
    yuvak.attendancePercent,
    index,
  ].join('-');
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAttendanceSessionLabel(meta?: {
  sabhaLabel: string;
  vakta: string;
  topic: string;
}) {
  const topic = meta?.topic?.trim();
  const vakta = meta?.vakta?.trim();
  const sabhaLabel = meta?.sabhaLabel?.trim();

  return {
    title: topic || vakta || 'Vakta/Topic not available',
    subtitle: [vakta, sabhaLabel].filter(Boolean).join(' • ') || 'Session details unavailable',
  };
}

function formatAttendanceCardDate(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    const [day = '', month = ''] = dateString.split(/[-/\s]/);
    return {
      month: month.slice(0, 3).toUpperCase(),
      day: day.padStart(2, '0'),
    };
  }

  return {
    month: parsed.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    day: parsed.toLocaleDateString('en-IN', { day: '2-digit' }),
  };
}

function getAttendanceSabhaCopy(note?: string) {
  if (!note) {
    return {
      title: 'Sabha',
      subtitle: 'Vakta/Topic not available',
    };
  }

  const normalized = note.replace(/Ã¢â‚¬Â¢/g, '•');
  const parts = normalized.split('•').map((part) => part.trim()).filter(Boolean);
  const sabhaLabel = parts[0] ?? 'Sabha';
  const vakta = parts.find((part) => part.startsWith('Vakta:'))?.replace('Vakta:', '').trim();
  const topic = parts.find((part) => part.startsWith('Topic:'))?.replace('Topic:', '').trim();

  return {
    title: topic || 'Sabha',
    subtitle: [vakta, sabhaLabel].filter(Boolean).join(' • ') || 'Vakta/Topic not available',
  };
}

function AttendanceSabhaCard({
  title,
  subtitle,
  sessions,
  sessionNotesByDate,
  barClassName,
  valueClassName,
}: {
  title: string;
  subtitle: string;
  sessions: { date: string; count: number; percentage: number }[];
  sessionNotesByDate: Record<string, string>;
  barClassName: string;
  valueClassName: string;
}) {
  return (
    <div className="rounded-xl border border-[#d9cdbb] bg-[#f1eadf] p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-1 text-base font-semibold tracking-tight text-[#1f2937] dark:text-slate-100">{title}</h3>
      <p className="mb-4 text-xs text-[#64748b] dark:text-slate-400">{subtitle}</p>
      {sessions.length === 0 ? <p className="text-[#64748b] text-sm dark:text-slate-500">Not enough data.</p> : (
        <div className="space-y-4">
          {sessions.map((s) => {
            const dateParts = formatAttendanceCardDate(s.date);
            const content = getAttendanceSabhaCopy(sessionNotesByDate[s.date]);

            return (
              <div key={s.date} className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[18px] border border-[#d8cdbd] bg-[#fffdfa] dark:border-slate-600/35 dark:bg-slate-700/75">
                  <span className="text-[10px] font-semibold tracking-[0.16em] text-[#64748b] dark:text-slate-400">{dateParts.month}</span>
                  <span className="mt-0.5 text-[0.95rem] font-semibold leading-none text-[#1f2937] dark:text-slate-100">{dateParts.day}</span>
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-sm font-semibold leading-snug text-[#1f2937] dark:text-slate-100">{content.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[#64748b] dark:text-slate-400">{content.subtitle}</p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#d8cdbd] dark:bg-slate-700">
                      <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${s.percentage}%` }} />
                    </div>
                    <span className={`w-10 text-right text-sm font-medium ${valueClassName}`}>{s.percentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, refresh } = useSheetData();
  const sessionNotesByDate = useMemo(() => {
    const notes: Record<string, string> = {};
    const sabhaSessionMeta = data?.sabhaSessionMeta ?? {};

    Object.entries(sabhaSessionMeta).forEach(([sabhaType, byDate]) => {
      Object.entries(byDate ?? {}).forEach(([date, meta]) => {
        if (!meta) return;

        const vakta = meta.vakta?.trim();
        const topic = meta.topic?.trim();
        if (!vakta && !topic) return;
        if (notes[date]) return;

        const label = SABHA_DISPLAY[sabhaType as SabhaType]?.shortLabel ?? sabhaType;
        const parts: string[] = [];
        if (vakta) parts.push(`Vakta: ${vakta}`);
        if (topic) parts.push(`Topic: ${topic}`);
        notes[date] = `${label} â€¢ ${parts.join(' â€¢ ')}`;
      });
    });

    return notes;
  }, [data?.sabhaSessionMeta]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data || data.yuvaks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No data found. Check your Google Sheets tab names in the environment config.</p>
      </div>
    );
  }

  const { yuvaks, dates, lastUpdated, sabhaMeta, sabhaSessionMeta } = data;
  const pastDates = getPastDates(dates);
  const activePastDates = pastDates.filter((date) => yuvaks.some((y) => y.dateAttendance[date]));

  const sabhaCards = SABHA_TYPES.map((sabhaType) => {
    const sabhaYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
    const sabhaDates = pastDates.filter((date) => sabhaYuvaks.some((y) => y.dateAttendance[date]));
    const lastSabhaDate = sabhaDates[sabhaDates.length - 1];
    const lastSessionMeta = lastSabhaDate ? sabhaSessionMeta?.[sabhaType]?.[lastSabhaDate] : undefined;
    const last4SabhaDates = sabhaDates.slice(-4);
    const avgAttendanceLast4 = last4SabhaDates.length > 0 && sabhaYuvaks.length > 0
      ? Math.round(
          last4SabhaDates.reduce((sum, date) => {
            const attended = sabhaYuvaks.filter((y) => y.dateAttendance[date]).length;
            return sum + (attended / sabhaYuvaks.length) * 100;
          }, 0) / last4SabhaDates.length
        )
      : 0;
    const activeFromSheet = sabhaYuvaks.filter((y) => y.superActive).length;
    const attentionFromSheet = sabhaYuvaks.length - activeFromSheet;

    return {
      sabhaType,
      yuvaks: sabhaYuvaks,
      dates: sabhaDates,
      stats: getSabhaStats(yuvaks, sabhaDates, sabhaType),
      predicted: predictNextAttendance(getSabhaStats(yuvaks, sabhaDates, sabhaType).sessionTrend),
      meta: {
        ...sabhaMeta[sabhaType],
        vakta: lastSessionMeta?.vakta ?? '',
        topic: lastSessionMeta?.topic ?? '',
      },
      ui: SABHA_DISPLAY[sabhaType],
      accent: getSabhaAccentClasses(sabhaType),
      activeFromSheet,
      attentionFromSheet,
      avgAttendanceLast4,
    };
  });

  const totalGreen = yuvaks.filter((y) => y.superActive).length;
  const totalYuvaks = yuvaks.length;
  const needsAttentionFromSheet = yuvaks.filter((y) => !y.superActive).length;
  const attendingCount = yuvaks.filter((y) => y.attendingSabha).length;
  const nonAttendingCount = totalYuvaks - attendingCount;

  const overallTrend = activePastDates.map((date) => {
    const count = yuvaks.filter((y) => y.dateAttendance[date]).length;
    return { date, count, percentage: totalYuvaks > 0 ? Math.round((count / totalYuvaks) * 100) : 0 };
  });
  const overallLast4AvgAttendance = overallTrend.length > 0
    ? Math.round(overallTrend.slice(-4).reduce((sum, row) => sum + row.percentage, 0) / Math.min(4, overallTrend.length))
    : 0;
  const overallLast4Dates = overallTrend.slice(-4).map((row) => row.date);

  const lowestOverall = getLowestSessions(overallTrend, 3);
  const highestOverall = getHighestSessions(overallTrend, 3);
  const kkStats = getKKStats(yuvaks, activePastDates);
  const updatedTime = new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const activePercent = totalYuvaks > 0 ? Math.round((totalGreen / totalYuvaks) * 100) : 0;
  const attentionPercent = totalYuvaks > 0 ? Math.round((needsAttentionFromSheet / totalYuvaks) * 100) : 0;

  const sabhaColumns = [
    { key: 'Chirag Nagar', label: 'Yuva Sabha' },
    { key: 'Chirag Nagar(Kishor)', label: 'AYC Sabha' },
    { key: 'Bal Sabha', label: 'Bal Sabha' },
  ] as const;

  const kkInsightsBySabha = sabhaColumns.map((col) => {
    const sabhaType = col.key as SabhaType;
    const sabhaYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
    const sabhaDates = pastDates.filter((date) => sabhaYuvaks.some((y) => y.dateAttendance[date]));
    const last4Dates = sabhaDates.slice(-4);

    const sabhaKKStats = getKKStats(sabhaYuvaks, sabhaDates)
      .filter((kk) => kk.yuvaks.length > 0)
      .map((kk) => {
        const avgAttendanceLast4 = kk.yuvaks.length > 0 && last4Dates.length > 0
          ? Math.round(
              kk.yuvaks.reduce((sum, y) => {
                const attended = last4Dates.filter((d) => y.dateAttendance[d]).length;
                return sum + (attended / last4Dates.length) * 100;
              }, 0) / kk.yuvaks.length
            )
          : 0;

        return {
          ...kk,
          avgAttendanceLast4,
        };
      })
      .sort((a, b) => b.avgAttendanceLast4 - a.avgAttendanceLast4);

    return {
      sabhaType,
      label: col.label,
      shortLabel: SABHA_DISPLAY[sabhaType]?.shortLabel ?? col.label,
      last4Dates,
      mostActiveKK: sabhaKKStats.length > 0 ? sabhaKKStats[0] : null,
      mostDeactiveKK: sabhaKKStats.length > 0 ? sabhaKKStats[sabhaKKStats.length - 1] : null,
    };
  });

  const areaMap = new Map<string, Record<string, { yes: number; no: number }>>();
  yuvaks.forEach((y) => {
    const area = y.area?.trim() || 'Unassigned';
    if (!areaMap.has(area)) {
      areaMap.set(area, Object.fromEntries(sabhaColumns.map((col) => [col.key, { yes: 0, no: 0 }])));
    }

    const row = areaMap.get(area);
    if (!row) return;
    if (!sabhaColumns.some((col) => col.key === y.sabhaType)) return;

    if (y.attendingSabha) {
      row[y.sabhaType].yes += 1;
    } else {
      row[y.sabhaType].no += 1;
    }
  });

  const areaRows = Array.from(areaMap.entries())
    .map(([area, values]) => ({ area, values }))
    .sort((a, b) => a.area.localeCompare(b.area));

  const totalBySabha = Object.fromEntries(
    sabhaColumns.map((col) => [
      col.key,
      areaRows.reduce(
        (acc, row) => ({
          yes: acc.yes + row.values[col.key].yes,
          no: acc.no + row.values[col.key].no,
        }),
        { yes: 0, no: 0 }
      ),
    ])
  ) as Record<string, { yes: number; no: number }>;

  const statusAuditRows = sabhaColumns.map((col) => {
    const sabhaYuvaks = yuvaks.filter((y) => y.sabhaType === col.key);
    const superActiveYes = sabhaYuvaks.filter((y) => y.superActive).length;
    const superActiveNo = sabhaYuvaks.length - superActiveYes;
    const attendingYes = sabhaYuvaks.filter((y) => y.attendingSabha).length;
    const attendingNo = sabhaYuvaks.length - attendingYes;
    const superActiveYesNames = sabhaYuvaks
      .filter((y) => y.superActive)
      .map((y) => y.name)
      .sort((a, b) => a.localeCompare(b));

    return {
      sabha: col.label,
      total: sabhaYuvaks.length,
      superActiveYes,
      superActiveNo,
      attendingYes,
      attendingNo,
      superActiveYesNames,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[30px] border border-[#d9cdbb] bg-[#f1eadf] px-6 py-6 shadow-[0_20px_45px_rgba(31,41,55,0.08)] dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfce] bg-[#fff7ed] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a16207] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <Sparkles className="h-3.5 w-3.5" />
            Dashboard Snapshot
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1f2937] dark:text-slate-100">Sabha Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#64748b] dark:text-slate-400">Overview of Yuva, AYC, and Bal sabha attendance with quick health signals and last-4 session momentum.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-[22rem]">
          <div className="rounded-2xl border border-[#d8cdbd] bg-[#fffdfa] px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">Last Updated</p>
            <p className="mt-1 text-lg font-semibold text-[#1f2937] dark:text-slate-100">{updatedTime}</p>
          </div>
          <div className="rounded-2xl border border-[#d8cdbd] bg-[#fffdfa] px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">Coverage</p>
            <p className="mt-1 text-lg font-semibold text-[#1f2937] dark:text-slate-100">{attendingCount} attending</p>
            <p className="mt-1 text-xs text-[#7c8798] dark:text-slate-500">{nonAttendingCount} not attending</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Yuvaks" value={totalYuvaks} subtitle="All three sabhas combined" icon="S" accent="orange" eyebrow="Network" />
        <StatsCard title="Active" value={totalGreen} subtitle={`${activePercent}% of total marked super active`} icon="A" accent="green" eyebrow="Healthy" />
        <StatsCard title="Needs Attention" value={needsAttentionFromSheet} subtitle={`${attentionPercent}% need follow-up attention`} icon="!" accent="yellow" eyebrow="Follow-up" />
        <div className="relative overflow-hidden rounded-[22px] border border-[#d9cdbb] bg-[#f1eadf] p-4 shadow-[0_14px_30px_rgba(31,41,55,0.06)] dark:border-slate-700/80 dark:bg-slate-800/90 dark:shadow-none">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-br from-sky-500/10 via-sky-500/0 to-transparent" />
          <div className="relative flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">Attendance Split</p>
                <p className="mt-1 text-[15px] font-medium text-[#64748b] dark:text-slate-400">Overall Yuvaks</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-xs font-semibold text-sky-600 dark:text-sky-300">OV</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-[2.1rem] font-bold tracking-tight text-sky-600 dark:text-sky-400">{totalYuvaks}</p>
              <div className="rounded-xl border border-[#d8cdbd] bg-[#fffdfa] px-2.5 py-1.5 text-right dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#94a3b8] dark:text-slate-500">Attending Rate</p>
                <p className="mt-1 text-sm font-semibold text-[#1f2937] dark:text-slate-100">{totalYuvaks > 0 ? Math.round((attendingCount / totalYuvaks) * 100) : 0}%</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-300">Attending: {attendingCount}</span>
              <span className="rounded-full bg-rose-500/12 px-2.5 py-0.5 font-medium text-rose-600 dark:text-rose-300">Non-attending: {nonAttendingCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#d9cdbb] bg-[#f1eadf] p-5 shadow-[0_16px_34px_rgba(31,41,55,0.07)] dark:border-slate-800 dark:bg-slate-800/90 dark:shadow-none">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">Momentum</p>
            <h3 className="mt-1 text-lg font-semibold text-[#1f2937] dark:text-slate-100">Last 4 Sabha Average Attendance</h3>
            <p className="mt-1 text-[13px] text-[#64748b] dark:text-slate-400">A cleaner view of short-term attendance strength across the overall network and each sabha.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d8cdbd] bg-[#fffdfa] px-3 py-1 text-[11px] text-[#64748b] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-400">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Hover a tile for latest session details
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="group relative overflow-hidden rounded-[20px] border border-[#d8cdbd] bg-[#fffdfa] p-4 transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-br from-sky-500/10 via-sky-500/0 to-transparent" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6488c7] dark:text-sky-300">Overall</p>
              <p className="mt-2 text-[2.05rem] font-bold tracking-tight text-sky-600 dark:text-sky-300">{overallLast4AvgAttendance}%</p>
              <p className="mt-1.5 text-[13px] text-[#7c8798] dark:text-slate-500">Based on last {Math.min(4, overallTrend.length)} recorded sessions</p>
            </div>
            <div className="pointer-events-none absolute left-3 right-3 bottom-[calc(100%+8px)] z-20 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
              <div className="rounded-2xl border border-slate-600 bg-slate-900/98 p-3 shadow-2xl text-xs text-slate-200">
                <p className="text-slate-100 font-semibold">Overall Last-4 Snapshot</p>
                <p className="mt-2 text-slate-300">
                  Latest session: <span className="text-slate-100">{overallLast4Dates[overallLast4Dates.length - 1] ?? 'N/A'}</span>
                </p>
                <p className="mt-1 text-slate-300">Sessions used ({overallLast4Dates.length}):</p>
                <p className="mt-1 text-slate-400 leading-relaxed">{overallLast4Dates.join(' • ') || 'N/A'}</p>
              </div>
            </div>
          </div>

          {sabhaCards.map((card) => {
            const last4Dates = card.dates.slice(-4);
            return (
              <div key={`${card.sabhaType}-last4avg`} className="group relative overflow-hidden rounded-[20px] border border-[#d8cdbd] bg-[#fffdfa] p-4 transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-br from-white to-transparent dark:from-slate-800/10" />
                <div className="relative">
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${card.accent.title}`}>{card.ui.shortLabel}</p>
                  <p className="mt-2 text-[2.05rem] font-bold tracking-tight text-[#1f2937] dark:text-slate-100">{card.avgAttendanceLast4}%</p>
                  <p className="mt-1.5 text-[13px] text-[#7c8798] dark:text-slate-500">Based on last {Math.min(4, card.dates.length)} recorded sessions</p>
                </div>
                <div className="pointer-events-none absolute left-3 right-3 bottom-[calc(100%+8px)] z-20 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                  <div className="rounded-2xl border border-slate-600 bg-slate-900/98 p-3 shadow-2xl text-xs text-slate-200">
                    <p className={`font-semibold ${card.accent.title}`}>{card.ui.shortLabel} Last-4 Snapshot</p>
                    <p className="mt-2 text-slate-300">
                      Latest session: <span className="text-slate-100">{last4Dates[last4Dates.length - 1] ?? 'N/A'}</span>
                    </p>
                    <p className="mt-1 text-slate-300">Sessions used ({last4Dates.length}):</p>
                    <p className="mt-1 text-slate-400 leading-relaxed">{last4Dates.join(' • ') || 'N/A'}</p>
                    <p className="mt-2 text-slate-300">
                      Yuvaks considered: <span className="text-slate-100">{card.stats.totalYuvaks}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-3">
        {sabhaCards.map((card) => (
          <div key={card.sabhaType} className={`rounded-[18px] border border-[#d9cdbb] bg-[#f1eadf] p-4 shadow-[0_10px_20px_rgba(31,41,55,0.045)] dark:bg-slate-800/90 dark:shadow-none ${card.accent.border}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className={`text-[1.25rem] font-semibold leading-tight ${card.accent.title}`}>{card.ui.fullLabel}</h3>
                <p className="mt-0.5 text-[12px] text-[#7c8798] dark:text-slate-500">{card.ui.subtitle}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${card.accent.chip}`}>{card.ui.shortLabel}</span>
            </div>

            <div className="grid grid-cols-3 items-start gap-3">
              <div className="min-w-0 text-left">
                <p className="font-mono text-[1.7rem] font-bold leading-none tracking-tight text-[#1f2937] dark:text-slate-100">{card.stats.totalYuvaks}</p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[#94a3b8] dark:text-slate-500">Total</p>
              </div>
              <div className="min-w-0 text-center">
                <p className="font-mono text-[1.7rem] font-bold leading-none tracking-tight text-emerald-600 dark:text-green-400">{card.avgAttendanceLast4}%</p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[#94a3b8] dark:text-slate-500">Avg Att.</p>
              </div>
              <div className="min-w-0 text-right">
                <p className={`font-mono text-[1.7rem] font-bold leading-none tracking-tight ${card.accent.expected}`}>{card.predicted}%</p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-[#94a3b8] dark:text-slate-500">Expected</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-300">{card.activeFromSheet} active</span>
              <span className="rounded-full bg-amber-500/12 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-300">{card.attentionFromSheet} attention</span>
            </div>

            <div className="mt-3 border-t border-[#d8cdbd] pt-3 dark:border-slate-700">
              <SabhaMetaPanel
                {...card.meta}
                compact={true}
                vaktaLabel="Last Sabha Vakta"
                topicLabel="Last Sabha Topic"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[22px] border border-[#d9cdbb] bg-[#f1eadf] p-4 shadow-[0_14px_30px_rgba(31,41,55,0.06)] dark:border-slate-800 dark:bg-slate-800/90 dark:shadow-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-[#1f2937] dark:text-slate-100">Area Segregation</h3>
            <p className="mt-0.5 text-[13px] text-[#7c8798] dark:text-slate-500">Attending and non-attending counts by area and sabha type</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#d8cdbd] bg-[#fffdfa] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#64748b] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
            Auto updates from sheet
          </span>
        </div>

        <div className="overflow-x-auto rounded-[18px] border border-[#d8cdbd] bg-[#fffdfa] dark:border-slate-700 dark:bg-slate-900/60">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f5efe6] dark:bg-slate-900/80">
                <th className="sticky left-0 z-10 w-56 border-b border-[#ece4d7] bg-[#f5efe6] px-4 py-3 text-left text-[15px] font-semibold text-[#1f2937] dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200">Area</th>
                {sabhaColumns.map((col) => (
                  <th key={col.key} className="border-b border-[#ece4d7] px-3 py-3 text-center text-[15px] font-semibold text-[#1f2937] dark:border-slate-700 dark:text-slate-100" colSpan={2}>
                    {col.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-[#fffdfa] dark:bg-slate-900/50">
                <th className="sticky left-0 z-10 border-b border-[#ece4d7] bg-[#fffdfa] px-4 py-2 text-left text-[11px] text-[#94a3b8] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-500">&nbsp;</th>
                {sabhaColumns.map((col) => (
                  <Fragment key={`header-${col.key}`}>
                    <th key={`${col.key}-yes`} className="border-b border-[#ece4d7] px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:border-slate-700 dark:text-emerald-300">Yes</th>
                    <th key={`${col.key}-no`} className="border-b border-[#ece4d7] px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-rose-500 dark:border-slate-700 dark:text-rose-300">No</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {areaRows.map((row, idx) => (
                <tr key={row.area} className={`${idx % 2 === 0 ? 'bg-[#fffdfa]/70 dark:bg-slate-800/35' : 'bg-[#f1eadf]/40 dark:bg-slate-800/10'} transition-colors hover:bg-sky-500/5`}>
                  <td className="sticky left-0 z-10 border-b border-[#ece4d7] bg-inherit px-4 py-3 text-[15px] font-medium text-[#1f2937] dark:border-slate-700/70 dark:text-slate-100">{row.area}</td>
                  {sabhaColumns.map((col) => (
                    <Fragment key={`${row.area}-${col.key}`}>
                      <td key={`${row.area}-${col.key}-yes`} className="border-b border-[#ece4d7] px-3 py-3 text-center font-semibold tabular-nums text-emerald-600 dark:border-slate-700/70 dark:text-emerald-300">{row.values[col.key].yes}</td>
                      <td key={`${row.area}-${col.key}-no`} className="border-b border-[#ece4d7] px-3 py-3 text-center font-semibold tabular-nums dark:border-slate-700/70">
                        <span className={row.values[col.key].no === 0 ? 'text-[#94a3b8] dark:text-slate-500' : 'text-rose-500 dark:text-rose-300'}>{row.values[col.key].no}</span>
                      </td>
                    </Fragment>
                  ))}
                </tr>
              ))}
              <tr className="bg-[#f5efe6] dark:bg-slate-900/80">
                <td className="sticky left-0 z-10 border-t border-[#d8cdbd] bg-[#f5efe6] px-4 py-3 font-semibold text-[#1f2937] dark:border-slate-600 dark:bg-slate-900/95 dark:text-white">Total</td>
                {sabhaColumns.map((col) => (
                  <Fragment key={`total-${col.key}`}>
                    <td key={`total-${col.key}-yes`} className="border-t border-[#d8cdbd] px-3 py-3 text-center font-bold tabular-nums text-emerald-600 dark:border-slate-600 dark:text-emerald-300">{totalBySabha[col.key].yes}</td>
                    <td key={`total-${col.key}-no`} className="border-t border-[#d8cdbd] px-3 py-3 text-center font-bold tabular-nums dark:border-slate-600">
                      <span className={totalBySabha[col.key].no === 0 ? 'text-[#94a3b8] dark:text-slate-500' : 'text-rose-500 dark:text-rose-300'}>{totalBySabha[col.key].no}</span>
                    </td>
                  </Fragment>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#d9cdbb] bg-[#f1eadf] p-5 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-[#1f2937] font-semibold mb-1 dark:text-slate-100">Status Audit (Raw Parsed Values)</h3>
        <p className="text-[#64748b] text-xs mb-4 dark:text-slate-500">Use this to verify sheet filter counts vs app counts.</p>
        <div className="overflow-x-auto rounded-lg border border-[#d8cdbd] dark:border-slate-700/70">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#eadfce]/70 dark:bg-slate-900/70">
                <th className="px-3 py-2 text-left text-[#1f2937] border-b border-[#d8cdbd] dark:text-slate-200 dark:border-slate-700">Sabha</th>
                <th className="px-3 py-2 text-center text-[#1f2937] border-b border-[#d8cdbd] dark:text-slate-200 dark:border-slate-700">Total</th>
                <th className="px-3 py-2 text-center text-emerald-600 border-b border-[#d8cdbd] dark:text-emerald-300 dark:border-slate-700">Super Active Yes</th>
                <th className="px-3 py-2 text-center text-rose-500 border-b border-[#d8cdbd] dark:text-rose-300 dark:border-slate-700">Super Active No</th>
                <th className="px-3 py-2 text-center text-emerald-600 border-b border-[#d8cdbd] dark:text-emerald-300 dark:border-slate-700">Attending Yes</th>
                <th className="px-3 py-2 text-center text-rose-500 border-b border-[#d8cdbd] dark:text-rose-300 dark:border-slate-700">Attending No</th>
                <th className="px-3 py-2 text-left text-[#1f2937] border-b border-[#d8cdbd] dark:text-slate-200 dark:border-slate-700">Super Active Names</th>
              </tr>
            </thead>
            <tbody>
              {statusAuditRows.map((row, idx) => (
                <tr key={row.sabha} className={idx % 2 === 0 ? 'bg-[#fffdfa]/70 dark:bg-slate-800/30' : 'bg-[#f1eadf]/40 dark:bg-slate-800/10'}>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-[#334155] dark:border-slate-700/70 dark:text-slate-200">{row.sabha}</td>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-center text-[#1f2937] font-semibold dark:border-slate-700/70 dark:text-slate-100">{row.total}</td>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-center text-emerald-600 font-semibold dark:border-slate-700/70 dark:text-emerald-300">{row.superActiveYes}</td>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-center text-rose-500 font-semibold dark:border-slate-700/70 dark:text-rose-300">{row.superActiveNo}</td>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-center text-emerald-600 font-semibold dark:border-slate-700/70 dark:text-emerald-300">{row.attendingYes}</td>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-center text-rose-500 font-semibold dark:border-slate-700/70 dark:text-rose-300">{row.attendingNo}</td>
                  <td className="px-3 py-2 border-b border-[#d8cdbd] text-xs text-[#334155] dark:border-slate-700/70 dark:text-slate-300">
                    {row.superActiveYesNames.length > 0 ? row.superActiveYesNames.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="order-2 lg:order-2">
          <AttendanceSabhaCard
            title="Lowest Attendance Sabhas"
            subtitle="Overall across Yuva, AYC, and Bal"
            sessions={lowestOverall}
            sessionNotesByDate={sessionNotesByDate}
            barClassName="bg-yellow-500"
            valueClassName="text-yellow-400"
          />
        </div>

        <div className="order-1 lg:order-1">
          <AttendanceSabhaCard
            title="Highest Attendance Sabhas"
            subtitle="Overall across Yuva, AYC, and Bal"
            sessions={highestOverall}
            sessionNotesByDate={sessionNotesByDate}
            barClassName="bg-green-500"
            valueClassName="text-green-400"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[#1f2937] font-semibold dark:text-slate-100">KK Performance by Sabha</h3>
        {kkInsightsBySabha.map((insight) => (
          <div key={`kk-insight-${insight.sabhaType}`} className="rounded-xl border border-[#d9cdbb] bg-[#f1eadf] p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#1f2937] font-medium dark:text-slate-100">{insight.label}</p>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#d8cdbd] text-[#334155] dark:bg-slate-700 dark:text-slate-300">{insight.shortLabel}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-green-500/20 bg-[#fffdfa]/70 p-4 dark:bg-slate-900/40">
                <h4 className="text-[#1f2937] font-semibold mb-1 dark:text-slate-100">Most Active KK</h4>
                <p className="text-[#64748b] text-xs mb-3 dark:text-slate-500">Best follow-up attendance performance (Last 4 Sabha)</p>
                {!insight.mostActiveKK ? (
                  <p className="text-[#64748b] text-sm dark:text-slate-500">No KK data available.</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-green-300 font-semibold text-base">{insight.mostActiveKK.name}</p>
                        <p className="text-[#64748b] text-xs mt-0.5 dark:text-slate-500">Follow-up yuvaks: {insight.mostActiveKK.yuvaks.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">{insight.mostActiveKK.avgAttendanceLast4}%</p>
                        <p className="text-[#64748b] text-xs dark:text-slate-500">Avg attendance (Last 4 Sabha)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{insight.mostActiveKK.greenCount} active</span>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{insight.mostActiveKK.yellowCount} attention</span>
                    </div>
                    <div className="border-t border-[#d8cdbd] pt-3 dark:border-slate-700">
                      <p className="text-[#64748b] text-xs mb-2 dark:text-slate-400">Follow-up yuvak list (with attendance)</p>
                      <p className="text-[#64748b] text-[11px] mb-2 dark:text-slate-500">% is based on last 4 sabha: {insight.last4Dates.join(', ') || 'N/A'}</p>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {[...insight.mostActiveKK.yuvaks]
                          .sort((a, b) => b.attendancePercent - a.attendancePercent)
                          .map((y, index) => {
                            const yLast4Pct = insight.last4Dates.length > 0
                              ? Math.round((insight.last4Dates.filter((d) => y.dateAttendance[d]).length / insight.last4Dates.length) * 100)
                              : 0;

                            return (
                            <div key={getKkYuvakRowKey('active', insight.mostActiveKK?.name, y, index)} className="flex items-center justify-between text-xs">
                              <span className="text-[#334155] dark:text-slate-300">{y.name}</span>
                              <span className="text-green-300 font-medium">{yLast4Pct}%</span>
                            </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-[#fffdfa]/70 p-4 dark:bg-slate-900/40">
                <h4 className="text-[#1f2937] font-semibold mb-1 dark:text-slate-100">Most Deactive KK</h4>
                <p className="text-[#64748b] text-xs mb-3 dark:text-slate-500">Lowest follow-up attendance performance (Last 4 Sabha)</p>
                {!insight.mostDeactiveKK ? (
                  <p className="text-[#64748b] text-sm dark:text-slate-500">No KK data available.</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-yellow-300 font-semibold text-base">{insight.mostDeactiveKK.name}</p>
                        <p className="text-[#64748b] text-xs mt-0.5 dark:text-slate-500">Follow-up yuvaks: {insight.mostDeactiveKK.yuvaks.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-400">{insight.mostDeactiveKK.avgAttendanceLast4}%</p>
                        <p className="text-[#64748b] text-xs dark:text-slate-500">Avg attendance (Last 4 Sabha)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{insight.mostDeactiveKK.greenCount} active</span>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{insight.mostDeactiveKK.yellowCount} attention</span>
                    </div>
                    <div className="border-t border-[#d8cdbd] pt-3 dark:border-slate-700">
                      <p className="text-[#64748b] text-xs mb-2 dark:text-slate-400">Follow-up yuvak list (with attendance)</p>
                      <p className="text-[#64748b] text-[11px] mb-2 dark:text-slate-500">% is based on last 4 sabha: {insight.last4Dates.join(', ') || 'N/A'}</p>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {[...insight.mostDeactiveKK.yuvaks]
                          .sort((a, b) => a.attendancePercent - b.attendancePercent)
                          .map((y, index) => {
                            const yLast4Pct = insight.last4Dates.length > 0
                              ? Math.round((insight.last4Dates.filter((d) => y.dateAttendance[d]).length / insight.last4Dates.length) * 100)
                              : 0;

                            return (
                            <div key={getKkYuvakRowKey('deactive', insight.mostDeactiveKK?.name, y, index)} className="flex items-center justify-between text-xs">
                              <span className="text-[#334155] dark:text-slate-300">{y.name}</span>
                              <span className="text-yellow-300 font-medium">{yLast4Pct}%</span>
                            </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {kkStats.length > 0 && (
        <div className="rounded-xl border border-[#d9cdbb] bg-[#f1eadf] p-5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-[#1f2937] font-semibold mb-1 dark:text-slate-100">KK Follow-Up Summary</h3>
          <p className="text-[#64748b] text-xs mb-4 dark:text-slate-500">Top KKs by yuvak count</p>
          <div className="space-y-2 overflow-y-auto max-h-56">
            {kkStats.slice(0, 10).map((kk) => (
              <div key={kk.name} className="flex items-center justify-between py-1.5 border-b border-[#d8cdbd] dark:border-slate-700/50">
                <div>
                  <p className="text-[#334155] text-sm dark:text-slate-200">{kk.name}</p>
                  <p className="text-[#64748b] text-xs dark:text-slate-500">{kk.yuvaks.length} yuvaks · avg {kk.avgAttendance}%</p>
                </div>
                <div className="flex gap-1.5 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{kk.greenCount}</span>
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">{kk.yellowCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

