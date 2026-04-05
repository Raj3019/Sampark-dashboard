'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { getSabhaStats, getKKStats, getLowestSessions, getHighestSessions, predictNextAttendance, getPastDates } from '@/lib/analytics';
import StatsCard from '@/components/StatsCard';
import YuvakTable from '@/components/YuvakTable';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';
import VaktaTopicTrendChart from '@/components/charts/VaktaTopicTrendChart';

type TabType = 'overview' | 'yuvaks' | 'kk-performance' | 'kk';
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

export default function KishorSabhaPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('yes');
  const [isRiskSectionCollapsed, setIsRiskSectionCollapsed] = useState(true);
  const [kkSortKey, setKkSortKey] = useState<'name' | 'total' | 'active' | 'deactive' | 'deactivePct' | 'avgAttendance' | 'efficiencyScore'>('deactivePct');
  const [kkSortAsc, setKkSortAsc] = useState(false);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
  const pastDates = getPastDates(dates);

  const sabhaType = 'Chirag Nagar(Kishor)' as const;
  const allKishorYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
  const activePastDates = pastDates.filter((d) => allKishorYuvaks.some((y) => y.dateAttendance[d]));

  const kishorYuvaks = allKishorYuvaks.filter((y) =>
    attendingFilter === 'all' ? true : attendingFilter === 'yes' ? y.attendingSabha : !y.attendingSabha
  );

  const stats    = getSabhaStats(kishorYuvaks, activePastDates, sabhaType);
  const kkStats  = getKKStats(kishorYuvaks, activePastDates);
  const kkPerformance = kkStats
    .map((kk) => {
      const active = kk.yuvaks.filter((y) => y.superActive).length;
      const deactive = kk.yuvaks.length - active;
      const deactivePct = kk.yuvaks.length > 0 ? Math.round((deactive / kk.yuvaks.length) * 100) : 0;
      const activePct = kk.yuvaks.length > 0 ? Math.round((active / kk.yuvaks.length) * 100) : 0;
      const efficiencyScore = Math.round((activePct * 0.7) + (kk.avgAttendance * 0.3));

      return {
        name: kk.name,
        total: kk.yuvaks.length,
        active,
        deactive,
        deactivePct,
        avgAttendance: kk.avgAttendance,
        efficiencyScore,
      };
    });

  const kkPerformanceSorted = [...kkPerformance].sort((a, b) => {
    let cmp = 0;
    switch (kkSortKey) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'total':
        cmp = a.total - b.total;
        break;
      case 'active':
        cmp = a.active - b.active;
        break;
      case 'deactive':
        cmp = a.deactive - b.deactive;
        break;
      case 'avgAttendance':
        cmp = a.avgAttendance - b.avgAttendance;
        break;
      case 'efficiencyScore':
        cmp = a.efficiencyScore - b.efficiencyScore;
        break;
      case 'deactivePct':
      default:
        cmp = a.deactivePct - b.deactivePct || b.avgAttendance - a.avgAttendance;
        break;
    }
    return kkSortAsc ? cmp : -cmp;
  });

  const handleKkSort = (key: 'name' | 'total' | 'active' | 'deactive' | 'deactivePct' | 'avgAttendance' | 'efficiencyScore') => {
    if (kkSortKey === key) {
      setKkSortAsc((prev) => !prev);
      return;
    }
    setKkSortKey(key);
    setKkSortAsc(key === 'name');
  };

  const KkArrow = ({ k }: { k: 'name' | 'total' | 'active' | 'deactive' | 'deactivePct' | 'avgAttendance' | 'efficiencyScore' }) =>
    kkSortKey === k
      ? <span className="text-orange-400">{kkSortAsc ? ' ↑' : ' ↓'}</span>
      : <span className="text-slate-600"> ↕</span>;

  const kkByEfficiency = [...kkPerformance].sort((a, b) => b.efficiencyScore - a.efficiencyScore || a.name.localeCompare(b.name));

  // Use the same getAttendanceStatus logic that the table/badges use — keeps all counts consistent
  const activeCount   = stats.greenCount;
  const atRiskCount   = stats.yellowCount;
  // const inactiveCount = stats.redCount;

  // const last6 = activePastDates.slice(-6);

  const lastDate       = activePastDates[activePastDates.length - 1];
  const lastSabhaCount = lastDate ? kishorYuvaks.filter((y) => y.dateAttendance[lastDate]).length : 0;
  const totalCount     = kishorYuvaks.length;
  const lastSabhaPct   = totalCount > 0 ? Math.round((lastSabhaCount / totalCount) * 100) : 0;
  const recentDates = activePastDates.slice(-2).reverse();
  const recentSabhaSummaries: RecentSabhaSummary[] = recentDates.map((date) => {
    const attendanceCount = kishorYuvaks.filter((y) => y.dateAttendance[date]).length;
    const attendancePct = totalCount > 0 ? Math.round((attendanceCount / totalCount) * 100) : 0;
    const vakta = sabhaSessionMeta?.[sabhaType]?.[date]?.vakta?.trim() || 'Not added yet';

    return {
      date,
      vakta,
      attendanceCount,
      attendancePct,
    };
  });

  const last20Trend  = stats.sessionTrend.slice(-20);
  const trackedTrend = stats.sessionTrend.filter((s) => s.count > 0);
  const lowest       = getLowestSessions(trackedTrend, 5);
  const highest      = getHighestSessions(trackedTrend, 3);
  const predicted    = predictNextAttendance(stats.sessionTrend);

  const threeMonthCutoff = new Date();
  threeMonthCutoff.setMonth(threeMonthCutoff.getMonth() - 3);

  const vaktaTopicTrend3m = activePastDates
    .filter((date) => parseSabhaDate(date) >= threeMonthCutoff)
    .map((date) => {
      const attendanceCount = kishorYuvaks.filter((y) => y.dateAttendance[date]).length;
      const attendancePct = totalCount > 0 ? Math.round((attendanceCount / totalCount) * 100) : 0;
      const meta = sabhaSessionMeta?.[sabhaType]?.[date];

      return {
        date,
        vakta: meta?.vakta?.trim() || 'Not added yet',
        topic: meta?.topic?.trim() || 'Not added yet',
        attendanceCount,
        attendancePct,
      };
    })
    .filter((row) => row.attendanceCount > 0);

  const last1Dates = activePastDates.slice(-1);
  const last2Dates = activePastDates.slice(-2);
  const last4Dates = activePastDates.slice(-4);

  const riskBuckets = kishorYuvaks.reduce<{
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
  // const followUpYuvaks = kishorYuvaks
  //   .filter((y) => last6.filter((d) => y.dateAttendance[d]).length === 0)
  //   .sort((a, b) => a.name.localeCompare(b.name));

  const stdMap = new Map<string, number>();
  kishorYuvaks.forEach((y) => { stdMap.set(y.std, (stdMap.get(y.std) ?? 0) + 1); });
  const stdBreakdown = Array.from(stdMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yuvaks',   label: 'All Yuvaks' },
    { id: 'kk-performance', label: 'KK Performance' },
    { id: 'kk',       label: 'KK Workload' },
    // { id: 'followup', label: 'Follow-Up' },
  ];

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="space-y-3">
        {/* Row 1: title + actions */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-1 self-stretch rounded-full bg-purple-500" />
            <div>
              <h1 className="text-2xl font-bold text-purple-400">AYC Sabha</h1>
              <p className="text-slate-500 text-sm mt-0.5">STD 9 to 12 · Chirag Nagar</p>
            </div>
          </div>
          {/* Actions — always a single line */}
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            <span className="inline-flex items-center gap-1.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">
              {predicted}% expected next sabha
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-purple-400/60 text-[10px] font-bold text-purple-300 cursor-help"
                aria-label="Prediction info"
                title="Calculates based on last 4 sessions."
              >
                i
              </span>
            </span>
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
                  ✓ Attending
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
                ? 'border-purple-500 text-purple-400'
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
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setIsRiskSectionCollapsed((prev) => !prev)}
              className="flex w-full flex-col items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-left transition-colors hover:border-slate-600 hover:bg-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
              <span className="shrink-0 rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-300 sm:self-auto">
                {isRiskSectionCollapsed ? 'Show list' : 'Hide list'}
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
            <StatsCard title="Total Yuvaks" value={totalCount} subtitle="in AYC sabha" accent="blue" />
            <StatsCard title="Active" value={activeCount} subtitle="last 4 sabha yes (sheet)" accent="green" />
            <StatsCard title="At Risk" value={atRiskCount} subtitle="last 4 sabha no (sheet)" accent="yellow" />
            {/* <StatsCard title="Inactive" value={inactiveCount} subtitle="missed all last 6" accent="red" /> */}
            <StatsCard title="Last Sabha ✅" value={`${lastSabhaCount}/${totalCount}`} subtitle={lastDate ? `${lastDate} · ${lastSabhaPct}%` : '—'} accent="orange" />
          </div>

          {/* STD breakdown chips */}
          {stdBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-slate-500 text-sm">By STD:</span>
              {stdBreakdown.map(([std, count]) => (
                <span key={std} className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                  STD {std}: {count} yuvaks
                </span>
              ))}
            </div>
          )}

          <div>
            <AttendanceTrendChart
              sessionTrend={last20Trend}
              sabhaLabel="AYC Sabha"
              totalYuvaks={stats.totalYuvaks}
              sessionMetaByDate={sabhaSessionMeta?.[sabhaType]}
            />
          </div>

          <VaktaTopicTrendChart
            points={vaktaTopicTrend3m}
            totalYuvaks={totalCount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          {/* Topic planning tip */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex gap-3">
            <span className="text-purple-400 text-xl">💡</span>
            <div>
              <p className="text-purple-300 font-medium text-sm">Topic Planning Tip for AYC Sabha</p>
              <p className="text-slate-400 text-xs mt-1">
                Kishor yuvaks (STD 9–12) respond better to topics on identity, peer challenges, and practical life values.
                Sessions around exams (Nov–Mar) may see lower attendance — plan lighter or motivational topics for those dates.
                {totalCount > 0 && ` Current average attendance: ${stats.avgAttendance}%.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All Yuvaks */}
      {activeTab === 'yuvaks' && (
        <YuvakTable yuvaks={kishorYuvaks} dates={activePastDates} showSabhaType={false} />
      )}

      {/* KK Workload */}
      {activeTab === 'kk-performance' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Performance Ranking</h3>
          <p className="text-slate-500 text-xs mb-4">Click any column header to sort. Click again to reverse order.</p>

          {kkPerformanceSorted.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-500">
              No KK data available for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 border-b border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">Rank</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('name')}>KK Name<KkArrow k="name" /></th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('total')}>Total<KkArrow k="total" /></th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('active')}>Active<KkArrow k="active" /></th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('deactive')}>Deactive<KkArrow k="deactive" /></th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('deactivePct')}>Deactive %<KkArrow k="deactivePct" /></th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('avgAttendance')}>Avg Attendance<KkArrow k="avgAttendance" /></th>
                    <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide cursor-pointer hover:text-slate-200" onClick={() => handleKkSort('efficiencyScore')}>Efficiency<KkArrow k="efficiencyScore" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {kkPerformanceSorted.map((kk, index) => (
                    <tr key={kk.name} className="hover:bg-slate-900/40">
                      <td className="px-4 py-3 text-slate-300 font-semibold">#{index + 1}</td>
                      <td className="px-4 py-3 text-slate-100 font-medium">{kk.name}</td>
                      <td className="px-4 py-3 text-slate-300">{kk.total}</td>
                      <td className="px-4 py-3 text-green-400">{kk.active}</td>
                      <td className="px-4 py-3 text-red-400">{kk.deactive}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          kk.deactivePct >= 60
                            ? 'bg-red-500/15 text-red-300'
                            : kk.deactivePct >= 35
                              ? 'bg-yellow-500/15 text-yellow-300'
                              : 'bg-green-500/15 text-green-300'
                        }`}>
                          {kk.deactivePct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sky-300">{kk.avgAttendance}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          kk.efficiencyScore >= 70
                            ? 'bg-green-500/15 text-green-300'
                            : kk.efficiencyScore >= 45
                              ? 'bg-yellow-500/15 text-yellow-300'
                              : 'bg-red-500/15 text-red-300'
                        }`}>
                          {kk.efficiencyScore}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5">
            <h4 className="text-slate-100 text-sm font-semibold mb-1">Per KK Efficiency Overview</h4>
            <p className="text-slate-500 text-xs mb-3">Efficiency score = 70% active rate + 30% average attendance.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {kkByEfficiency.map((kk) => (
                <div key={`eff-${kk.name}`} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-100 font-medium text-sm leading-tight">{kk.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      kk.efficiencyScore >= 70
                        ? 'bg-green-500/15 text-green-300'
                        : kk.efficiencyScore >= 45
                          ? 'bg-yellow-500/15 text-yellow-300'
                          : 'bg-red-500/15 text-red-300'
                    }`}>
                      {kk.efficiencyScore}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        kk.efficiencyScore >= 70
                          ? 'bg-green-500'
                          : kk.efficiencyScore >= 45
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, kk.efficiencyScore))}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Active</p>
                      <p className="text-green-400 font-semibold">{kk.active}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Deactive</p>
                      <p className="text-red-400 font-semibold">{kk.deactive}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Attendance</p>
                      <p className="text-sky-300 font-semibold">{kk.avgAttendance}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KK Workload */}
      {activeTab === 'kk' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Workload — Kishor Sabha</h3>
          <p className="text-slate-500 text-xs mb-5">Active / At Risk based on sheet (last 4 sabha)</p>
          <KKWorkloadChart kkStats={kkStats} dates={activePastDates} />
        </div>
      )}

      {/* Follow-Up section commented out */}
    </div>
  );
}


