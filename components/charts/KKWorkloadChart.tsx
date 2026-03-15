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
    () => kkStats.filter((kk) => {
      if (search && !kk.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterArea !== 'all' && !kk.yuvaks.some((y) => y.area === filterArea)) return false;
      return true;
    }),
    [kkStats, search, filterArea],
  );

  return (
    <div className="space-y-5">
      <p className="text-slate-400 text-sm leading-relaxed">
        Each row below is one <strong className="text-slate-200">KK (follow-up coordinator)</strong> and all the yuvaks under their care.
        Status is based on the <strong className="text-slate-200">last 6 sabhas</strong>. The bar shows attendance health.
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

      <div className="space-y-3">
        {filtered.map((kk) => {
          const total = kk.yuvaks.length;
          const absentLast = lastDate ? kk.yuvaks.filter((y) => !y.dateAttendance[lastDate]).length : null;
          const greenPct = total > 0 ? (kk.greenCount / total) * 100 : 0;
          const yellowPct = total > 0 ? (kk.yellowCount / total) * 100 : 0;

          return (
            <div key={kk.name} className="border rounded-xl p-5 bg-slate-800/60 border-slate-700/60">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-100 font-bold">{kk.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span><span className="font-bold text-green-400">{kk.greenCount}</span> <span className="text-slate-500 text-xs">Active</span></span>
                  <span><span className="font-bold text-amber-400">{kk.yellowCount}</span> <span className="text-slate-500 text-xs">At Risk</span></span>
                  {/* <span><span className="font-bold text-red-400">{kk.redCount}</span> <span className="text-slate-500 text-xs">Inactive</span></span> */}
                  <span className="text-slate-600 text-xs">/ {total} total</span>
                </div>
              </div>

              <div className="flex h-3 rounded-full overflow-hidden bg-slate-700/40">
                {greenPct > 0 && <div style={{ width: `${greenPct}%` }} className="bg-green-500" />}
                {yellowPct > 0 && <div style={{ width: `${yellowPct}%` }} className="bg-amber-500" />}
                {/* red segment commented out */}
                {/* {redPct > 0 && <div style={{ width: `${redPct}%` }} className="bg-red-500" />} */}
              </div>

              {absentLast !== null && (
                <p className="text-slate-500 text-xs mt-2">
                  Absent from last Sabha: <span className="text-slate-300">{absentLast} of {total} yuvaks</span>
                </p>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm py-8 text-center">No KKs match your filters.</p>
        )}
      </div>
    </div>
  );
}
