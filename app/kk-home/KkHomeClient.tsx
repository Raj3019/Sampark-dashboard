'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { getPastDates, getSessionTrend } from '@/lib/analytics';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import VaktaTopicTrendChart from '@/components/charts/VaktaTopicTrendChart';
import StatsCard from '@/components/StatsCard';
import { authClient } from '@/lib/auth/client';

function parseSabhaDate(value: string): Date {
  const normalized = value.replace(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`);
  return new Date(normalized);
}

function isKishorAlias(sabhaType: string) {
  const normalized = sabhaType.trim().toLowerCase();
  return normalized === 'chirag nagar(kishor)' || normalized === 'chirag nagar';
}

function getSheetLabel(sabhaType: string) {
  const normalized = sabhaType.trim().toLowerCase();
  return normalized.includes('kishor') ? 'Kishor' : 'Yuva';
}

export default function KkHomeClient() {
  const { data, loading, error, refresh } = useSheetData();
  const { data: fullData } = useSheetData({ scope: 'full' });
  const { data: session } = authClient.useSession();
  const [openStats, setOpenStats] = useState<{ total: boolean; active: boolean; deactive: boolean }>({
    total: false,
    active: false,
    deactive: false,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
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
  const sabhaType = 'Chirag Nagar(Kishor)' as const;
  const pastDates = getPastDates(dates);
  const activePastDates = pastDates.filter((d) => yuvaks.some((y) => y.dateAttendance[d]));
  const fullYuvaks = fullData?.yuvaks ?? [];
  const fullDates = fullData?.dates ?? [];
  const fullPastDates = getPastDates(fullDates);
  const fullActivePastDates = fullPastDates.filter((d) => fullYuvaks.some((y) => y.dateAttendance[d]));
  const fullKishorAllYuvaks = fullYuvaks.filter((y) => isKishorAlias(y.sabhaType));
  const fullKishorYuvaks = fullKishorAllYuvaks.filter((y) => y.attendingSabha);
  const fullKishorActivePastDates = fullPastDates.filter((d) => fullKishorAllYuvaks.some((y) => y.dateAttendance[d]));

  const totalYuvaks = yuvaks.length;
  const fullTotalYuvaks = fullYuvaks.length;
  const activeCount = yuvaks.filter((y) => y.superActive).length;
  const deactiveCount = totalYuvaks - activeCount;
  const avgAttendance = totalYuvaks > 0
    ? Math.round(yuvaks.reduce((sum, y) => sum + y.attendancePercent, 0) / totalYuvaks)
    : 0;
  const activePct = totalYuvaks > 0 ? Math.round((activeCount / totalYuvaks) * 100) : 0;
  const efficiencyScore = Math.round((activePct * 0.7) + (avgAttendance * 0.3));

  const sessionTrend = activePastDates.map((date) => {
    const count = yuvaks.filter((y) => y.dateAttendance[date]).length;
    const percentage = totalYuvaks > 0 ? Math.round((count / totalYuvaks) * 100) : 0;

    return {
      date,
      count,
      percentage,
      areaBreakdown: [] as Array<{ area: string; attended: number }>,
    };
  });

  // Keep this chart aligned with leader/admin view: same sabha sessions and area split.
  const sharedAttendanceTrend = fullKishorYuvaks.length > 0
    ? getSessionTrend(fullKishorYuvaks, fullKishorActivePastDates).slice(-20)
    : sessionTrend.slice(-20);
  const sharedAttendanceTotal = fullKishorYuvaks.length > 0 ? fullKishorYuvaks.length : totalYuvaks;
  const sharedSessionMetaByDate =
    fullData?.sabhaSessionMeta?.[sabhaType]
    ?? fullData?.sabhaSessionMeta?.['Chirag Nagar']
    ?? fullData?.sabhaSessionMeta?.['Bal Sabha']
    ?? sabhaSessionMeta[sabhaType];

  const threeMonthCutoff = new Date();
  threeMonthCutoff.setMonth(threeMonthCutoff.getMonth() - 3);

  const vaktaTopicTrend3m = activePastDates
    .filter((date) => parseSabhaDate(date) >= threeMonthCutoff)
    .map((date) => {
      const attendanceCount = yuvaks.filter((y) => y.dateAttendance[date]).length;
      const attendancePct = totalYuvaks > 0 ? Math.round((attendanceCount / totalYuvaks) * 100) : 0;

      const sessionMeta =
        sabhaSessionMeta['Chirag Nagar(Kishor)']?.[date]
        ?? sabhaSessionMeta['Chirag Nagar']?.[date]
        ?? sabhaSessionMeta['Bal Sabha']?.[date];

      return {
        date,
        vakta: sessionMeta?.vakta?.trim() || 'Not added yet',
        topic: sessionMeta?.topic?.trim() || 'Not added yet',
        attendanceCount,
        attendancePct,
      };
    });

  const kkDisplayName = (session?.user as { assignedKK?: string } | undefined)?.assignedKK || session?.user?.name || 'KK';
  const activeYuvaks = yuvaks.filter((y) => y.superActive);
  const deactiveYuvaks = yuvaks.filter((y) => !y.superActive);
  const areaCounts = yuvaks.reduce((map, y) => {
    const area = y.area?.trim();
    if (!area) return map;
    map.set(area, (map.get(area) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const primaryArea = Array.from(areaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Area Not Set';

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-linear-to-r from-slate-900 via-slate-900 to-sky-950/35 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_10px_30px_rgba(2,6,23,0.34)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-2 sm:gap-2.5">
          <h1 className="min-w-0 text-xl font-extrabold tracking-tight text-slate-100 sm:text-2xl">{kkDisplayName} Bhai's Dashboard</h1>
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/12 px-2.5 py-1 text-[11px] font-semibold text-amber-200 sm:px-3 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
            <span className="truncate">{primaryArea}</span>
          </span>
        </div>
        {/* <p className="relative mt-1 text-xs text-slate-300/85 sm:text-sm">Scoped view for {kkDisplayName}</p> */}
      </div>

      <div className="space-y-5 sm:space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          {[
            {
              key: 'total' as const,
              title: 'Total Yuvaks',
              value: totalYuvaks,
              subtitle: 'assigned to you',
              tone: 'text-blue-400',
              list: yuvaks,
            },
            {
              key: 'active' as const,
              title: 'Active',
              value: activeCount,
              subtitle: 'super active',
              tone: 'text-green-400',
              list: activeYuvaks,
            },
            {
              key: 'deactive' as const,
              title: 'Deactive',
              value: deactiveCount,
              subtitle: 'need follow-up',
              tone: 'text-red-400',
              list: deactiveYuvaks,
            },
          ].map((card) => (
            <div key={card.key} className="rounded-xl border border-slate-700 bg-linear-to-b from-slate-800 to-slate-800/70 p-4">
              <button
                type="button"
                aria-expanded={openStats[card.key]}
                aria-controls={`kk-stat-panel-${card.key}`}
                onClick={() => setOpenStats((current) => ({ ...current, [card.key]: !current[card.key] }))}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-slate-400 text-sm font-medium">{card.title}</p>
                  <p className={`mt-2 text-4xl font-bold ${card.tone}`}>{card.value}</p>
                  <p className="mt-2 text-slate-500 text-xs">{card.subtitle}</p>
                </div>
                <span
                  className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-900/80 text-slate-300 transition-all ${openStats[card.key] ? 'rotate-180 border-sky-500/50 text-sky-200' : 'hover:border-slate-500 hover:text-slate-100'}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" />
                  </svg>
                </span>
              </button>

              {openStats[card.key] && (
                <div id={`kk-stat-panel-${card.key}`} className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-slate-700 pt-3">
                  {card.list.length === 0 ? (
                    <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-2.5 py-2 text-xs text-slate-400">No yuvaks found.</p>
                  ) : (
                    card.list.map((yuvak) => {
                      const sheetLabel = getSheetLabel(yuvak.sabhaType);
                      const isKishor = sheetLabel === 'Kishor';

                      return (
                        <div key={`${card.key}-${yuvak.name}`} className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-100">{yuvak.name}</p>
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isKishor ? 'border border-violet-500/35 bg-violet-500/10 text-violet-200' : 'border border-sky-500/35 bg-sky-500/10 text-sky-200'}`}>
                              {sheetLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-400">
                            {sheetLabel} - {yuvak.attendancePercent}% attendance
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
          <StatsCard title="Avg Attendance" value={`${avgAttendance}%`} subtitle="overall" accent="orange" />
          <StatsCard title="Efficiency Score" value={efficiencyScore} subtitle="70% active + 30% attendance" accent="blue" />
        </div>

        <AttendanceTrendChart
          sessionTrend={sharedAttendanceTrend}
          sabhaLabel="AYC Sabha"
          totalYuvaks={sharedAttendanceTotal}
          sessionMetaByDate={sharedSessionMetaByDate}
        />

        <p className="text-[11px] text-slate-400">Showing only {kkDisplayName} yuvaks</p>

        {(() => {
          const fullVaktaTopicTrend3m = fullActivePastDates
            .filter((date) => parseSabhaDate(date) >= threeMonthCutoff)
            .map((date) => {
              const attendanceCount = fullYuvaks.filter((y) => y.dateAttendance[date]).length;
              const attendancePct = fullTotalYuvaks > 0 ? Math.round((attendanceCount / fullTotalYuvaks) * 100) : 0;
              const fullMeta =
                fullData?.sabhaSessionMeta?.['Chirag Nagar(Kishor)']?.[date]
                ?? fullData?.sabhaSessionMeta?.['Chirag Nagar']?.[date]
                ?? fullData?.sabhaSessionMeta?.['Bal Sabha']?.[date];

              return {
                date,
                vakta: fullMeta?.vakta?.trim() || 'Not added yet',
                topic: fullMeta?.topic?.trim() || 'Not added yet',
                attendanceCount,
                attendancePct,
              };
            });

          return (
            <VaktaTopicTrendChart
              points={vaktaTopicTrend3m}
              totalYuvaks={totalYuvaks}
              comparisonPoints={fullVaktaTopicTrend3m}
              comparisonTotalYuvaks={fullTotalYuvaks}
              primaryLabel="Your Yuvak Performance"
              comparisonLabel="Sabha Performance"
              scopeNote="Use toggle to compare your yuvaks vs overall sabha."
            />
          );
        })()}

      </div>
    </div>
  );
}
