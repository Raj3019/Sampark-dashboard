'use client';

import { useState, useMemo } from 'react';
import { KKStats } from '@/lib/types';

interface Props {
  kkStats: KKStats[];
  dates: string[];
}

export default function KKWorkloadChart({ kkStats, dates }: Props) {
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('all');

  const activeDates = useMemo(() => {
    const allYuvaks = kkStats.flatMap((kk) => kk.yuvaks);
    return dates.filter((d) => allYuvaks.some((y) => y.dateAttendance[d]));
  }, [dates, kkStats]);

  const last2Dates = useMemo(() => activeDates.slice(-2), [activeDates]);
  const last4Dates = useMemo(() => activeDates.slice(-4), [activeDates]);

  // Use the last date where at least one yuvak actually attended.
  const lastDate = useMemo(() => {
    const allYuvaks = kkStats.flatMap((kk) => kk.yuvaks);
    return [...dates].reverse().find((d) => allYuvaks.some((y) => y.dateAttendance[d]))
      ?? dates[dates.length - 1];
  }, [dates, kkStats]);

  const allAreas = useMemo(() => {
    const s = new Set<string>();
    kkStats.forEach((kk) => kk.yuvaks.forEach((y) => { if (y.area) s.add(y.area); }));
    return ['all', ...Array.from(s).sort()];
  }, [kkStats]);

  const filtered = useMemo(
    () => kkStats
      .filter((kk) => {
        if (search && !kk.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterArea !== 'all' && !kk.yuvaks.some((y) => y.area === filterArea)) return false;
        return true;
      })
      .sort((a, b) => {
        const riskA = getRiskSummary(a, last2Dates, last4Dates, lastDate);
        const riskB = getRiskSummary(b, last2Dates, last4Dates, lastDate);

        return (
          riskB.atRisk - riskA.atRisk ||
          riskB.moderateRisk - riskA.moderateRisk ||
          riskB.absentLast - riskA.absentLast ||
          riskA.activePct - riskB.activePct ||
          b.yuvaks.length - a.yuvaks.length ||
          a.name.localeCompare(b.name)
        );
      }),
    [kkStats, search, filterArea, last2Dates, last4Dates, lastDate],
  );

  return (
    <div className="space-y-5">
      <p className="text-slate-400 text-sm leading-relaxed">
        Each row below is one <strong className="text-slate-200">KK (follow-up coordinator)</strong> with summary counts.
        Risk buckets use the <strong className="text-slate-200">last 2 / last 4 sabhas</strong>.
      </p>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">Search</span>
          <input
            type="text"
            placeholder="Search KK name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-16 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 w-52"
          />
        </div>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
        >
          {allAreas.map((a) => (
            <option key={a} value={a}>{a === 'all' ? 'All Areas' : a}</option>
          ))}
        </select>
        <span className="ml-auto text-slate-500 text-sm">{filtered.length} of {kkStats.length} KKs</span>
      </div>

      <div className="border border-slate-700/70 rounded-xl overflow-hidden bg-slate-800/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-215">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">KK Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Areas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Active</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Moderate Risk</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">At Risk</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Active %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Absent Last Sabha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kk, idx) => {
                const total = kk.yuvaks.length;
                const { moderateRisk, atRisk, absentLast, activePct } = getRiskSummary(kk, last2Dates, last4Dates, lastDate);
                const areas = Array.from(new Set(kk.yuvaks.map((y) => y.area).filter(Boolean))).sort();

                return (
                  <tr key={kk.name} className={idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/5'}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-100">{kk.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{areas.length > 0 ? areas.join(', ') : '—'}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-300">{total}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">{kk.greenCount}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-amber-400">{moderateRisk}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-400">{atRisk}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-300">{activePct}%</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-300">{absentLast} / {total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm py-8 text-center">No KKs match your filters.</p>
        )}
      </div>
    </div>
  );
}

function getRiskSummary(
  kk: KKStats,
  last2Dates: string[],
  last4Dates: string[],
  lastDate: string | undefined
) {
  const total = kk.yuvaks.length;
  const absentLast = lastDate ? kk.yuvaks.filter((y) => !y.dateAttendance[lastDate]).length : 0;
  const activePct = total > 0 ? Math.round((kk.greenCount / total) * 100) : 0;
  const riskCounts = kk.yuvaks.reduce(
    (acc, yuvak) => {
      const missedLast2 = last2Dates.length === 2 && last2Dates.every((date) => !yuvak.dateAttendance[date]);
      const missedLast4 = last4Dates.length === 4 && last4Dates.every((date) => !yuvak.dateAttendance[date]);
      if (missedLast4) acc.atRisk++;
      else if (missedLast2) acc.moderateRisk++;
      return acc;
    },
    { moderateRisk: 0, atRisk: 0 }
  );

  return {
    moderateRisk: riskCounts.moderateRisk,
    atRisk: riskCounts.atRisk,
    absentLast,
    activePct,
  };
}
