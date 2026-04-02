'use client';

import { useSheetData } from '@/hooks/useSheetData';
import {
  getAreaBreakdown,
  getHighestSessions,
  getKKStats,
  getLowestSessions,
  getPastDates,
  getSabhaStats,
  predictNextAttendance,
} from '@/lib/analytics';
import { SABHA_DISPLAY, SABHA_TYPES } from '@/lib/sabha';
import { SabhaType } from '@/lib/types';
import AreaBreakdownChart from '@/components/charts/AreaBreakdownChart';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import StatusPieChart from '@/components/charts/StatusPieChart';
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

export default function DashboardPage() {
  const { data, loading, error, refresh } = useSheetData();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data || data.yuvaks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No data found. Check your Google Sheets tab names in the environment config.</p>
      </div>
    );
  }

  const { yuvaks, dates, lastUpdated, sabhaMeta } = data;
  const pastDates = getPastDates(dates);
  const activePastDates = pastDates.filter((date) => yuvaks.some((y) => y.dateAttendance[date]));

  const sabhaCards = SABHA_TYPES.map((sabhaType) => {
    const sabhaYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
    const sabhaDates = pastDates.filter((date) => sabhaYuvaks.some((y) => y.dateAttendance[date]));

    return {
      sabhaType,
      yuvaks: sabhaYuvaks,
      dates: sabhaDates,
      stats: getSabhaStats(yuvaks, sabhaDates, sabhaType),
      predicted: predictNextAttendance(getSabhaStats(yuvaks, sabhaDates, sabhaType).sessionTrend),
      meta: sabhaMeta[sabhaType],
      ui: SABHA_DISPLAY[sabhaType],
      accent: getSabhaAccentClasses(sabhaType),
    };
  });

  const totalGreen = sabhaCards.reduce((sum, card) => sum + card.stats.greenCount, 0);
  const totalYellow = sabhaCards.reduce((sum, card) => sum + card.stats.yellowCount, 0);
  const totalYuvaks = yuvaks.length;

  const overallTrend = activePastDates.map((date) => {
    const count = yuvaks.filter((y) => y.dateAttendance[date]).length;
    return { date, count, percentage: totalYuvaks > 0 ? Math.round((count / totalYuvaks) * 100) : 0 };
  });

  const lowestOverall = getLowestSessions(overallTrend, 3);
  const highestOverall = getHighestSessions(overallTrend, 3);
  const kkStats = getKKStats(yuvaks, activePastDates);
  const areaBreakdown = getAreaBreakdown(yuvaks, activePastDates);
  const updatedTime = new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sabha Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of Yuva, Kishor, and Bal sabha attendance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-500 text-xs">Updated: {updatedTime}</span>
          <button onClick={refresh} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Yuvaks" value={totalYuvaks} subtitle="All three sabhas combined" icon="👥" accent="orange" />
        <StatsCard title="Active" value={totalGreen} subtitle={`${totalYuvaks > 0 ? Math.round((totalGreen / totalYuvaks) * 100) : 0}% of total`} icon="✅" accent="green" />
        <StatsCard title="Needs Attention" value={totalYellow} subtitle="Absent last 3 sabhas" icon="⚠️" accent="yellow" />
        <StatsCard title="Active Sabhas" value={sabhaCards.filter((card) => card.stats.totalYuvaks > 0).length} subtitle="Yuva, Kishor, Bal" icon="🗂" accent="blue" />
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
              <div><p className="text-2xl font-bold text-green-400">{card.stats.avgAttendance}%</p><p className="text-xs text-slate-500">Avg Att.</p></div>
              <div><p className={`text-2xl font-bold ${card.accent.expected}`}>{card.predicted}%</p><p className="text-xs text-slate-500">Expected</p></div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{card.stats.greenCount} active</span>
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{card.stats.yellowCount} attention</span>
            </div>

            <div className="mt-4 border-t border-slate-700 pt-4">
              <SabhaMetaPanel {...card.meta} compact={true} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AttendanceTrendChart sessionTrend={overallTrend} sabhaLabel="All Sabhas" totalYuvaks={totalYuvaks} />
        </div>
        <StatusPieChart green={totalGreen} yellow={totalYellow} red={0} title="Overall Status" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">Lowest Attendance Sessions</h3>
          <p className="text-slate-500 text-xs mb-4">Overall across Yuva, Kishor, and Bal</p>
          {lowestOverall.length === 0 ? <p className="text-slate-500 text-sm">Not enough data.</p> : (
            <div className="space-y-3">
              {lowestOverall.map((s) => (
                <div key={s.date} className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{s.date}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-700 rounded-full h-1.5"><div className="h-full bg-yellow-500 rounded-full" style={{ width: `${s.percentage}%` }} /></div>
                    <span className="text-yellow-400 text-sm font-medium w-16 text-right">{s.count} ({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">Highest Attendance Sessions</h3>
          <p className="text-slate-500 text-xs mb-4">Overall across Yuva, Kishor, and Bal</p>
          {highestOverall.length === 0 ? <p className="text-slate-500 text-sm">Not enough data.</p> : (
            <div className="space-y-3">
              {highestOverall.map((s) => (
                <div key={s.date} className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{s.date}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AreaBreakdownChart areaData={areaBreakdown} title="Area-wise Status (All Sabhas)" />
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
    </div>
  );
}
