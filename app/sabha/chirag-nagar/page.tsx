'use client';

import { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useSheetData } from '@/hooks/useSheetData';
import { getSabhaStats, getKKStats, getAreaBreakdown, getPastDates, getLowestSessions, getHighestSessions } from '@/lib/analytics';
import StatsCard from '@/components/StatsCard';
import YuvakTable from '@/components/YuvakTable';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';
import AreaBreakdownChart from '@/components/charts/AreaBreakdownChart';
import SabhaMetaPanel from '@/components/SabhaMetaPanel';

ChartJS.register(ArcElement, Tooltip, Legend);

type TabType = 'overview' | 'yuvaks' | 'kk';

export default function ChiragNagarPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('yes');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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

  const { yuvaks, dates, sabhaMeta } = data;

  // Only consider dates that have already occurred (≤ today)
  const pastDates = getPastDates(dates);

  const sabhaType = 'Chirag Nagar' as const;
  const allCNYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);

  // Dates where any CN yuvak attended — always based on all CN, unaffected by attending filter
  const activePastDates = pastDates.filter((d) => allCNYuvaks.some((y) => y.dateAttendance[d]));

  // Apply the attending-sabha filter for all stats / charts / tables
  const filteredYuvaks = allCNYuvaks.filter((y) =>
    attendingFilter === 'all' ? true : attendingFilter === 'yes' ? y.attendingSabha : !y.attendingSabha
  );

  const stats = getSabhaStats(filteredYuvaks, activePastDates, sabhaType);
  const kkStats = getKKStats(filteredYuvaks, activePastDates);
  const areaData = getAreaBreakdown(filteredYuvaks, activePastDates);

  // Use the same getAttendanceStatus logic that the table/badges use — keeps all counts consistent
  const activeCount   = stats.greenCount;
  const atRiskCount   = stats.yellowCount;
  // const inactiveCount = stats.redCount;

  // last6 still needed for followUpYuvaks (missed ALL last 6 = red)
  // const last6 = activePastDates.slice(-6);

  // Last active sabha for this group
  const lastDate = activePastDates[activePastDates.length - 1];
  const lastSabhaCount = lastDate ? filteredYuvaks.filter((y) => y.dateAttendance[lastDate]).length : 0;
  const totalCount = filteredYuvaks.length;
  const lastSabhaPct = totalCount > 0 ? Math.round((lastSabhaCount / totalCount) * 100) : 0;

  // Last 20 active sessions for chart
  const last20Trend = stats.sessionTrend.slice(-20);

  // Exclude 0-attendance sessions (un-tracked historical dates) from lowest/highest
  const trackedTrend = stats.sessionTrend.filter((s) => s.count > 0);
  const lowest  = getLowestSessions(trackedTrend, 5);
  const highest = getHighestSessions(trackedTrend, 3);

  // Follow-up list (inactive based on active past dates)
  // const followUpYuvaks = filteredYuvaks
  //   .filter((y) => last6.filter((d) => y.dateAttendance[d]).length === 0)
  //   .sort((a, b) => a.name.localeCompare(b.name));

  // Donut chart
  const donutData = {
    labels: ['Active', 'At Risk' /*, 'Inactive' */],
    datasets: [{
      data: [activeCount, atRiskCount /*, inactiveCount */],
      backgroundColor: ['rgba(34,197,94,0.85)', 'rgba(234,179,8,0.85)' /*, 'rgba(239,68,68,0.85)' */],
      borderColor: ['rgb(34,197,94)', 'rgb(234,179,8)' /*, 'rgb(239,68,68)' */],
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        callbacks: {
          label: (ctx: { parsed: number }) => {
            const pct = totalCount > 0 ? ((ctx.parsed / totalCount) * 100).toFixed(0) : '0';
            return ` ${ctx.parsed} yuvaks (${pct}%)`;
          },
        },
      },
    },
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yuvaks', label: 'All Yuvaks' },
    { id: 'kk', label: 'KK Workload' },
    // { id: 'followup', label: 'Follow-Up' },
  ];

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="space-y-3">
        {/* Row 1: title + actions */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-1 self-stretch rounded-full bg-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-blue-400">Chirag Nagar Sabha</h1>
              <p className="text-slate-500 text-sm mt-0.5">Std 13 &amp; Above · Chirag Nagar</p>
            </div>
          </div>
          {/* Actions — always a single line */}
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-medium">
              {/* 'no' and 'all' temporarily commented out */}
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
                  ? Attending
                </button>
              ))}
            </div>
            <button onClick={refresh} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors whitespace-nowrap">
              ↻ Refresh
            </button>
          </div>
        </div>
        {/* Row 2: legend — always on its own clean line */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs pl-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-green-400 font-semibold">Active</span>&nbsp;= attended within last 3
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
            <span className="text-yellow-400 font-semibold">At Risk</span>&nbsp;= absent last 3, attended within 6
          </span>
          {/* <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-red-400 font-semibold">Inactive</span>&nbsp;= missed all last 6
          </span> */}
        </div>
        <div className="pl-4">
          <SabhaMetaPanel {...sabhaMeta[sabhaType]} compact={true} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
            {/* {tab.id === 'followup' && inactiveCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full">{inactiveCount}</span>
            )} */}
          </button>
        ))}
      </div>

        {/* Overview */}
      {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatsCard title="Total Yuvaks" value={totalCount} subtitle="in this sabha" accent="blue" />
              <StatsCard title="Active" value={activeCount} subtitle="attended within last 3" accent="green" />
              <StatsCard title="At Risk" value={atRiskCount} subtitle="absent last 3, attended within 6" accent="yellow" />
              {/* <StatsCard title="Inactive" value={inactiveCount} subtitle="missed all last 6" accent="red" /> */}
              <StatsCard title="Last Sabha ✅" value={`${lastSabhaCount}/${totalCount}`} subtitle={lastDate ? `${lastDate} · ${lastSabhaPct}% showed up` : '—'} accent="orange" />
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
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'Active', count: activeCount, color: 'bg-green-500', text: 'text-green-400' },
                    { label: 'At Risk', count: atRiskCount, color: 'bg-yellow-400', text: 'text-yellow-400' },
                    // { label: 'Inactive', count: inactiveCount, color: 'bg-red-500', text: 'text-red-400' },
                  ].map(({ label, count, color, text }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                        <span className="text-slate-300">{label}</span>
                      </div>
                      <span className={text}>{count} ({totalCount > 0 ? Math.round((count / totalCount) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <AttendanceTrendChart sessionTrend={last20Trend} sabhaLabel="Chirag Nagar" totalYuvaks={stats.totalYuvaks} />
              </div>
            </div>

            <AreaBreakdownChart areaData={areaData} title="Area-wise Breakdown (CN)" />

            {/* Lowest / Best sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="text-slate-100 font-semibold mb-1">Lowest Sessions</h3>
                <p className="text-slate-500 text-xs mb-3">Check for exams, festivals, or other conflicts</p>
                <div className="space-y-2">
                  {lowest.map((s) => (
                    <div key={s.date} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{s.date}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-700 h-1.5 rounded-full">
                          <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${s.percentage}%` }} />
                        </div>
                        <span className="text-yellow-400 w-16 text-right">{s.count} ({s.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="text-slate-100 font-semibold mb-1">Best Sessions</h3>
                <p className="text-slate-500 text-xs mb-3">Highest attendance sessions</p>
                <div className="space-y-2">
                  {highest.map((s) => (
                    <div key={s.date} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{s.date}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-700 h-1.5 rounded-full">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.percentage}%` }} />
                        </div>
                        <span className="text-green-400 w-16 text-right">{s.count} ({s.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Real-time action suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Urgent
              <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🚨</span>
                  <h4 className="text-red-400 font-bold text-sm">Urgent Follow-Up Needed</h4>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  <span className="text-red-300 font-semibold">{inactiveCount} yuvaks</span> have not attended
                  any of the last 6 sabhas. KKs must call them personally before next Sabha.
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Action deadline</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Before next sabha</span>
                </div>
                <button
                  onClick={() => setActiveTab('followup')}
                  className="mt-3 w-full py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold transition-colors"
                >
                  View {inactiveCount} yuvaks →
                </button>
              </div> */}

              {/* At Risk */}
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚠️</span>
                  <h4 className="text-yellow-400 font-bold text-sm">At Risk — Recoverable</h4>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  <span className="text-yellow-300 font-semibold">{atRiskCount} yuvaks</span> attended only 1–2 of
                  the last 6 sabhas. A single follow-up call is often enough to bring them back.
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Recovery chance</span>
                  <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">High</span>
                </div>
                <button
                  onClick={() => setActiveTab('yuvaks')}
                  className="mt-3 w-full py-2 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 text-xs font-semibold transition-colors"
                >
                  View {atRiskCount} yuvaks →
                </button>
              </div>

              {/* Active */}
              <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">✅</span>
                  <h4 className="text-green-400 font-bold text-sm">Attending Regularly</h4>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  <span className="text-green-300 font-semibold">{activeCount} yuvaks</span> are coming
                  consistently. Keep them engaged with quality topics and personal connection.
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Retention rate</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                    {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}%
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('yuvaks')}
                  className="mt-3 w-full py-2 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs font-semibold transition-colors"
                >
                  View {activeCount} yuvaks →
                </button>
              </div>
            </div>
          </div>
        )}

      {/* All Yuvaks */}
      {activeTab === 'yuvaks' && (
        <YuvakTable yuvaks={filteredYuvaks} dates={activePastDates} showSabhaType={false} />
      )}

      {/* KK Workload */}
      {activeTab === 'kk' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Workload — Chirag Nagar Sabha</h3>
          <p className="text-slate-500 text-xs mb-5">Active / At Risk based on last 6 sabhas</p>
          <KKWorkloadChart kkStats={kkStats} dates={activePastDates} />
        </div>
      )}

      {/* Follow-Up section commented out */}
    </div>
  );
}



