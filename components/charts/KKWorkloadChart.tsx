'use client';

import { useMemo, useState } from 'react';
import { Phone, Search } from 'lucide-react';
import { KKStats } from '@/lib/types';

interface Props {
  kkStats: KKStats[];
  dates: string[];
  sabhaLabel?: string;
  enableWhatsappActions?: boolean;
  kkWhatsappNumbers?: Record<string, string>;
}

function normalizeWhatsappNumber(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;

  return digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
}

function normalizePhoneHref(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[^\d+]/g, '');
  if (!/\d{7,}/.test(normalized.replace(/\D/g, ''))) return null;

  return `tel:${normalized}`;
}

function normalizePersonName(value: string) {
  return value.trim().toLowerCase();
}

function buildKkWhatsappMessage(kk: KKStats, sabhaLabel: string) {
  const lines = [
    `Jay Swaminarayan ${kk.name},`,
    '',
    `Here are the ${sabhaLabel} yuvaks under your follow-up:`,
    '',
  ];

  kk.yuvaks
    .slice()
    .sort((left, right) => {
      const byArea = (left.area || '').localeCompare(right.area || '');
      if (byArea !== 0) return byArea;
      return left.name.localeCompare(right.name);
    })
    .forEach((yuvak, index) => {
      lines.push(`${index + 1}. ${yuvak.name}`);
      lines.push(`Phone: ${yuvak.phoneNumber?.trim() || 'Not available'}`);
      lines.push(`Area: ${yuvak.area?.trim() || 'Not available'}`);
      lines.push('');
    });

  lines.push(`Total yuvaks: ${kk.yuvaks.length}`);
  return lines.join('\r\n');
}

export default function KKWorkloadChart({
  kkStats,
  dates,
  sabhaLabel = 'Sabha',
  enableWhatsappActions = false,
  kkWhatsappNumbers = {},
}: Props) {
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('all');

  const activeDates = useMemo(() => {
    const allYuvaks = kkStats.flatMap((kk) => kk.yuvaks);
    return dates.filter((d) => allYuvaks.some((y) => y.dateAttendance[d]));
  }, [dates, kkStats]);

  const last2Dates = useMemo(() => activeDates.slice(-2), [activeDates]);
  const last4Dates = useMemo(() => activeDates.slice(-4), [activeDates]);

  const lastDate = useMemo(() => {
    const allYuvaks = kkStats.flatMap((kk) => kk.yuvaks);
    return [...dates].reverse().find((d) => allYuvaks.some((y) => y.dateAttendance[d]))
      ?? dates[dates.length - 1];
  }, [dates, kkStats]);

  const allAreas = useMemo(() => {
    const areaSet = new Set<string>();
    kkStats.forEach((kk) => kk.yuvaks.forEach((y) => {
      if (y.area) areaSet.add(y.area);
    }));
    return ['all', ...Array.from(areaSet).sort()];
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search KK name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
        >
          {allAreas.map((area) => (
            <option key={area} value={area}>{area === 'all' ? 'All Areas' : area}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} of {kkStats.length} KKs</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-800/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-215">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">KK Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Areas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Active</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Moderate Risk</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">At Risk</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Active %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Absent Last Sabha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((kk, idx) => {
                const total = kk.yuvaks.length;
                const { moderateRisk, atRisk, absentLast, activePct } = getRiskSummary(kk, last2Dates, last4Dates, lastDate);
                const areas = Array.from(new Set(kk.yuvaks.map((y) => y.area).filter(Boolean))).sort();
                const kkPhoneNumber = kkWhatsappNumbers[normalizePersonName(kk.name)];
                const phoneHref = normalizePhoneHref(kkPhoneNumber);
                const whatsappNumber = normalizeWhatsappNumber(kkPhoneNumber);
                const whatsappHref = whatsappNumber
                  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildKkWhatsappMessage(kk, sabhaLabel))}`
                  : null;

                return (
                  <tr key={kk.name} className={idx % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/5'}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{kk.name}</span>
                        {enableWhatsappActions && phoneHref && (
                          <a
                            href={phoneHref}
                            aria-label={`Call ${kk.name}`}
                            title={`Call ${kk.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {enableWhatsappActions && whatsappHref && (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open WhatsApp for ${kk.name}`}
                            title={`Send ${kk.name} their yuvak list on WhatsApp`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5"
                              fill="currentColor"
                            >
                              <path d="M19.05 4.94A9.94 9.94 0 0 0 12.03 2C6.55 2 2.08 6.46 2.08 11.95c0 1.76.46 3.47 1.33 4.98L2 22l5.23-1.37a9.9 9.9 0 0 0 4.79 1.22h.01c5.48 0 9.95-4.46 9.95-9.95a9.9 9.9 0 0 0-2.93-6.96ZM12.03 20.17h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.22 8.22 0 0 1-1.27-4.38c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.28.85 5.83 2.41a8.18 8.18 0 0 1 2.39 5.82c0 4.54-3.69 8.23-8.22 8.23Zm4.51-6.16c-.25-.13-1.47-.73-1.7-.81-.23-.09-.39-.13-.56.12-.17.26-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.42.09-.17.05-.31-.02-.43-.07-.13-.56-1.35-.77-1.84-.2-.48-.4-.41-.56-.42h-.48c-.17 0-.43.06-.65.31-.22.26-.85.83-.85 2.02 0 1.19.87 2.35.99 2.51.12.17 1.7 2.59 4.12 3.63.57.25 1.02.4 1.37.52.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.68-1.17.21-.57.21-1.06.15-1.17-.06-.11-.22-.17-.47-.29Z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{areas.length > 0 ? areas.join(', ') : '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-300">{total}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-green-400">{kk.greenCount}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-amber-400">{moderateRisk}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-400">{atRisk}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-300">{activePct}%</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-300">{absentLast} / {total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">No KKs match your filters.</p>
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
