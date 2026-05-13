'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { getHighestSessions, getKKStats, getLowestSessions, getPastDates, getSabhaStats, predictNextAttendance } from '@/lib/analytics';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';
import StatsCard from '@/components/StatsCard';
import YuvakTable from '@/components/YuvakTable';
import ContactActions from '@/components/ContactActions';

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
  phoneNumber: string;
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
          const rowSubtitle = vakta ? `${vakta} • Bal` : 'Vakta not available • Bal';

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

export default function BalSabhaPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('yes');
  const [isRiskSectionCollapsed, setIsRiskSectionCollapsed] = useState(true);

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

  const { yuvaks, dates, sabhaSessionMeta } = data;
  const pastDates = getPastDates(dates);
  const sabhaType = 'Bal Sabha' as const;
  const allBalYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
  const activePastDates = pastDates.filter((d) => allBalYuvaks.some((y) => y.dateAttendance[d]));

  const filteredBalYuvaks = allBalYuvaks.filter((y) =>
    attendingFilter === 'all' ? true : attendingFilter === 'yes' ? y.attendingSabha : !y.attendingSabha
  );
  const balYuvaks = attendingFilter === 'yes' && filteredBalYuvaks.length === 0
    ? allBalYuvaks
    : filteredBalYuvaks;

  const stats = getSabhaStats(balYuvaks, activePastDates, sabhaType);
  const kkStats = getKKStats(balYuvaks, activePastDates);
  const activeCount = stats.greenCount;
  const atRiskCount = stats.yellowCount;
  const lastDate = activePastDates[activePastDates.length - 1];
  const lastSabhaCount = lastDate ? balYuvaks.filter((y) => y.dateAttendance[lastDate]).length : 0;
  const totalCount = balYuvaks.length;
  const lastSabhaPct = totalCount > 0 ? Math.round((lastSabhaCount / totalCount) * 100) : 0;
  const recentDates = activePastDates.slice(-2).reverse();
  const recentSabhaSummaries: RecentSabhaSummary[] = recentDates.map((date) => {
    const attendanceCount = balYuvaks.filter((y) => y.dateAttendance[date]).length;
    const attendancePct = totalCount > 0 ? Math.round((attendanceCount / totalCount) * 100) : 0;
    const vakta = sabhaSessionMeta?.[sabhaType]?.[date]?.vakta?.trim() || 'Not added yet';

    return {
      date,
      vakta,
      attendanceCount,
      attendancePct,
    };
  });
  const predicted = predictNextAttendance(stats.sessionTrend);
  const trackedTrend = stats.sessionTrend.filter((s) => s.count > 0);
  const lowest = getLowestSessions(trackedTrend, 5);
  const highest = getHighestSessions(trackedTrend, 5);

  const last1Dates = activePastDates.slice(-1);
  const last2Dates = activePastDates.slice(-2);
  const last4Dates = activePastDates.slice(-4);

  const riskBuckets = balYuvaks.reduce<{
    lowRisk: RiskFollowUpItem[];
    moderateRisk: RiskFollowUpItem[];
    atRisk: RiskFollowUpItem[];
  }>((acc, yuvak) => {
    const item = {
      name: yuvak.name,
      followUpKK: yuvak.followUpKK?.trim() || 'Not assigned',
      phoneNumber: yuvak.phoneNumber,
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
            <StatsCard title="Total Yuvaks" value={totalCount} subtitle="in Bal sabha" accent="orange" />
            <StatsCard title="Active" value={activeCount} subtitle="last 4 sabha yes (sheet)" accent="green" />
            <StatsCard title="At Risk" value={atRiskCount} subtitle="last 4 sabha no (sheet)" accent="yellow" />
            <StatsCard title="Last Sabha ✅" value={`${lastSabhaCount}/${totalCount}`} subtitle={lastDate ? `${lastDate} · ${lastSabhaPct}%` : '—'} accent="blue" />
          </div>

          <div>
            <AttendanceTrendChart sessionTrend={stats.sessionTrend.slice(-20)} sabhaLabel="Bal Sabha" totalYuvaks={stats.totalYuvaks} />
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-100">{item.name}</p>
                            <ContactActions name={item.name} phoneNumber={item.phoneNumber} size="xs" />
                          </div>
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
        </div>
      )}

      {activeTab === 'yuvaks' && (
        <YuvakTable yuvaks={balYuvaks} dates={activePastDates} showSabhaType={false} />
      )}

      {activeTab === 'kk' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Workload — Bal Sabha</h3>
          <p className="text-slate-500 text-xs mb-5">Active / At Risk based on sheet (last 4 sabha)</p>
          <KKWorkloadChart kkStats={kkStats} dates={activePastDates} />
        </div>
      )}
    </div>
  );
}
