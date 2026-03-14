'use client';

import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { SabhaSessionStat } from '@/lib/types';
import { useTheme } from '@/components/ThemeProvider';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function parseDate(d: string): Date {
  const c = d.replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_m, day, mon, yr) => `${mon} ${day} 20${yr}`);
  return new Date(c);
}

type Mode = 'attending' | 'nonAttending' | 'all';
type Range = '1m' | '3m' | '6m' | '1y' | 'all';

interface Props {
  sessionTrend: SabhaSessionStat[];
  sabhaLabel: string;
  totalYuvaks?: number;
  chartType?: 'bar' | 'line';
}

export default function AttendanceTrendChart({ sessionTrend, sabhaLabel, totalYuvaks = 0 }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [mode, setMode] = useState<Mode>('attending');
  const [range, setRange] = useState<Range>('3m');

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoffMap: Record<Range, Date> = {
      '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
      '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
      '1y': new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
      'all': new Date(0),
    };
    return sessionTrend
      .filter((s) => parseDate(s.date) >= cutoffMap[range])
      .filter((s) => s.count > 0 || mode === 'nonAttending');
  }, [sessionTrend, range, mode]);

  const labels = filtered.map((s) => s.date);
  const attending = filtered.map((s) => s.count);
  const absent = filtered.map((s) => totalYuvaks - s.count);
  const pcts = filtered.map((s) => s.percentage);
  const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const skipN = labels.length > 60 ? 10 : labels.length > 40 ? 6 : labels.length > 25 ? 4 : labels.length > 12 ? 2 : 1;
  const isStacked = mode === 'all';

  const textPrimary = isLight ? '#334155' : '#94a3b8';
  const textSecondary = isLight ? '#475569' : '#64748b';
  const gridColor = isLight ? '#dbe4ef' : '#1e293b';
  const tooltipBg = isLight ? '#ffffff' : '#1e293b';
  const tooltipTitle = isLight ? '#0f172a' : '#f1f5f9';
  const tooltipBody = isLight ? '#334155' : '#94a3b8';
  const tooltipBorder = isLight ? '#cbd5e1' : '#334155';

  const chartData =
    mode === 'nonAttending'
      ? {
          labels,
          datasets: [{ label: 'Not Attending', data: absent, backgroundColor: 'rgba(239,68,68,0.65)', borderRadius: 3 }],
        }
      : mode === 'all'
      ? {
          labels,
          datasets: [
            { label: 'Attending', data: attending, backgroundColor: 'rgba(34,197,94,0.75)', stack: 'stack' },
            { label: 'Not Attending', data: absent, backgroundColor: 'rgba(239,68,68,0.28)', stack: 'stack' },
          ],
        }
      : {
          labels,
          datasets: [{
            label: 'Attending',
            data: attending,
            backgroundColor: attending.map((_, i) =>
              pcts[i] >= avgPct ? 'rgba(249,115,22,0.88)' : 'rgba(249,115,22,0.45)'
            ),
            borderRadius: 3,
          }],
        };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: isStacked,
        labels: { color: textPrimary, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        borderColor: tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; dataIndex: number }) => {
            const s = filtered[ctx.dataIndex];
            if (ctx.dataset.label === 'Not Attending') {
              return ` ${totalYuvaks - s.count} not attending`;
            }
            return ` ${s.count} attended (${s.percentage}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: isStacked,
        grid: { display: false },
        ticks: {
          color: textSecondary,
          maxRotation: 45,
          font: { size: 10 },
          autoSkip: false,
          callback: (_value: number | string, i: number) => (i % skipN === 0 ? labels[i] : null),
        },
      },
      y: {
        stacked: isStacked,
        grid: { color: gridColor },
        ticks: { color: textSecondary, font: { size: 11 } },
        beginAtZero: true,
      },
    },
  };

  const modeBtns: { key: Mode; label: string }[] = [
    { key: 'attending', label: 'Attending' },
    { key: 'nonAttending', label: 'Not Attending' },
    { key: 'all', label: 'All' },
  ];

  const rangeBtns: { key: Range; label: string }[] = [
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: '1y', label: '1Y' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-slate-100 font-semibold">{sabhaLabel} - Attendance Trend</h3>
          <p className="text-slate-500 text-xs mt-0.5">{filtered.length} sessions shown</p>
        </div>
        <span className="text-orange-500 text-sm font-medium bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 shrink-0">
          Avg {avgPct}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-slate-900/60 rounded-lg p-0.5">
          {modeBtns.map((b) => (
            <button
              key={b.key}
              onClick={() => setMode(b.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === b.key ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-900/60 rounded-lg p-0.5 ml-auto">
          {rangeBtns.map((b) => (
            <button
              key={b.key}
              onClick={() => setRange(b.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                range === b.key ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No sessions in this range.
          </div>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </div>
  );
}
