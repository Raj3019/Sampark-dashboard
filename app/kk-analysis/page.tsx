'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { getKKStats, getPastDates, getAttendanceStatus } from '@/lib/analytics';
import StatsCard from '@/components/StatsCard';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';
import StatusBadge from '@/components/StatusBadge';
import { KKStats } from '@/lib/types';

type SabhaFilter = 'cn' | 'kishor';

// Reusable section for one sabha's KK data
function KKSection({
  kkStats,
  dates,
  accentColor,
  label,
  borderClass,
  badgeClass,
}: {
  kkStats: KKStats[];
  dates: string[];
  accentColor: string;
  label: string;
  borderClass: string;
  badgeClass: string;
}) {
  const overloaded = kkStats.filter((k) => k.yuvaks.length > 6);
  const withRed    = kkStats.filter((k) => k.redCount > 0);
  const total      = kkStats.reduce((s, k) => s + k.yuvaks.length, 0);
  const avgPerKK   = kkStats.length > 0 ? Math.round(total / kkStats.length) : 0;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className={`flex items-center gap-3 pb-3 border-b ${borderClass}`}>
        <span className={`w-1 h-6 rounded-full ${accentColor}`} />
        <h2 className="text-slate-100 font-bold text-lg">{label}</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>{kkStats.length} KKs · {total} yuvaks</span>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Total KKs"        value={kkStats.length} subtitle="in this sabha"       accent="orange" />
        <StatsCard title="Avg Yuvaks/KK"    value={avgPerKK}        subtitle="per KK on average"   accent="blue" />
        <StatsCard title="Overloaded KKs"   value={overloaded.length} subtitle="more than 6 yuvaks" accent="yellow" />
        <StatsCard title="KKs w/ Red"       value={withRed.length}  subtitle="need urgent attention" accent="red" />
      </div>

      {/* Overloaded alert */}
      {overloaded.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex gap-2 mb-2">
            <span className="text-yellow-400">⚠️</span>
            <p className="text-yellow-300 font-medium text-sm">KKs with Heavy Follow-Up Load</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {overloaded.map((kk) => (
              <span key={kk.name} className="px-3 py-1 bg-yellow-500/15 border border-yellow-500/20 text-yellow-300 rounded-full text-xs">
                {kk.name} ({kk.yuvaks.length} yuvaks)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Workload chart */}
      <div className={`bg-slate-800 border rounded-xl p-5 ${borderClass}`}>
        <KKWorkloadChart kkStats={kkStats} dates={dates} />
      </div>

      {/* Detailed report heading */}
      <div className="flex items-center gap-3">
        <h3 className="text-slate-100 font-semibold text-sm">Detailed KK Report</h3>
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-slate-500 text-xs">{kkStats.length} KKs · {kkStats.reduce((s, k) => s + k.yuvaks.length, 0)} yuvaks</span>
      </div>

      {/* Detailed cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {kkStats.map((kk) => {
          const urgentYuvaks = kk.yuvaks
            .filter((y) => getAttendanceStatus(y, dates) === 'red' || getAttendanceStatus(y, dates) === 'yellow')
            .sort((a, b) => a.attendancePercent - b.attendancePercent);
          const total = kk.yuvaks.length;

          return (
            <div key={kk.name} className={`bg-slate-800 border rounded-xl p-5 ${kk.redCount > 0 ? 'border-red-500/20' : kk.yellowCount > 0 ? 'border-yellow-500/20' : 'border-slate-700'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-slate-100 font-semibold">{kk.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-100">{total}</p>
                  <p className="text-slate-500 text-xs">yuvaks</p>
                </div>
              </div>

              <div className="flex gap-0 h-2 rounded-full overflow-hidden mb-3">
                {kk.greenCount  > 0 && <div className="bg-green-500"  style={{ width: `${(kk.greenCount /total)*100}%` }} />}
                {kk.yellowCount > 0 && <div className="bg-yellow-400" style={{ width: `${(kk.yellowCount/total)*100}%` }} />}
                {kk.redCount    > 0 && <div className="bg-red-500"    style={{ width: `${(kk.redCount   /total)*100}%` }} />}
              </div>

              <div className="flex gap-3 text-xs mb-3">
                <span className="text-green-400">{kk.greenCount} active</span>
                <span className="text-yellow-400">{kk.yellowCount} at risk</span>
                <span className="text-red-400">{kk.redCount} inactive</span>
                <span className="ml-auto text-slate-400">avg {kk.avgAttendance}%</span>
              </div>

              {urgentYuvaks.length > 0 && (
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-slate-400 text-xs mb-2">Needs follow-up ({urgentYuvaks.length}):</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {urgentYuvaks.slice(0, 6).map((y, i) => (
                      <div key={`${y.name}-${i}`} className="flex items-center justify-between">
                        <span className="text-slate-300 text-xs">{y.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs">{y.attendancePercent.toFixed(0)}%</span>
                          <StatusBadge status={getAttendanceStatus(y, dates)} size="sm" />
                        </div>
                      </div>
                    ))}
                    {urgentYuvaks.length > 6 && (
                      <p className="text-slate-600 text-xs">+{urgentYuvaks.length - 6} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KKAnalysisPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('yes');
  const [sabhaFilter, setSabhaFilter] = useState<SabhaFilter>('cn');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={refresh} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm">Retry</button>
      </div>
    </div>
  );

  if (!data) return null;

  const { yuvaks, dates } = data;
  const pastDates = getPastDates(dates);

  // Split by sabha type
  const allCN     = yuvaks.filter((y) => y.sabhaType === 'Chirag Nagar');
  const allKishor = yuvaks.filter((y) => y.sabhaType === 'Chirag Nagar(Kishor)');

  // Active dates per sabha
  const cnActiveDates     = pastDates.filter((d) => allCN.some((y)     => y.dateAttendance[d]));
  const kishorActiveDates = pastDates.filter((d) => allKishor.some((y) => y.dateAttendance[d]));

  // Apply attending filter
  const applyAttending = <T extends { attendingSabha: boolean }>(arr: T[]) =>
    arr.filter((y) =>
      attendingFilter === 'all' ? true : attendingFilter === 'yes' ? y.attendingSabha : !y.attendingSabha
    );

  const cnYuvaks     = applyAttending(allCN);
  const kishorYuvaks = applyAttending(allKishor);

  const cnKKStats     = getKKStats(cnYuvaks,     cnActiveDates);
  const kishorKKStats = getKKStats(kishorYuvaks, kishorActiveDates);

  // Combined summary numbers
  const totalKKs    = new Set([...cnKKStats.map((k) => k.name), ...kishorKKStats.map((k) => k.name)]).size;
  const totalYuvaks = cnYuvaks.length + kishorYuvaks.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">KK Analysis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Follow-up KK workload across both sabhas ·{' '}
            <span className="text-blue-400">{cnKKStats.length} CN KKs</span>
            {' · '}
            <span className="text-purple-400">{kishorKKStats.length} Kishor KKs</span>
            {' · '}
            <span className="text-slate-400">{totalKKs} unique KKs · {totalYuvaks} yuvaks</span>
          </p>
        </div>
        <button onClick={refresh} className="px-2.5 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg self-start transition-colors">
          ↻ Refresh
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        {/* Sabha toggle */}
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-medium w-full sm:w-auto">
          <button
            onClick={() => setSabhaFilter('cn')}
            className={`px-3 py-1.5 transition-colors ${
              sabhaFilter === 'cn' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            🔵 Chirag Nagar
          </button>
          <button
            onClick={() => setSabhaFilter('kishor')}
            className={`px-3 py-1.5 transition-colors ${
              sabhaFilter === 'kishor' ? 'bg-purple-700/60 text-purple-100' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            🟣 Kishor
          </button>
        </div>

        {/* Attending filter */}
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-medium w-full sm:w-auto">
          {(['yes', 'no', 'all'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setAttendingFilter(v)}
              className={`px-3 py-1.5 transition-colors ${
                attendingFilter === v
                  ? v === 'yes' ? 'bg-green-700/60 text-green-200'
                    : v === 'no' ? 'bg-red-700/60 text-red-200'
                    : 'bg-slate-600 text-slate-100'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {v === 'all' ? 'All Yuvaks' : v === 'yes' ? '✓ Attending' : '✗ Not Attending'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {sabhaFilter === 'cn' && (
        <KKSection
          kkStats={cnKKStats}
          dates={cnActiveDates}
          accentColor="bg-blue-500"
          label="Chirag Nagar Sabha — KK Workload"
          borderClass="border-blue-500/20"
          badgeClass="bg-blue-500/10 text-blue-400 border border-blue-500/20"
        />
      )}

      {sabhaFilter === 'kishor' && (
        <KKSection
          kkStats={kishorKKStats}
          dates={kishorActiveDates}
          accentColor="bg-purple-500"
          label="Kishor Sabha — KK Workload"
          borderClass="border-purple-500/20"
          badgeClass="bg-purple-500/10 text-purple-400 border border-purple-500/20"
        />
      )}
    </div>
  );
}

