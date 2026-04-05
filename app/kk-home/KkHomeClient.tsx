'use client';

import { useSheetData } from '@/hooks/useSheetData';
import { getKKStats, getPastDates, getSessionTrend } from '@/lib/analytics';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import VaktaTopicTrendChart from '@/components/charts/VaktaTopicTrendChart';
import StatsCard from '@/components/StatsCard';
import { authClient } from '@/lib/auth/client';

function parseSabhaDate(value: string): Date {
  const normalized = value.replace(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`);
  return new Date(normalized);
}

export default function KkHomeClient() {
  const { data, loading, error, refresh } = useSheetData();
  const { data: fullData } = useSheetData({ scope: 'full' });
  const { data: session } = authClient.useSession();

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
  const fullKishorAllYuvaks = fullYuvaks.filter((y) => y.sabhaType === sabhaType);
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

  const kkStats = getKKStats(yuvaks, activePastDates);
  const kkSummary = kkStats.map((kk) => {
    const kkActive = kk.yuvaks.filter((y) => y.superActive).length;
    const kkDeactive = kk.yuvaks.length - kkActive;
    const kkActivePct = kk.yuvaks.length > 0 ? Math.round((kkActive / kk.yuvaks.length) * 100) : 0;
    const kkEfficiency = Math.round((kkActivePct * 0.7) + (kk.avgAttendance * 0.3));

    return {
      name: kk.name,
      total: kk.yuvaks.length,
      active: kkActive,
      deactive: kkDeactive,
      avgAttendance: kk.avgAttendance,
      efficiency: kkEfficiency,
    };
  });

  const kkDisplayName = (session?.user as { assignedKK?: string } | undefined)?.assignedKK || session?.user?.name || 'KK';
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
          <h1 className="min-w-0 text-xl font-extrabold tracking-tight text-slate-100 sm:text-2xl">{kkDisplayName} Dashboard</h1>
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/12 px-2.5 py-1 text-[11px] font-semibold text-amber-200 sm:px-3 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-200" />
            <span className="truncate">{primaryArea}</span>
          </span>
        </div>
        {/* <p className="relative mt-1 text-xs text-slate-300/85 sm:text-sm">Scoped view for {kkDisplayName}</p> */}
      </div>

      <div className="space-y-5 sm:space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          <StatsCard title="Total Yuvaks" value={totalYuvaks} subtitle="assigned to you" accent="blue" />
          <StatsCard title="Active" value={activeCount} subtitle="super active" accent="green" />
          <StatsCard title="Deactive" value={deactiveCount} subtitle="need follow-up" accent="red" />
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

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 sm:p-5">
          <h3 className="text-slate-100 font-semibold mb-1">KK Data & Efficiency</h3>
          <p className="text-slate-500 text-xs mb-4">Per KK performance from your scoped dataset.</p>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">KK Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">Total</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">Active</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">Deactive</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">Avg Attendance</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wide">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {kkSummary.map((kk) => (
                  <tr key={kk.name} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-100 font-medium">{kk.name}</td>
                    <td className="px-4 py-3 text-slate-300">{kk.total}</td>
                    <td className="px-4 py-3 text-green-400">{kk.active}</td>
                    <td className="px-4 py-3 text-red-400">{kk.deactive}</td>
                    <td className="px-4 py-3 text-sky-300">{kk.avgAttendance}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        kk.efficiency >= 70
                          ? 'bg-green-500/15 text-green-300'
                          : kk.efficiency >= 45
                            ? 'bg-yellow-500/15 text-yellow-300'
                            : 'bg-red-500/15 text-red-300'
                      }`}>
                        {kk.efficiency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
