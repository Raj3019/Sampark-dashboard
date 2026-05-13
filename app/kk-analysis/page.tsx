'use client';

import { useEffect, useState } from 'react';
import { getAttendanceStatus, getKKStats, getPastDates } from '@/lib/analytics';
import { useSheetData } from '@/hooks/useSheetData';
import KKWorkloadChart from '@/components/charts/KKWorkloadChart';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import { KKStats } from '@/lib/types';

type SabhaFilter = 'cn' | 'kishor' | 'bal';

function normalizePersonName(value: string) {
  return value.trim().toLowerCase();
}

function KKSection({
  kkStats,
  dates,
  accentColor,
  label,
  borderClass,
  badgeClass,
  sabhaLabel,
  enableWhatsappActions = false,
  kkWhatsappNumbers = {},
}: {
  kkStats: KKStats[];
  dates: string[];
  accentColor: string;
  label: string;
  borderClass: string;
  badgeClass: string;
  sabhaLabel: string;
  enableWhatsappActions?: boolean;
  kkWhatsappNumbers?: Record<string, string>;
}) {
  const overloaded = kkStats.filter((kk) => kk.yuvaks.length > 6);
  const total = kkStats.reduce((sum, kk) => sum + kk.yuvaks.length, 0);
  const avgPerKK = kkStats.length > 0 ? Math.round(total / kkStats.length) : 0;

  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-3 border-b pb-3 ${borderClass}`}>
        <span className={`h-6 w-1 rounded-full ${accentColor}`} />
        <h2 className="text-lg font-bold text-slate-100">{label}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass}`}>{kkStats.length} KKs · {total} yuvaks</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard title="Total KKs" value={kkStats.length} subtitle="in this sabha" accent="orange" />
        <StatsCard title="Avg Yuvaks/KK" value={avgPerKK} subtitle="per KK on average" accent="blue" />
        <StatsCard title="Overloaded KKs" value={overloaded.length} subtitle="more than 6 yuvaks" accent="yellow" />
      </div>

      {overloaded.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="mb-2 flex gap-2">
            <span className="text-yellow-400">!</span>
            <p className="text-sm font-medium text-yellow-300">KKs with Heavy Follow-Up Load</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {overloaded.map((kk) => (
              <span key={kk.name} className="rounded-full border border-yellow-500/20 bg-yellow-500/15 px-3 py-1 text-xs text-yellow-300">
                {kk.name} ({kk.yuvaks.length} yuvaks)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-xl border bg-slate-800 p-5 ${borderClass}`}>
        <KKWorkloadChart
          kkStats={kkStats}
          dates={dates}
          sabhaLabel={sabhaLabel}
          enableWhatsappActions={enableWhatsappActions}
          kkWhatsappNumbers={kkWhatsappNumbers}
        />
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-slate-100">Detailed KK Report</h3>
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-500">{kkStats.length} KKs · {total} yuvaks</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kkStats.map((kk) => {
          const urgentYuvaks = kk.yuvaks
            .filter((yuvak) => {
              const status = getAttendanceStatus(yuvak, dates);
              return status === 'red' || status === 'yellow';
            })
            .sort((left, right) => left.attendancePercent - right.attendancePercent);
          const totalForKK = kk.yuvaks.length;

          return (
            <div key={kk.name} className={`rounded-xl border bg-slate-800 p-5 ${kk.yellowCount > 0 ? 'border-yellow-500/20' : 'border-slate-700'}`}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-100">{kk.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-100">{totalForKK}</p>
                  <p className="text-xs text-slate-500">yuvaks</p>
                </div>
              </div>

              <div className="mb-3 flex h-2 gap-0 overflow-hidden rounded-full">
                {kk.greenCount > 0 && <div className="bg-green-500" style={{ width: `${(kk.greenCount / totalForKK) * 100}%` }} />}
                {kk.yellowCount > 0 && <div className="bg-yellow-400" style={{ width: `${(kk.yellowCount / totalForKK) * 100}%` }} />}
              </div>

              <div className="mb-3 flex gap-3 text-xs">
                <span className="text-green-400">{kk.greenCount} active</span>
                <span className="text-yellow-400">{kk.yellowCount} attention</span>
                <span className="ml-auto text-slate-400">avg {kk.avgAttendance}%</span>
              </div>

              {urgentYuvaks.length > 0 && (
                <div className="border-t border-slate-700 pt-3">
                  <p className="mb-2 text-xs text-slate-400">Needs follow-up ({urgentYuvaks.length}):</p>
                  <div className="max-h-32 space-y-1.5 overflow-y-auto">
                    {urgentYuvaks.slice(0, 6).map((yuvak, index) => (
                      <div key={`${yuvak.name}-${index}`} className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">{yuvak.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{yuvak.attendancePercent.toFixed(0)}%</span>
                          <StatusBadge status={getAttendanceStatus(yuvak, dates)} size="sm" />
                        </div>
                      </div>
                    ))}
                    {urgentYuvaks.length > 6 && (
                      <p className="text-xs text-slate-600">+{urgentYuvaks.length - 6} more</p>
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
  const [kkContacts, setKkContacts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchKkContacts = async () => {
      try {
        const response = await fetch('/api/kk-contacts');
        if (!response.ok) return;
        const payload = await response.json() as { contacts?: Record<string, string> };
        if (!cancelled) setKkContacts(payload.contacts ?? {});
      } catch {
        if (!cancelled) setKkContacts({});
      }
    };

    fetchKkContacts();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="mb-3 text-red-400">{error}</p>
          <button onClick={refresh} className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { yuvaks, dates } = data;
  const pastDates = getPastDates(dates);
  const allCN = yuvaks.filter((yuvak) => yuvak.sabhaType === 'Chirag Nagar');
  const allKishor = yuvaks.filter((yuvak) => yuvak.sabhaType === 'Chirag Nagar(Kishor)');
  const allBal = yuvaks.filter((yuvak) => yuvak.sabhaType === 'Bal Sabha');
  const kkWhatsappNumbers = yuvaks.reduce<Record<string, string>>((acc, yuvak) => {
    const nameKey = normalizePersonName(yuvak.name);
    const phoneNumber = yuvak.phoneNumber?.trim();

    if (!nameKey || !phoneNumber || acc[nameKey]) return acc;
    acc[nameKey] = phoneNumber;
    return acc;
  }, {});
  Object.entries(kkContacts).forEach(([kkName, phoneNumber]) => {
    const nameKey = normalizePersonName(kkName);
    const trimmedPhone = phoneNumber?.trim();
    if (!nameKey || !trimmedPhone) return;
    kkWhatsappNumbers[nameKey] = trimmedPhone;
  });

  const cnActiveDates = pastDates.filter((date) => allCN.some((yuvak) => yuvak.dateAttendance[date]));
  const kishorActiveDates = pastDates.filter((date) => allKishor.some((yuvak) => yuvak.dateAttendance[date]));
  const balActiveDates = pastDates.filter((date) => allBal.some((yuvak) => yuvak.dateAttendance[date]));

  const applyAttending = <T extends { attendingSabha: boolean }>(values: T[]) =>
    values.filter((item) =>
      attendingFilter === 'all' ? true : attendingFilter === 'yes' ? item.attendingSabha : !item.attendingSabha
    );

  const cnYuvaks = applyAttending(allCN);
  const kishorYuvaks = applyAttending(allKishor);
  const balYuvaks = applyAttending(allBal);

  const cnKKStats = getKKStats(cnYuvaks, cnActiveDates);
  const kishorKKStats = getKKStats(kishorYuvaks, kishorActiveDates);
  const balKKStats = getKKStats(balYuvaks, balActiveDates);

  const totalKKs = new Set([
    ...cnKKStats.map((kk) => kk.name),
    ...kishorKKStats.map((kk) => kk.name),
    ...balKKStats.map((kk) => kk.name),
  ]).size;
  const totalYuvaks = cnYuvaks.length + kishorYuvaks.length + balYuvaks.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">KK Analysis</h1>
          <p className="mt-1 text-sm text-slate-500">
            Follow-up KK workload across all sabhas ·{' '}
            <span className="text-blue-400">{cnKKStats.length} CN KKs</span>
            {' · '}
            <span className="text-purple-400">{kishorKKStats.length} Kishor KKs</span>
            {' · '}
            <span className="text-orange-400">{balKKStats.length} Bal KKs</span>
            {' · '}
            <span className="text-slate-400">{totalKKs} unique KKs · {totalYuvaks} yuvaks</span>
          </p>
        </div>
        <button onClick={refresh} className="self-start rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600">
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex w-full overflow-hidden rounded-lg border border-slate-700 text-xs font-medium sm:w-auto">
          <button
            onClick={() => setSabhaFilter('cn')}
            className={`px-3 py-1.5 transition-colors ${sabhaFilter === 'cn' ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}`}
          >
            CN
          </button>
          <button
            onClick={() => setSabhaFilter('kishor')}
            className={`px-3 py-1.5 transition-colors ${sabhaFilter === 'kishor' ? 'bg-purple-700/60 text-purple-100' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}`}
          >
            Kishor
          </button>
          <button
            onClick={() => setSabhaFilter('bal')}
            className={`px-3 py-1.5 transition-colors ${sabhaFilter === 'bal' ? 'bg-orange-700/60 text-orange-100' : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'}`}
          >
            Bal
          </button>
        </div>

        <div className="flex w-full overflow-hidden rounded-lg border border-slate-700 text-xs font-medium sm:w-auto">
          {(['yes'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setAttendingFilter(value)}
              className={`px-3 py-1.5 transition-colors ${
                attendingFilter === value
                  ? 'bg-green-700/60 text-green-200'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              Attending
            </button>
          ))}
        </div>
      </div>

      {sabhaFilter === 'cn' && (
        <KKSection
          kkStats={cnKKStats}
          dates={cnActiveDates}
          accentColor="bg-blue-500"
          label="Chirag Nagar Sabha - KK Workload"
          borderClass="border-blue-500/20"
          badgeClass="border border-blue-500/20 bg-blue-500/10 text-blue-400"
          sabhaLabel="Chirag Nagar"
          enableWhatsappActions
          kkWhatsappNumbers={kkWhatsappNumbers}
        />
      )}

      {sabhaFilter === 'kishor' && (
        <KKSection
          kkStats={kishorKKStats}
          dates={kishorActiveDates}
          accentColor="bg-purple-500"
          label="Kishor Sabha - KK Workload"
          borderClass="border-purple-500/20"
          badgeClass="border border-purple-500/20 bg-purple-500/10 text-purple-400"
          sabhaLabel="Kishor"
          enableWhatsappActions
          kkWhatsappNumbers={kkWhatsappNumbers}
        />
      )}

      {sabhaFilter === 'bal' && (
        <KKSection
          kkStats={balKKStats}
          dates={balActiveDates}
          accentColor="bg-orange-500"
          label="Bal Sabha - KK Workload"
          borderClass="border-orange-500/20"
          badgeClass="border border-orange-500/20 bg-orange-500/10 text-orange-400"
          sabhaLabel="Bal"
          enableWhatsappActions
          kkWhatsappNumbers={kkWhatsappNumbers}
        />
      )}
    </div>
  );
}
