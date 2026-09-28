'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { getPastDates, getSessionTrend } from '@/lib/analytics';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import VaktaTopicTrendChart from '@/components/charts/VaktaTopicTrendChart';
import ContactActions from '@/components/ContactActions';
import { useAuthSession } from '@/hooks/useAuthSession';
import { SABHA_DISPLAY, SABHA_TYPES } from '@/lib/sabha';
import { SabhaType, Yuvak } from '@/lib/types';

function parseSabhaDate(value: string): Date {
  const normalized = value.replace(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`);
  return new Date(normalized);
}

function getSheetLabel(sabhaType: string) {
  const normalized = sabhaType.trim().toLowerCase();
  if (normalized.includes('kishor')) return 'AYC';
  if (normalized.includes('bal')) return 'Bal';
  return 'Yuva';
}

function getSabhaTitle(sabhaType: SabhaType) {
  return SABHA_DISPLAY[sabhaType]?.navLabel ?? getSheetLabel(sabhaType);
}

function getSabhaAccentClasses(sabhaType: SabhaType) {
  switch (SABHA_DISPLAY[sabhaType]?.accent) {
    case 'purple':
      return {
        border: 'border-purple-500/80 dark:border-purple-500/25',
        text: 'text-purple-700 dark:text-purple-300',
        badge: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/35 dark:bg-purple-500/10 dark:text-purple-200',
      };
    case 'orange':
      return {
        border: 'border-orange-500/80 dark:border-orange-500/25',
        text: 'text-orange-700 dark:text-orange-300',
        badge: 'border-orange-300/80 bg-orange-50 text-orange-700 dark:border-orange-500/35 dark:bg-orange-500/10 dark:text-orange-200',
      };
    default:
      return {
        border: 'border-sky-500/80 dark:border-sky-500/25',
        text: 'text-sky-700 dark:text-sky-300',
        badge: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-500/10 dark:text-sky-200',
      };
  }
}

function sortSabhaTypes(types: SabhaType[]) {
  const order = new Map(SABHA_TYPES.map((sabhaType, index) => [sabhaType, index]));
  return [...types].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function getPrimaryArea(yuvaks: Yuvak[]) {
  const areaCounts = yuvaks.reduce((map, y) => {
    const area = y.area?.trim();
    if (!area) return map;
    map.set(area, (map.get(area) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  return Array.from(areaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Area Not Set';
}

const kkMetricAccentMap = {
  orange: {
    value: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20',
    glow: 'from-amber-500/10 via-amber-500/0',
  },
  blue: {
    value: 'text-sky-600 dark:text-sky-400',
    icon: 'text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/20',
    glow: 'from-sky-500/10 via-sky-500/0',
  },
};

function KkMetricCard({
  eyebrow,
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  eyebrow: string;
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  accent: keyof typeof kkMetricAccentMap;
}) {
  const styles = kkMetricAccentMap[accent];

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#ddcfbc] bg-[#f3eadc] p-4 shadow-[0_10px_24px_rgba(31,41,55,0.05)] dark:border-slate-700/80 dark:bg-slate-800/90 dark:shadow-none">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-br ${styles.glow} to-transparent`} />
      <div className="relative flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">{eyebrow}</p>
            <p className="mt-1 text-[15px] font-medium text-[#52647f] dark:text-slate-400">{title}</p>
          </div>
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-semibold ${styles.icon}`}>
            {icon}
          </span>
        </div>
        <div>
          <p className={`text-[2.1rem] font-bold tracking-tight ${styles.value}`}>{value}</p>
          <p className="mt-1.5 text-[13px] text-[#7c8798] dark:text-slate-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default function KkHomeClient() {
  const { data, loading, error, refresh } = useSheetData();
  const { data: fullData } = useSheetData({ scope: 'full' });
  const { data: session } = useAuthSession();
  const [openStats, setOpenStats] = useState<Record<string, boolean>>({});
  const [collapsedSabhas, setCollapsedSabhas] = useState<Record<string, boolean>>({});

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
  const pastDates = getPastDates(dates);
  const fullYuvaks = fullData?.yuvaks ?? [];
  const fullDates = fullData?.dates ?? [];
  const fullPastDates = getPastDates(fullDates);

  const threeMonthCutoff = new Date();
  threeMonthCutoff.setMonth(threeMonthCutoff.getMonth() - 3);
  const kkDisplayName = (session?.user as { assignedKK?: string } | undefined)?.assignedKK || session?.user?.name || 'KK';
  const sabhaTypes = sortSabhaTypes(Array.from(new Set(yuvaks.map((y) => y.sabhaType))));
  const hasMultipleSabhas = sabhaTypes.length > 1;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-2xl border border-[#e7e0d6] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:border-sky-500/25 dark:bg-slate-900 dark:shadow-[0_10px_30px_rgba(2,6,23,0.34)] sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <h1 className="min-w-0 text-xl font-extrabold tracking-tight text-[#0f172a] dark:text-slate-50 sm:text-2xl">{kkDisplayName} Dashboard</h1>
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/12 dark:text-amber-200 sm:px-3 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-200" />
            <span className="truncate">{hasMultipleSabhas ? `${sabhaTypes.length} sabhas assigned` : getPrimaryArea(yuvaks)}</span>
          </span>
        </div>
        {hasMultipleSabhas && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sabhaTypes.map((sabhaType) => {
              const groupYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
              const accent = getSabhaAccentClasses(sabhaType);
              return (
                <span key={sabhaType} className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accent.badge}`}>
                  {getSabhaTitle(sabhaType)}: {groupYuvaks.length}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {sabhaTypes.map((sabhaType) => {
        const groupYuvaks = yuvaks.filter((y) => y.sabhaType === sabhaType);
        const activePastDates = pastDates.filter((date) => groupYuvaks.some((y) => y.dateAttendance[date]));
        const totalYuvaks = groupYuvaks.length;
        const activeYuvaks = groupYuvaks.filter((y) => y.superActive);
        const deactiveYuvaks = groupYuvaks.filter((y) => !y.superActive);
        const activeCount = activeYuvaks.length;
        const deactiveCount = deactiveYuvaks.length;
        const avgAttendance = totalYuvaks > 0
          ? Math.round(groupYuvaks.reduce((sum, y) => sum + y.attendancePercent, 0) / totalYuvaks)
          : 0;
        const activePct = totalYuvaks > 0 ? Math.round((activeCount / totalYuvaks) * 100) : 0;
        const efficiencyScore = Math.round((activePct * 0.7) + (avgAttendance * 0.3));
        const accent = getSabhaAccentClasses(sabhaType);
        const sabhaLabel = getSabhaTitle(sabhaType);
        const sectionCollapsed = Boolean(collapsedSabhas[sabhaType]);

        const sessionTrend = activePastDates.map((date) => {
          const count = groupYuvaks.filter((y) => y.dateAttendance[date]).length;
          const percentage = totalYuvaks > 0 ? Math.round((count / totalYuvaks) * 100) : 0;

          return {
            date,
            count,
            percentage,
            areaBreakdown: [] as Array<{ area: string; attended: number }>,
          };
        });

        const fullSabhaAllYuvaks = fullYuvaks.filter((y) => y.sabhaType === sabhaType);
        const fullSabhaYuvaks = fullSabhaAllYuvaks.filter((y) => y.attendingSabha);
        const fullSabhaActiveDates = fullPastDates.filter((date) => fullSabhaAllYuvaks.some((y) => y.dateAttendance[date]));
        const sharedAttendanceTrend = fullSabhaYuvaks.length > 0
          ? getSessionTrend(fullSabhaYuvaks, fullSabhaActiveDates).slice(-20)
          : sessionTrend.slice(-20);
        const sharedAttendanceTotal = fullSabhaYuvaks.length > 0 ? fullSabhaYuvaks.length : totalYuvaks;
        const sessionMetaByDate = fullData?.sabhaSessionMeta?.[sabhaType] ?? sabhaSessionMeta[sabhaType];

        const vaktaTopicTrend3m = activePastDates
          .filter((date) => parseSabhaDate(date) >= threeMonthCutoff)
          .map((date) => {
            const attendanceCount = groupYuvaks.filter((y) => y.dateAttendance[date]).length;
            const attendancePct = totalYuvaks > 0 ? Math.round((attendanceCount / totalYuvaks) * 100) : 0;
            const sessionMeta = sabhaSessionMeta[sabhaType]?.[date];

            return {
              date,
              vakta: sessionMeta?.vakta?.trim() || 'Not added yet',
              topic: sessionMeta?.topic?.trim() || 'Not added yet',
              attendanceCount,
              attendancePct,
            };
          });

        const fullVaktaTopicTrend3m = fullSabhaActiveDates
          .filter((date) => parseSabhaDate(date) >= threeMonthCutoff)
          .map((date) => {
            const attendanceCount = fullSabhaYuvaks.filter((y) => y.dateAttendance[date]).length;
            const attendancePct = fullSabhaYuvaks.length > 0 ? Math.round((attendanceCount / fullSabhaYuvaks.length) * 100) : 0;
            const fullMeta = fullData?.sabhaSessionMeta?.[sabhaType]?.[date];

            return {
              date,
              vakta: fullMeta?.vakta?.trim() || 'Not added yet',
              topic: fullMeta?.topic?.trim() || 'Not added yet',
              attendanceCount,
              attendancePct,
            };
          });

        const cards = [
          {
            key: 'total',
            title: 'Total Yuvaks',
            value: totalYuvaks,
            subtitle: `assigned in ${sabhaLabel}`,
            tone: 'text-sky-600 dark:text-sky-400',
            eyebrow: 'Network',
            icon: 'S',
            glow: 'from-sky-500/10 via-sky-500/0',
            iconClass: 'text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/20',
            list: groupYuvaks,
          },
          {
            key: 'active',
            title: 'Active',
            value: activeCount,
            subtitle: 'super active',
            tone: 'text-emerald-600 dark:text-emerald-400',
            eyebrow: 'Healthy',
            icon: 'A',
            glow: 'from-emerald-500/10 via-emerald-500/0',
            iconClass: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20',
            list: activeYuvaks,
          },
          {
            key: 'deactive',
            title: 'Deactive',
            value: deactiveCount,
            subtitle: 'need follow-up',
            tone: 'text-rose-600 dark:text-rose-400',
            eyebrow: 'Follow-up',
            icon: '!',
            glow: 'from-rose-500/10 via-rose-500/0',
            iconClass: 'text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20',
            list: deactiveYuvaks,
          },
        ] as const;

        return (
          <section key={sabhaType} className={`space-y-4 rounded-2xl border ${accent.border} bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:bg-slate-900/35 dark:shadow-none sm:p-5`}>
            <button
              type="button"
              aria-expanded={!sectionCollapsed}
              onClick={() => setCollapsedSabhas((current) => ({ ...current, [sabhaType]: !current[sabhaType] }))}
              className="flex w-full items-center justify-between gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <div className="min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent.text}`}>{getSheetLabel(sabhaType)} Follow-up</p>
                <h2 className="mt-1 text-xl font-bold text-[#0f172a] dark:text-slate-50">{sabhaLabel}</h2>
                <p className="mt-1 text-xs text-[#475569] dark:text-slate-400">Showing only {kkDisplayName} yuvaks for this sabha.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${accent.badge}`}>
                  {totalYuvaks} yuvaks
                </span>
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-transform dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${sectionCollapsed ? '' : 'rotate-180'}`}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 7.5L10 12.5L15 7.5" />
                  </svg>
                </span>
              </div>
            </button>

            {!sectionCollapsed && (
              <>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {cards.map((card) => {
                const panelKey = `${sabhaType}-${card.key}`;
                const isOpen = Boolean(openStats[panelKey]);

                return (
                  <div key={panelKey} className="relative overflow-hidden rounded-[22px] border border-[#ddcfbc] bg-[#f3eadc] p-4 shadow-[0_10px_24px_rgba(31,41,55,0.05)] dark:border-slate-700/80 dark:bg-slate-800/90 dark:shadow-none">
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-br ${card.glow} to-transparent`} />
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`kk-stat-panel-${panelKey}`}
                      onClick={() => setOpenStats((current) => ({ ...current, [panelKey]: !current[panelKey] }))}
                      className="relative flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">{card.eyebrow}</p>
                        <p className="mt-1 text-[15px] font-medium text-[#64748b] dark:text-slate-400">{card.title}</p>
                        <p className={`mt-2 text-4xl font-bold ${card.tone}`}>{card.value}</p>
                        <p className="mt-2 text-[13px] text-[#7c8798] dark:text-slate-500">{card.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-semibold ${card.iconClass}`}>
                          {card.icon}
                        </span>
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#d8c7b2] bg-[#fff7ed] text-[#64748b] transition-all dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 ${isOpen ? 'rotate-180 border-sky-400 text-sky-600 dark:border-sky-500/50 dark:text-sky-200' : 'hover:border-[#cbb89f] hover:text-[#334155] dark:hover:border-slate-600 dark:hover:text-slate-100'}`}>
                          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 7.5L10 12.5L15 7.5" />
                          </svg>
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div id={`kk-stat-panel-${panelKey}`} className="relative mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-[#ece4d7] pt-3 dark:border-slate-700">
                        {card.list.length === 0 ? (
                          <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">No yuvaks found.</p>
                        ) : (
                          card.list.map((yuvak) => (
                            <div key={`${panelKey}-${yuvak.name}`} className="rounded-lg border border-[#c9b89f] bg-white px-2.5 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:shadow-none">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="break-words font-semibold leading-snug text-[#0f172a] dark:text-slate-100">{yuvak.name}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <p className="text-[#52647f] dark:text-slate-400">{yuvak.attendancePercent}% attendance</p>
                                    <ContactActions name={yuvak.name} phoneNumber={yuvak.phoneNumber} size="xs" />
                                  </div>
                                </div>
                                <span className={`shrink-0 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${accent.badge}`}>
                                  {getSheetLabel(yuvak.sabhaType)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <KkMetricCard
                eyebrow="Attendance"
                title="Avg Attendance"
                value={`${avgAttendance}%`}
                subtitle={sabhaLabel}
                accent="orange"
                icon="%"
              />
              <KkMetricCard
                eyebrow="Score"
                title="Efficiency Score"
                value={efficiencyScore}
                subtitle="70% active + 30% attendance"
                accent="blue"
                icon="E"
              />
            </div>

            <AttendanceTrendChart
              sessionTrend={sharedAttendanceTrend}
              sabhaLabel={sabhaLabel}
              totalYuvaks={sharedAttendanceTotal}
              sessionMetaByDate={sessionMetaByDate}
            />

            <VaktaTopicTrendChart
              points={vaktaTopicTrend3m}
              totalYuvaks={totalYuvaks}
              comparisonPoints={fullVaktaTopicTrend3m}
              comparisonTotalYuvaks={fullSabhaYuvaks.length}
              primaryLabel={`Your ${getSheetLabel(sabhaType)} Follow-up`}
              comparisonLabel={`Overall ${sabhaLabel}`}
              scopeNote={`Use toggle to compare your assigned ${getSheetLabel(sabhaType)} yuvaks vs overall ${sabhaLabel}.`}
            />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
