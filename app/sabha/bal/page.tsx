'use client';

import { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useSheetData } from '@/hooks/useSheetData';
import { getAreaBreakdown, getHighestSessions, getKKStats, getLowestSessions, getPastDates, getSabhaStats, predictNextAttendance } from '@/lib/analytics';
import AreaBreakdownChart from '@/components/charts/AreaBreakdownChart';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';
import SabhaMetaPanel from '@/components/SabhaMetaPanel';
import StatsCard from '@/components/StatsCard';
import YuvakTable from '@/components/YuvakTable';

ChartJS.register(ArcElement, Tooltip, Legend);

type TabType = 'overview' | 'yuvaks' | 'kk';

export default function BalSabhaPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('yes');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button onClick={refresh} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { yuvaks, dates, sabhaMeta } = data;
  const pastDates = getPastDates(dates);
  const sabhaType = 'Bal Sabha' as const;
  const allBalYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
  const activePastDates = pastDates.filter((d) => allBalYuvaks.some((y) => y.dateAttendance[d]));

  const balYuvaks = allBalYuvaks.filter((y) =>
    attendingFilter === 'all' ? true : attendingFilter === 'yes' ? y.attendingSabha : !y.attendingSabha
  );

  const stats = getSabhaStats(balYuvaks, activePastDates, sabhaType);
  const kkStats = getKKStats(balYuvaks, activePastDates);
  const areaData = getAreaBreakdown(balYuvaks, activePastDates);
  const activeCount = stats.greenCount;
  const atRiskCount = stats.yellowCount;
  const lastDate = activePastDates[activePastDates.length - 1];
  const lastSabhaCount = lastDate ? balYuvaks.filter((y) => y.dateAttendance[lastDate]).length : 0;
  const totalCount = balYuvaks.length;
  const lastSabhaPct = totalCount > 0 ? Math.round((lastSabhaCount / totalCount) * 100) : 0;
  const predicted = predictNextAttendance(stats.sessionTrend);
  const trackedTrend = stats.sessionTrend.filter((s) => s.count > 0);
  const lowest = getLowestSessions(trackedTrend, 5);
  const highest = getHighestSessions(trackedTrend, 3);

  const donutData = {
    labels: ['Active', 'At Risk'],
    datasets: [{
      data: [activeCount, atRiskCount],
      backgroundColor: ['rgba(34,197,94,0.85)', 'rgba(234,179,8,0.85)'],
      borderColor: ['rgb(34,197,94)', 'rgb(234,179,8)'],
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { display: false } },
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-1 self-stretch rounded-full bg-orange-500" />
            <div>
              <h1 className="text-2xl font-bold text-orange-400">Bal Sabha</h1>
              <p className="text-slate-500 text-sm mt-0.5">Attendance overview for Bal Sabha</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            <span className="bg-orange-500/15 text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
              {predicted}% expected next sabha
            </span>
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-medium">
              {(['yes'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAttendingFilter(v)}
                  className={`px-3 py-1.5 transition-colors ${
                    attendingFilter === v
                      ? 'bg-green-700/60 text-green-200'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ✓ Attending
                </button>
              ))}
            </div>
            <button onClick={refresh} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors whitespace-nowrap">
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs pl-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-green-400 font-semibold">Active</span>&nbsp;= attended within last 3
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
            <span className="text-yellow-400 font-semibold">At Risk</span>&nbsp;= absent last 3, attended within 6
          </span>
        </div>

        <div className="pl-4">
          <SabhaMetaPanel {...sabhaMeta[sabhaType]} compact={true} />
        </div>
      </div>

      <div className="flex border-b border-slate-800 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'yuvaks', label: 'All Yuvaks' },
          { id: 'kk', label: 'KK Workload' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard title="Total Yuvaks" value={totalCount} subtitle="in Bal sabha" accent="orange" />
            <StatsCard title="Active" value={activeCount} subtitle="attended within last 3" accent="green" />
            <StatsCard title="At Risk" value={atRiskCount} subtitle="absent last 3, attended within 6" accent="yellow" />
            <StatsCard title="Last Sabha ✅" value={`${lastSabhaCount}/${totalCount}`} subtitle={lastDate ? `${lastDate} · ${lastSabhaPct}%` : '—'} accent="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">Sabha Breakdown</p>
              <div className="h-44 relative">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-100">{totalCount}</p>
                    <p className="text-slate-500 text-xs">Total</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <AttendanceTrendChart sessionTrend={stats.sessionTrend.slice(-20)} sabhaLabel="Bal Sabha" totalYuvaks={stats.totalYuvaks} />
            </div>
          </div>

          <AreaBreakdownChart areaData={areaData} title="Area-wise Breakdown (Bal)" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-slate-100 font-semibold mb-1">Lowest Sessions</h3>
              <p className="text-slate-500 text-xs mb-3">Lowest tracked Bal attendance</p>
              <div className="space-y-2">
                {lowest.map((s) => (
                  <div key={s.date} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{s.date}</span>
                    <span className="text-yellow-400">{s.count} ({s.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-slate-100 font-semibold mb-1">Best Sessions</h3>
              <p className="text-slate-500 text-xs mb-3">Highest tracked Bal attendance</p>
              <div className="space-y-2">
                {highest.map((s) => (
                  <div key={s.date} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{s.date}</span>
                    <span className="text-green-400">{s.count} ({s.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'yuvaks' && (
        <YuvakTable yuvaks={balYuvaks} dates={activePastDates} showSabhaType={false} />
      )}

      {activeTab === 'kk' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Workload — Bal Sabha</h3>
          <p className="text-slate-500 text-xs mb-5">Active / At Risk based on last 6 sabhas</p>
          <KKWorkloadChart kkStats={kkStats} dates={activePastDates} />
        </div>
      )}
    </div>
  );
}
