'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Yuvak } from '@/lib/types';
import ContactActions from '@/components/ContactActions';

type FollowUpKkSummaryProps = {
  yuvaks: Yuvak[];
  dates: string[];
  sabhaLabel?: string;
};

function normalizeKkName(value: string) {
  return value.trim().toLowerCase();
}

function getRiskLabel(yuvak: Yuvak, dates: string[]) {
  const last1 = dates.slice(-1);
  const last2 = dates.slice(-2);
  const last4 = dates.slice(-4);

  if (last4.length === 4 && last4.every((date) => !yuvak.dateAttendance[date])) {
    return 'High Risk';
  }

  if (last2.length === 2 && last2.every((date) => !yuvak.dateAttendance[date])) {
    return 'Moderate Risk';
  }

  if (last1.length === 1 && last1.every((date) => !yuvak.dateAttendance[date])) {
    return 'Low Risk';
  }

  return 'Regular';
}

function getRiskClass(risk: string) {
  if (risk === 'High Risk') return 'bg-red-500/10 text-red-500 border-red-500/25';
  if (risk === 'Moderate Risk') return 'bg-amber-500/10 text-amber-600 border-amber-500/25';
  if (risk === 'Low Risk') return 'bg-blue-500/10 text-blue-500 border-blue-500/25';
  return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25';
}

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FollowUpKkSummary({ yuvaks, dates, sabhaLabel = 'Sabha' }: FollowUpKkSummaryProps) {
  const kkOptions = useMemo(
    () => Array.from(new Set(yuvaks.map((yuvak) => yuvak.followUpKK?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b)),
    [yuvaks]
  );
  const [selectedKk, setSelectedKk] = useState(kkOptions[0] ?? '');
  const consideredDates = dates.slice(-4);

  const selectedRows = useMemo(() => {
    const selected = normalizeKkName(selectedKk);
    if (!selected) return [];

    return yuvaks
      .filter((yuvak) => normalizeKkName(yuvak.followUpKK ?? '') === selected)
      .map((yuvak) => {
        const missedDates = consideredDates.filter((date) => !yuvak.dateAttendance[date]);
        const risk = getRiskLabel(yuvak, dates);

        return {
          yuvak,
          risk,
          missedDates,
          missedCount: missedDates.length,
          sabha: yuvak.sabhaType,
        };
      })
      .sort((a, b) => b.missedCount - a.missedCount || a.yuvak.name.localeCompare(b.yuvak.name));
  }, [consideredDates, dates, selectedKk, yuvaks]);

  if (kkOptions.length === 0) return null;

  const handleDownload = () => {
    const rows = selectedRows.map((row) => ({
      'Yuvak Name': row.yuvak.name,
      'Follow-up KK': row.yuvak.followUpKK || selectedKk,
      Sabha: row.sabha,
      Risk: row.risk,
      'Absent Count': row.missedCount,
      'Missed Sabha Dates': row.missedDates.join(' | ') || 'None',
      Phone: row.yuvak.phoneNumber || '',
    }));

    const safeName = selectedKk.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    downloadCsv(`${safeName || 'follow-up-kk'}-${sabhaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, rows);
  };

  return (
    <div className="rounded-xl border border-[#e7e0d6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(31,41,55,0.05)] dark:border-slate-700 dark:bg-slate-900/45 dark:shadow-none">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6f47] dark:text-slate-500">Follow-up KK view</p>
          <h3 className="mt-1 text-base font-semibold text-[#1f2937] dark:text-slate-100">All assigned yuvaks in one place</h3>
          <p className="mt-1 text-xs text-[#64748b] dark:text-slate-400">
            Absent count is based on the latest {consideredDates.length} recorded sabha{consideredDates.length === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedKk}
            onChange={(event) => setSelectedKk(event.target.value)}
            className="min-w-56 rounded-xl border border-[#d8cdbd] bg-white px-3 py-2 text-sm font-medium text-[#1f2937] outline-none focus:border-orange-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {kkOptions.map((kkName) => (
              <option key={kkName} value={kkName}>{kkName}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDownload}
            disabled={selectedRows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#ece4d7] dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f5efe6] dark:bg-slate-900/80">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b] dark:text-slate-400">Yuvak</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b] dark:text-slate-400">Risk</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b] dark:text-slate-400">Absent</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b] dark:text-slate-400">Missed Sabhas</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b] dark:text-slate-400">Sabha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ece4d7] dark:divide-slate-800">
            {selectedRows.map((row) => (
              <tr key={`${row.yuvak.sabhaType}-${row.yuvak.name}`} className="bg-white/50 dark:bg-slate-900/20">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1f2937] dark:text-slate-100">{row.yuvak.name}</span>
                    <ContactActions name={row.yuvak.name} phoneNumber={row.yuvak.phoneNumber} size="xs" />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getRiskClass(row.risk)}`}>
                    {row.risk}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold tabular-nums text-[#1f2937] dark:text-slate-100">{row.missedCount}</td>
                <td className="px-3 py-2.5 text-xs text-[#475569] dark:text-slate-300">{row.missedDates.join(', ') || 'None'}</td>
                <td className="px-3 py-2.5 text-xs text-[#475569] dark:text-slate-300">{row.sabha}</td>
              </tr>
            ))}
            {selectedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-[#64748b] dark:text-slate-400">
                  No yuvaks found for this KK.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
