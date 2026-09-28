'use client';

import { useMemo, useState } from 'react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export interface VaktaTopicTrendPoint {
  date: string;
  vakta: string;
  topic: string;
  attendanceCount: number;
  attendancePct: number;
}

interface Props {
  points: VaktaTopicTrendPoint[];
  totalYuvaks: number;
  scopeNote?: string;
  comparisonPoints?: VaktaTopicTrendPoint[];
  comparisonTotalYuvaks?: number;
  primaryLabel?: string;
  comparisonLabel?: string;
}

type TrendRange = '1m' | '3m';
type ScopeView = 'primary' | 'comparison';

function truncateText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function parseDate(d: string): Date {
  const normalized = d.replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`);
  return new Date(normalized);
}

function getRangeCutoff(range: TrendRange): Date {
  const now = new Date();

  // Use rolling day windows.
  // 1M: last 30 days from now.
  // 3M: last 90 days from now.
  if (range === '1m') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    return cutoff;
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 90);
  return cutoff;
}

export default function VaktaTopicTrendChart({
  points,
  totalYuvaks,
  scopeNote,
  comparisonPoints,
  comparisonTotalYuvaks,
  primaryLabel = 'Your Yuvak Performance',
  comparisonLabel = 'Sabha Performance',
}: Props) {
  const [range, setRange] = useState<TrendRange>('3m');
  const [scopeView, setScopeView] = useState<ScopeView>('primary');

  const activePoints = scopeView === 'comparison' && comparisonPoints ? comparisonPoints : points;
  const activeTotalYuvaks = scopeView === 'comparison' && comparisonPoints
    ? (comparisonTotalYuvaks ?? totalYuvaks)
    : totalYuvaks;

  const filteredPoints = useMemo(() => {
    const cutoff = getRangeCutoff(range);

    return activePoints.filter((point) => parseDate(point.date) >= cutoff);
  }, [activePoints, range]);

  const sorted = [...filteredPoints].sort((a, b) => a.attendancePct - b.attendancePct);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const hasSinglePoint = filteredPoints.length === 1;

  const labels = filteredPoints.map((p) => p.date);
  const values = filteredPoints.map((p) => p.attendancePct);
  const avgPct = values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
  const xLabelSkipN = labels.length > 14 ? 3 : labels.length > 8 ? 2 : 1;

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Attendance %',
        data: values,
        borderColor: 'rgba(168,85,247,0.95)',
        backgroundColor: 'rgba(168,85,247,0.18)',
        fill: !hasSinglePoint,
        showLine: !hasSinglePoint,
        tension: hasSinglePoint ? 0 : 0.3,
        pointRadius: hasSinglePoint
          ? 5
          : values.map((value) => (value === highest?.attendancePct || value === lowest?.attendancePct ? 5 : 3)),
        pointHoverRadius: 6,
        pointBackgroundColor: values.map((value) => {
          if (value === highest?.attendancePct) return 'rgba(34,197,94,0.95)';
          if (value === lowest?.attendancePct) return 'rgba(234,179,8,0.95)';
          return 'rgba(148,163,184,0.9)';
        }),
        pointBorderColor: '#0f172a',
        pointBorderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.98)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#475569',
        borderWidth: 1,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          title: (items: Array<{ dataIndex: number }>) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return '';
            return filteredPoints[idx]?.date ?? '';
          },
          label: (ctx: { dataIndex: number }) => {
            const row = filteredPoints[ctx.dataIndex];
            if (!row) return '';
            return `Attendance: ${row.attendanceCount}/${activeTotalYuvaks} (${row.attendancePct}%)`;
          },
          afterBody: (items: Array<{ dataIndex: number }>) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return [];
            const row = filteredPoints[idx];
            if (!row) return [];
            return [
              `Vakta: ${truncateText(row.vakta, 42)}`,
              `Topic: ${truncateText(row.topic, 56)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#64748b',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
          font: { size: 9 },
          callback: (_value: number | string, index: number) => (index % xLabelSkipN === 0 ? labels[index] : ''),
        },
      },
      y: {
        beginAtZero: true,
        max: 100,
        grid: { color: '#1e293b' },
        ticks: {
          color: '#64748b',
          callback: (value: number | string) => `${value}%`,
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-slate-800 p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-slate-100 font-semibold">Vakta & Topic Performance ({range === '1m' ? 'Last 1 Month' : 'Last 3 Months'})</h3>
          <p className="text-slate-500 text-xs mt-0.5">Attendance trend by each sabha session</p>
          {scopeNote && <p className="text-[11px] text-slate-400 mt-1">{scopeNote}</p>}
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          {comparisonPoints && (
            <div className="grid w-full grid-cols-2 rounded-lg border border-slate-700 bg-slate-900/60 p-0.5 text-xs font-medium lg:w-auto lg:flex">
              {([
                { key: 'primary', label: primaryLabel },
                { key: 'comparison', label: comparisonLabel },
              ] as const).map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setScopeView(btn.key)}
                  className={`px-2.5 py-1 rounded-md transition-colors text-center ${
                    scopeView === btn.key ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end">
            <div className="flex rounded-lg border border-slate-700 bg-slate-900/60 p-0.5 text-xs font-medium">
              {([
                { key: '1m', label: '1M' },
                { key: '3m', label: '3M' },
              ] as const).map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setRange(btn.key)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    range === btn.key ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
              Avg {avgPct}%
            </span>
          </div>
        </div>
      </div>

      {filteredPoints.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-8 text-center text-slate-500 text-sm">
          No tracked sessions found in the selected range.
        </div>
      ) : (
        <>
          <div className="h-56 sm:h-64 rounded-xl bg-slate-900/30 px-2 py-1">
            <Line data={chartData} options={options} />
          </div>

          {highest && lowest && !hasSinglePoint && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                <p className="text-[11px] uppercase tracking-wide text-green-300">Highest Attendance</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {highest.date} · {highest.attendanceCount}/{activeTotalYuvaks} ({highest.attendancePct}%)
                </p>
                <p className="mt-1 text-xs text-slate-300">Vakta: {highest.vakta}</p>
                <p className="text-xs text-slate-400">Topic: {highest.topic}</p>
              </div>
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                <p className="text-[11px] uppercase tracking-wide text-yellow-300">Lowest Attendance</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  {lowest.date} · {lowest.attendanceCount}/{activeTotalYuvaks} ({lowest.attendancePct}%)
                </p>
                <p className="mt-1 text-xs text-slate-300">Vakta: {lowest.vakta}</p>
                <p className="text-xs text-slate-400">Topic: {lowest.topic}</p>
              </div>
            </div>
          )}

          {highest && hasSinglePoint && (
            <div className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
              <p className="text-[11px] uppercase tracking-wide text-sky-300">Only Session In Selected Range</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {highest.date} · {highest.attendanceCount}/{activeTotalYuvaks} ({highest.attendancePct}%)
              </p>
              <p className="mt-1 text-xs text-slate-300">Vakta: {highest.vakta}</p>
              <p className="text-xs text-slate-400">Topic: {highest.topic}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
