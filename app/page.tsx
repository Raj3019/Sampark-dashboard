'use client';

import { Fragment, useMemo } from 'react';
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
        notes[date] = `${label} • ${parts.join(' • ')}`;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sabha Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of Yuva, AYC, and Bal sabha attendance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">          <span className="text-slate-500 text-xs">Updated: {updatedTime}</span>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Yuvaks" value={totalYuvaks} subtitle="All three sabhas combined" icon="👥" accent="orange" />
        <StatsCard title="Active" value={totalGreen} subtitle={`${totalYuvaks > 0 ? Math.round((totalGreen / totalYuvaks) * 100) : 0}% of total`} icon="✅" accent="green" />
        <StatsCard title="Needs Attention" value={needsAttentionFromSheet} subtitle="Absent last 4 sabhas" icon="⚠️" accent="yellow" />
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm font-medium">Overall Yuvaks</p>
            <span className="text-lg w-8 h-8 flex items-center justify-center rounded-lg border text-blue-400 bg-blue-500/10 border-blue-500/20">👥</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{totalYuvaks}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Attending: {attendingCount}</span>
            <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Non-attending: {nonAttendingCount}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-slate-100 font-semibold">Last 4 Sabha Average Attendance</h3>
          <p className="text-slate-500 text-xs mt-0.5">Hover on a card for latest session, sessions used, and yuvak coverage.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="group relative rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Overall</p>
            <p className="text-3xl font-bold text-blue-300 mt-1">{overallLast4AvgAttendance}%</p>
            <p className="text-xs text-slate-500 mt-1">Based on last {Math.min(4, overallTrend.length)} recorded sessions</p>
            <div className="pointer-events-none absolute left-3 right-3 bottom-[calc(100%+8px)] z-20 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
              <div className="rounded-xl border border-slate-600 bg-slate-900/98 p-3 shadow-2xl text-xs text-slate-200">
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
              <div key={`${card.sabhaType}-last4avg`} className="group relative rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <p className={`text-[11px] uppercase tracking-wide ${card.accent.title}`}>{card.ui.shortLabel}</p>
                <p className="text-3xl font-bold text-slate-100 mt-1">{card.avgAttendanceLast4}%</p>
                <p className="text-xs text-slate-500 mt-1">Based on last {Math.min(4, card.dates.length)} recorded sessions</p>
                <div className="pointer-events-none absolute left-3 right-3 bottom-[calc(100%+8px)] z-20 opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
                  <div className="rounded-xl border border-slate-600 bg-slate-900/98 p-3 shadow-2xl text-xs text-slate-200">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {sabhaCards.map((card) => (
          <div key={card.sabhaType} className={`bg-slate-800 border rounded-xl p-5 ${card.accent.border}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`font-semibold ${card.accent.title}`}>{card.ui.fullLabel}</h3>
                <p className="text-slate-500 text-xs">{card.ui.subtitle}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${card.accent.chip}`}>{card.ui.shortLabel}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-2xl font-bold text-slate-100">{card.stats.totalYuvaks}</p><p className="text-xs text-slate-500">Total</p></div>
              <div><p className="text-2xl font-bold text-green-400">{card.avgAttendanceLast4}%</p><p className="text-xs text-slate-500">Avg Att. (Last 4)</p></div>
              <div><p className={`text-2xl font-bold ${card.accent.expected}`}>{card.predicted}%</p><p className="text-xs text-slate-500">Expected</p></div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{card.activeFromSheet} active</span>
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{card.attentionFromSheet} attention</span>
            </div>

            <div className="mt-4 border-t border-slate-700 pt-4">
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

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-slate-100 font-semibold">Area Segregation</h3>
            <p className="text-slate-500 text-xs mt-0.5">Attending and non-attending counts by area and sabha type</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/70 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-300">
            Auto updates from sheet
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-900/40 shadow-inner">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900/70">
                <th className="sticky left-0 z-10 bg-slate-900/95 px-4 py-3 text-left text-slate-200 border-b border-slate-700 w-56">Area</th>
                {sabhaColumns.map((col) => (
                  <th key={col.key} className="px-3 py-3 text-center text-slate-100 border-b border-slate-700" colSpan={2}>
                    {col.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-900/40">
                <th className="sticky left-0 z-10 bg-slate-900/90 px-4 py-2 text-left text-slate-500 border-b border-slate-700 text-xs">&nbsp;</th>
                {sabhaColumns.map((col) => (
                  <Fragment key={`header-${col.key}`}>
                    <th key={`${col.key}-yes`} className="px-3 py-2 text-center text-emerald-300 border-b border-slate-700 text-xs uppercase tracking-wide">Yes</th>
                    <th key={`${col.key}-no`} className="px-3 py-2 text-center text-rose-300 border-b border-slate-700 text-xs uppercase tracking-wide">No</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {areaRows.map((row, idx) => (
                <tr key={row.area} className={`${idx % 2 === 0 ? 'bg-slate-800/35' : 'bg-slate-800/10'} hover:bg-sky-500/5 transition-colors`}>
                  <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-slate-100 border-b border-slate-700/70 font-medium">{row.area}</td>
                  {sabhaColumns.map((col) => (
                    <Fragment key={`${row.area}-${col.key}`}>
                      <td key={`${row.area}-${col.key}-yes`} className="px-3 py-3 text-center text-emerald-300 border-b border-slate-700/70 font-semibold tabular-nums">{row.values[col.key].yes}</td>
                      <td key={`${row.area}-${col.key}-no`} className="px-3 py-3 text-center border-b border-slate-700/70 font-semibold tabular-nums">
                        <span className={row.values[col.key].no === 0 ? 'text-slate-500' : 'text-rose-300'}>{row.values[col.key].no}</span>
                      </td>
                    </Fragment>
                  ))}
                </tr>
              ))}
              <tr className="bg-slate-900/70">
                <td className="sticky left-0 z-10 bg-slate-900/95 px-4 py-3 font-semibold text-white border-t border-slate-600">Total</td>
                {sabhaColumns.map((col) => (
                  <Fragment key={`total-${col.key}`}>
                    <td key={`total-${col.key}-yes`} className="px-3 py-3 text-center font-bold text-emerald-300 border-t border-slate-600 tabular-nums">{totalBySabha[col.key].yes}</td>
                    <td key={`total-${col.key}-no`} className="px-3 py-3 text-center font-bold border-t border-slate-600 tabular-nums">
                      <span className={totalBySabha[col.key].no === 0 ? 'text-slate-500' : 'text-rose-300'}>{totalBySabha[col.key].no}</span>
                    </td>
                  </Fragment>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-slate-100 font-semibold mb-1">Status Audit (Raw Parsed Values)</h3>
        <p className="text-slate-500 text-xs mb-4">Use this to verify sheet filter counts vs app counts.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-700/70">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-900/70">
                <th className="px-3 py-2 text-left text-slate-200 border-b border-slate-700">Sabha</th>
                <th className="px-3 py-2 text-center text-slate-200 border-b border-slate-700">Total</th>
                <th className="px-3 py-2 text-center text-emerald-300 border-b border-slate-700">Super Active Yes</th>
                <th className="px-3 py-2 text-center text-rose-300 border-b border-slate-700">Super Active No</th>
                <th className="px-3 py-2 text-center text-emerald-300 border-b border-slate-700">Attending Yes</th>
                <th className="px-3 py-2 text-center text-rose-300 border-b border-slate-700">Attending No</th>
                <th className="px-3 py-2 text-left text-slate-200 border-b border-slate-700">Super Active Names</th>
              </tr>
            </thead>
            <tbody>
              {statusAuditRows.map((row, idx) => (
                <tr key={row.sabha} className={idx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'}>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-slate-200">{row.sabha}</td>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-center text-slate-100 font-semibold">{row.total}</td>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-center text-emerald-300 font-semibold">{row.superActiveYes}</td>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-center text-rose-300 font-semibold">{row.superActiveNo}</td>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-center text-emerald-300 font-semibold">{row.attendingYes}</td>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-center text-rose-300 font-semibold">{row.attendingNo}</td>
                  <td className="px-3 py-2 border-b border-slate-700/70 text-xs text-slate-300">
                    {row.superActiveYesNames.length > 0 ? row.superActiveYesNames.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="order-2 lg:order-2 bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">Lowest Attendance Sessions</h3>
          <p className="text-slate-500 text-xs mb-4">Overall across Yuva, AYC, and Bal</p>
          {lowestOverall.length === 0 ? <p className="text-slate-500 text-sm">Not enough data.</p> : (
            <div className="space-y-3">
              {lowestOverall.map((s) => (
                <div key={s.date} className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm">{s.date}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {sessionNotesByDate[s.date] ?? 'Vakta/Topic not available for this session date'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-700 rounded-full h-1.5"><div className="h-full bg-yellow-500 rounded-full" style={{ width: `${s.percentage}%` }} /></div>
                    <span className="text-yellow-400 text-sm font-medium w-16 text-right">{s.count} ({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 lg:order-1 bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">Highest Attendance Sessions</h3>
          <p className="text-slate-500 text-xs mb-4">Overall across Yuva, AYC, and Bal</p>
          {highestOverall.length === 0 ? <p className="text-slate-500 text-sm">Not enough data.</p> : (
            <div className="space-y-3">
              {highestOverall.map((s) => (
                <div key={s.date} className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-300 text-sm">{s.date}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {sessionNotesByDate[s.date] ?? 'Vakta/Topic not available for this session date'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-700 rounded-full h-1.5"><div className="h-full bg-green-500 rounded-full" style={{ width: `${s.percentage}%` }} /></div>
                    <span className="text-green-400 text-sm font-medium w-16 text-right">{s.count} ({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-slate-100 font-semibold">KK Performance by Sabha</h3>
        {kkInsightsBySabha.map((insight) => (
          <div key={`kk-insight-${insight.sabhaType}`} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-100 font-medium">{insight.label}</p>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-700 text-slate-300">{insight.shortLabel}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900/40 border border-green-500/20 rounded-xl p-4">
                <h4 className="text-slate-100 font-semibold mb-1">Most Active KK</h4>
                <p className="text-slate-500 text-xs mb-3">Best follow-up attendance performance (Last 4 Sabha)</p>
                {!insight.mostActiveKK ? (
                  <p className="text-slate-500 text-sm">No KK data available.</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-green-300 font-semibold text-base">{insight.mostActiveKK.name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Follow-up yuvaks: {insight.mostActiveKK.yuvaks.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">{insight.mostActiveKK.avgAttendanceLast4}%</p>
                        <p className="text-slate-500 text-xs">Avg attendance (Last 4 Sabha)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{insight.mostActiveKK.greenCount} active</span>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{insight.mostActiveKK.yellowCount} attention</span>
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <p className="text-slate-400 text-xs mb-2">Follow-up yuvak list (with attendance)</p>
                      <p className="text-slate-500 text-[11px] mb-2">% is based on last 4 sabha: {insight.last4Dates.join(', ') || 'N/A'}</p>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {[...insight.mostActiveKK.yuvaks]
                          .sort((a, b) => b.attendancePercent - a.attendancePercent)
                          .map((y, index) => {
                            const yLast4Pct = insight.last4Dates.length > 0
                              ? Math.round((insight.last4Dates.filter((d) => y.dateAttendance[d]).length / insight.last4Dates.length) * 100)
                              : 0;

                            return (
                            <div key={getKkYuvakRowKey('active', insight.mostActiveKK?.name, y, index)} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{y.name}</span>
                              <span className="text-green-300 font-medium">{yLast4Pct}%</span>
                            </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-slate-900/40 border border-yellow-500/20 rounded-xl p-4">
                <h4 className="text-slate-100 font-semibold mb-1">Most Deactive KK</h4>
                <p className="text-slate-500 text-xs mb-3">Lowest follow-up attendance performance (Last 4 Sabha)</p>
                {!insight.mostDeactiveKK ? (
                  <p className="text-slate-500 text-sm">No KK data available.</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-yellow-300 font-semibold text-base">{insight.mostDeactiveKK.name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Follow-up yuvaks: {insight.mostDeactiveKK.yuvaks.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-400">{insight.mostDeactiveKK.avgAttendanceLast4}%</p>
                        <p className="text-slate-500 text-xs">Avg attendance (Last 4 Sabha)</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{insight.mostDeactiveKK.greenCount} active</span>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{insight.mostDeactiveKK.yellowCount} attention</span>
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <p className="text-slate-400 text-xs mb-2">Follow-up yuvak list (with attendance)</p>
                      <p className="text-slate-500 text-[11px] mb-2">% is based on last 4 sabha: {insight.last4Dates.join(', ') || 'N/A'}</p>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {[...insight.mostDeactiveKK.yuvaks]
                          .sort((a, b) => a.attendancePercent - b.attendancePercent)
                          .map((y, index) => {
                            const yLast4Pct = insight.last4Dates.length > 0
                              ? Math.round((insight.last4Dates.filter((d) => y.dateAttendance[d]).length / insight.last4Dates.length) * 100)
                              : 0;

                            return (
                            <div key={getKkYuvakRowKey('deactive', insight.mostDeactiveKK?.name, y, index)} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{y.name}</span>
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
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Follow-Up Summary</h3>
          <p className="text-slate-500 text-xs mb-4">Top KKs by yuvak count</p>
          <div className="space-y-2 overflow-y-auto max-h-56">
            {kkStats.slice(0, 10).map((kk) => (
              <div key={kk.name} className="flex items-center justify-between py-1.5 border-b border-slate-700/50">
                <div>
                  <p className="text-slate-200 text-sm">{kk.name}</p>
                  <p className="text-slate-500 text-xs">{kk.yuvaks.length} yuvaks · avg {kk.avgAttendance}%</p>
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

