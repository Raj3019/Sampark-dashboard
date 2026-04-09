'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { getSabhaStats, getKKStats, getPastDates, getLowestSessions, getHighestSessions } from '@/lib/analytics';
import StatsCard from '@/components/StatsCard';
import YuvakTable from '@/components/YuvakTable';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';

type TabType = 'overview' | 'yuvaks' | 'kk';
type RecentSabhaSummary = {
  date: string;
  vakta: string;
  attendanceCount: number;
  attendancePct: number;
};

type RiskFollowUpItem = {
  name: string;
  followUpKK: string;
};

function parseSabhaDate(value: string): Date {
  const normalized = value.replace(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`);
  return new Date(normalized);
}

function formatAttendanceCardDate(dateString: string) {
  const parsed = parseSabhaDate(dateString);
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

function AttendanceSabhaCard({
  title,
  subtitle,
  sessions,
  sabhaType,
  sabhaSessionMeta,
  barClassName,
  valueClassName,
}: {
  title: string;
  subtitle: string;
  sessions: Array<{ date: string; count: number; percentage: number }>;
  sabhaType: string;
  sabhaSessionMeta: Record<string, Record<string, { vakta: string; topic: string }>> | undefined;
  barClassName: string;
  valueClassName: string;
}) {
  return (
    <div className="h-full rounded-xl border border-slate-700 bg-slate-800 p-4">
      <h3 className="mb-1 text-base font-semibold tracking-tight text-slate-100">{title}</h3>
      <p className="mb-4 text-xs text-slate-400">{subtitle}</p>
      <div className="space-y-4">
        {sessions.map((s) => {
          const dateParts = formatAttendanceCardDate(s.date);
          const vakta = sabhaSessionMeta?.[sabhaType]?.[s.date]?.vakta?.trim() || '';
          const topic = sabhaSessionMeta?.[sabhaType]?.[s.date]?.topic?.trim() || '';
          const rowTitle = topic || 'Vakta/Topic not available';
          const rowSubtitle = vakta ? `${vakta} • Yuva` : 'Vakta not available • Yuva';

          return (
            <div key={s.date} className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[18px] border border-slate-600/35 bg-slate-700/75">
                <span className="text-[10px] font-semibold tracking-[0.16em] text-slate-400">{dateParts.month}</span>
                <span className="mt-0.5 text-[0.95rem] font-semibold leading-none text-slate-100">{dateParts.day}</span>
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-semibold leading-snug text-slate-100">{rowTitle}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{rowSubtitle}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                    <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                  </div>
                  <span className={`w-10 text-right text-sm font-medium ${valueClassName}`}>{s.percentage}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChiragNagarPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isRiskSectionCollapsed, setIsRiskSectionCollapsed] = useState(true);

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

  const { yuvaks, dates, sabhaSessionMeta } = data;

  // Only consider dates that have already occurred (≤ today)
  const pastDates = getPastDates(dates);

  const sabhaType = 'Chirag Nagar' as const;
  const allCNYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);

  // Dates where any CN yuvak attended — always based on all CN, unaffected by attending filter
  const activePastDates = pastDates.filter((d) => allCNYuvaks.some((y) => y.dateAttendance[d]));

  // Apply attending-only filter, but fail safe to all rows if source flag is missing.
  const attendingYuvaks = allCNYuvaks.filter((y) => y.attendingSabha);
  const filteredYuvaks = attendingYuvaks.length > 0 ? attendingYuvaks : allCNYuvaks;

  const stats = getSabhaStats(filteredYuvaks, activePastDates, sabhaType);
  const kkStats = getKKStats(filteredYuvaks, activePastDates);

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
  const recentDates = activePastDates.slice(-2).reverse();
  const recentSabhaSummaries: RecentSabhaSummary[] = recentDates.map((date) => {
    const attendanceCount = filteredYuvaks.filter((y) => y.dateAttendance[date]).length;
    const attendancePct = totalCount > 0 ? Math.round((attendanceCount / totalCount) * 100) : 0;
    const vakta = sabhaSessionMeta?.[sabhaType]?.[date]?.vakta?.trim() || 'Not added yet';

    return {
      date,
      vakta,
      attendanceCount,
      attendancePct,
    };
  });

  const last1Dates = activePastDates.slice(-1);
  const last2Dates = activePastDates.slice(-2);
  const last4Dates = activePastDates.slice(-4);

  const riskBuckets = filteredYuvaks.reduce<{
    lowRisk: RiskFollowUpItem[];
    moderateRisk: RiskFollowUpItem[];
    atRisk: RiskFollowUpItem[];
  }>((acc, yuvak) => {
    const item = {
      name: yuvak.name,
      followUpKK: yuvak.followUpKK?.trim() || 'Not assigned',
    };
    const missedLast1 = last1Dates.length === 1 && last1Dates.every((date) => !yuvak.dateAttendance[date]);
    const missedLast2 = last2Dates.length === 2 && last2Dates.every((date) => !yuvak.dateAttendance[date]);
    const missedLast4 = last4Dates.length === 4 && last4Dates.every((date) => !yuvak.dateAttendance[date]);

    if (missedLast4) {
      acc.atRisk.push(item);
    } else if (missedLast2) {
      acc.moderateRisk.push(item);
    } else if (missedLast1) {
      acc.lowRisk.push(item);
    }

    return acc;
  }, {
    lowRisk: [],
    moderateRisk: [],
    atRisk: [],
  });
  // Last 20 active sessions for chart
  const last20Trend = stats.sessionTrend.slice(-20);

  // Exclude 0-attendance sessions (un-tracked historical dates) from lowest/highest
  const trackedTrend = stats.sessionTrend.filter((s) => s.count > 0);
  const lowest  = getLowestSessions(trackedTrend, 5);
  const highest = getHighestSessions(trackedTrend, 5);

  // Follow-up list (inactive based on active past dates)
  // const followUpYuvaks = filteredYuvaks
  //   .filter((y) => last6.filter((d) => y.dateAttendance[d]).length === 0)
  //   .sort((a, b) => a.name.localeCompare(b.name));

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
            <button onClick={refresh} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors whitespace-nowrap">
              ↻ Refresh
            </button>
          </div>
        </div>
        {/* Row 2: legend — always on its own clean line */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs pl-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-green-400 font-semibold">Low Risk</span>&nbsp;= missed last 1 sabha
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
            <span className="text-yellow-400 font-semibold">Moderate Risk</span>&nbsp;= missed last 2 sabhas
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-red-400 font-semibold">High Risk</span>&nbsp;= missed last 4 sabhas
          </span>
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {recentSabhaSummaries.length > 0 ? recentSabhaSummaries.map((session, index) => (
                <div key={session.date} className="rounded-xl border border-sky-500/20 bg-slate-800 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.12em]">
                        {index === 0 ? 'Most Recent Sabha' : '2nd Most Recent Sabha'}
                      </p>
                      <h3 className="text-slate-100 font-semibold mt-1">{session.date}</h3>
                    </div>
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300">
                      {session.attendanceCount}/{totalCount}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-500 text-[11px] uppercase tracking-wide">Attendance</p>
                      <p className="mt-1 text-slate-100 font-semibold">{session.attendancePct}%</p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-500 text-[11px] uppercase tracking-wide">Vakta</p>
                      <p className="mt-1 text-slate-100 font-medium leading-snug">{session.vakta}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="xl:col-span-2 rounded-xl border border-slate-700 bg-slate-800 p-5">
                  <p className="text-slate-100 font-semibold">Recent Sabha Summary</p>
                  <p className="mt-2 text-sm text-slate-400">No recent sabha attendance data is available yet.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatsCard title="Total Yuvaks" value={totalCount} subtitle="in this sabha" accent="blue" />
              <StatsCard title="Active" value={activeCount} subtitle="last 4 sabha yes (sheet)" accent="green" />
              <StatsCard title="At Risk" value={atRiskCount} subtitle="last 4 sabha no (sheet)" accent="yellow" />
              {/* <StatsCard title="Inactive" value={inactiveCount} subtitle="missed all last 6" accent="red" /> */}
              <StatsCard title="Last Sabha ✅" value={`${lastSabhaCount}/${totalCount}`} subtitle={lastDate ? `${lastDate} · ${lastSabhaPct}% showed up` : '—'} accent="orange" />
            </div>

            <div>
              <AttendanceTrendChart
                sessionTrend={last20Trend}
                sabhaLabel="Chirag Nagar"
                totalYuvaks={stats.totalYuvaks}
              />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsRiskSectionCollapsed((prev) => !prev)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-left transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 text-slate-300">
                    {isRiskSectionCollapsed ? '+' : '-'}
                  </span>
                  <div>
                    <h3 className="text-slate-100 font-semibold">Follow-Up Risk Buckets</h3>
                    <p className="text-slate-400 text-xs mt-1">Grouped by consecutive missed sabhas. Each yuvak appears in only one bucket.</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-300">
                  {isRiskSectionCollapsed ? 'Show list' : 'Hide list'}
                </span>
                <span className="hidden">
                  {isRiskSectionCollapsed ? '▼' : '▲'}
                </span>
              </button>
              {!isRiskSectionCollapsed && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {[
                  {
                    key: 'lowRisk',
                    title: 'Low Risk',
                    subtitle: 'Missed the last 1 sabha',
                    items: riskBuckets.lowRisk,
                    border: 'border-blue-500/30',
                    badge: 'bg-blue-500/15 text-blue-300',
                    titleColor: 'text-blue-300',
                  },
                  {
                    key: 'moderateRisk',
                    title: 'Moderate Risk',
                    subtitle: 'Missed the last 2 sabhas',
                    items: riskBuckets.moderateRisk,
                    border: 'border-yellow-500/30',
                    badge: 'bg-yellow-500/15 text-yellow-300',
                    titleColor: 'text-yellow-300',
                  },
                  {
                    key: 'atRisk',
                    title: 'High Risk',
                    subtitle: 'Missed the last 4 sabhas',
                    items: riskBuckets.atRisk,
                    border: 'border-red-500/30',
                    badge: 'bg-red-500/15 text-red-300',
                    titleColor: 'text-red-300',
                  },
                ].map((bucket) => (
                  <div key={bucket.key} className={`rounded-xl border ${bucket.border} bg-slate-800 p-5`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className={`font-semibold ${bucket.titleColor}`}>{bucket.title}</h4>
                        <p className="text-slate-500 text-xs mt-1">{bucket.subtitle}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${bucket.badge}`}>
                        {bucket.items.length}
                      </span>
                    </div>

                    {bucket.items.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {bucket.items.map((item) => (
                          <div key={`${bucket.key}-${item.name}`} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2.5">
                            <p className="text-sm font-medium text-slate-100">{item.name}</p>
                            <p className="text-xs text-slate-400 mt-1">Follow-up: {item.followUpKK}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-3 py-4 text-sm text-slate-500">
                        No yuvaks in this bucket
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>

            {/* Lowest / Best sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:order-2">
                <AttendanceSabhaCard
                  title="Lowest Attendance Sabhas"
                  subtitle="From last 52 sabhas"
                  sessions={lowest}
                  sabhaType={sabhaType}
                  sabhaSessionMeta={sabhaSessionMeta}
                  barClassName="bg-yellow-500"
                  valueClassName="text-yellow-400"
                />
              </div>
              <div className="lg:order-1">
                <AttendanceSabhaCard
                  title="Highest Attendance Sabhas"
                  subtitle="From last 52 sabhas"
                  sessions={highest}
                  sabhaType={sabhaType}
                  sabhaSessionMeta={sabhaSessionMeta}
                  barClassName="bg-green-500"
                  valueClassName="text-green-400"
                />
              </div>
            </div>

            <div className="hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 lg:order-2">
                <h3 className="text-slate-100 font-semibold mb-1">Lowest Sessions</h3>
                <p className="text-slate-500 text-xs mb-3">Check for exams, festivals, or other conflicts</p>
                <div className="space-y-3">
                  {lowest.map((s) => (
                    <div key={s.date} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-slate-300">{s.date}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Vakta: {sabhaSessionMeta?.[sabhaType]?.[s.date]?.vakta?.trim() || 'Not added'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Topic: {sabhaSessionMeta?.[sabhaType]?.[s.date]?.topic?.trim() || 'Not added'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="w-20 bg-slate-700 h-1.5 rounded-full shrink-0">
                          <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                        </div>
                        <span className="text-yellow-400 w-16 text-right shrink-0">{s.count} ({s.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 lg:order-1">
                <h3 className="text-slate-100 font-semibold mb-1">Best Sessions</h3>
                <p className="text-slate-500 text-xs mb-3">Highest attendance sessions</p>
                <div className="space-y-3">
                  {highest.map((s) => (
                    <div key={s.date} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-slate-300">{s.date}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Vakta: {sabhaSessionMeta?.[sabhaType]?.[s.date]?.vakta?.trim() || 'Not added'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Topic: {sabhaSessionMeta?.[sabhaType]?.[s.date]?.topic?.trim() || 'Not added'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <div className="w-20 bg-slate-700 h-1.5 rounded-full shrink-0">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                        </div>
                        <span className="text-green-400 w-16 text-right shrink-0">{s.count} ({s.percentage}%)</span>
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
                  <span className="text-yellow-300 font-semibold">{atRiskCount} yuvaks</span> are marked as not super active
                  in the sheet (last 4 sabha no). A single follow-up call is often enough to bring them back.
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
          <p className="text-slate-500 text-xs mb-5">Active / At Risk based on sheet (last 4 sabha)</p>
          <KKWorkloadChart kkStats={kkStats} dates={activePastDates} />
        </div>
      )}

      {/* Follow-Up section commented out */}
    </div>
  );
}



