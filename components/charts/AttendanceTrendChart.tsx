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
import { SabhaSessionStat, SessionMeta } from '@/lib/types';
import { useTheme } from '@/components/ThemeProvider';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function parseDate(d: string): Date {
  const c = d.replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_m, day, mon, yr) => `${mon} ${day} 20${yr}`);
  return new Date(c);
}

type Mode = 'attending' | 'nonAttending' | 'all';
type Range = '1m' | '3m' | '6m' | 'all';
type View = 'total' | 'areaSplit';

const AREA_PALETTE = [
  'rgba(56,189,248,0.82)',
  'rgba(34,197,94,0.82)',
  'rgba(249,115,22,0.82)',
  'rgba(168,85,247,0.82)',
  'rgba(236,72,153,0.82)',
  'rgba(14,165,233,0.82)',
];
const MAX_VISIBLE_AREAS = 3;

interface Props {
  sessionTrend: SabhaSessionStat[];
  sabhaLabel: string;
  totalYuvaks?: number;
  chartType?: 'bar' | 'line';
  sessionMetaByDate?: Record<string, SessionMeta | undefined>;
}

export default function AttendanceTrendChart({
  sessionTrend,
  sabhaLabel,
  totalYuvaks = 0,
  sessionMetaByDate,
}: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [mode, setMode] = useState<Mode>('attending');
  const [range, setRange] = useState<Range>('3m');
  const [view, setView] = useState<View>('areaSplit');

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoffMap: Record<Range, Date> = {
      '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
      '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
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
  const shouldShowEveryDateLabel = labels.length <= 10;
  const skipN = shouldShowEveryDateLabel
    ? 1
    : labels.length > 60
      ? 10
      : labels.length > 40
        ? 6
        : labels.length > 25
          ? 4
          : labels.length > 12
            ? 2
            : 1;
  const isStacked = mode === 'all';
  const isAreaSplit = mode === 'attending' && view === 'areaSplit';
  const areaTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filtered.forEach((session) => {
      (session.areaBreakdown ?? []).forEach((row) => {
        if (row.attended <= 0) return;
        totals.set(row.area, (totals.get(row.area) ?? 0) + row.attended);
      });
    });
    return totals;
  }, [filtered]);

  const sortedAreas = useMemo(
    () => Array.from(areaTotals.entries()).sort((a, b) => b[1] - a[1]).map(([area]) => area),
    [areaTotals]
  );
  const visibleAreas = useMemo(() => sortedAreas.slice(0, MAX_VISIBLE_AREAS), [sortedAreas]);
  const hasOtherAreas = sortedAreas.length > visibleAreas.length;
  const areaNames = useMemo(
    () => (hasOtherAreas ? [...visibleAreas, 'Others'] : visibleAreas),
    [visibleAreas, hasOtherAreas]
  );
  const areaColorMap = useMemo(() => {
    const map = new Map<string, string>();
    visibleAreas.forEach((area, i) => map.set(area, AREA_PALETTE[i % AREA_PALETTE.length]));
    if (hasOtherAreas) map.set('Others', 'rgba(148,163,184,0.72)');
    return map;
  }, [visibleAreas, hasOtherAreas]);

  const textPrimary = isLight ? '#334155' : '#94a3b8';
  const textSecondary = isLight ? '#475569' : '#64748b';
  const gridColor = isLight ? '#dbe4ef' : '#1e293b';
  const tooltipBg = isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.96)';
  const tooltipTitle = isLight ? '#0f172a' : '#f1f5f9';
  const tooltipBody = isLight ? '#334155' : '#94a3b8';
  const tooltipBorder = isLight ? '#cbd5e1' : '#475569';

  const chartData =
    isAreaSplit
      ? {
          labels,
          datasets: areaNames.map((area) => ({
            label: area,
            data: filtered.map((s) => {
              const rows = s.areaBreakdown ?? [];
              if (area === 'Others') {
                return rows
                  .filter((x) => !visibleAreas.includes(x.area))
                  .reduce((sum, x) => sum + x.attended, 0);
              }
              return rows.find((x) => x.area === area)?.attended ?? 0;
            }),
            backgroundColor: areaColorMap.get(area) ?? 'rgba(148,163,184,0.72)',
            borderRadius: 3,
            borderSkipped: false as const,
            borderWidth: 0,
            barPercentage: 0.72,
            categoryPercentage: 0.68,
          })),
        }
      : mode === 'nonAttending'
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
        display: isStacked || isAreaSplit,
        position: 'top' as const,
        align: 'center' as const,
        labels: {
          color: textPrimary,
          font: { size: 11 },
          usePointStyle: true,
          pointStyleWidth: 9,
          boxHeight: 7,
          boxWidth: 12,
          padding: 14,
        },
      },
      tooltip: {
        position: 'nearest' as const,
        yAlign: 'bottom' as const,
        xAlign: 'center' as const,
        backgroundColor: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.98)',
        titleColor: tooltipTitle,
        bodyColor: isLight ? '#334155' : '#cbd5e1',
        borderColor: tooltipBorder,
        borderWidth: 1,
        cornerRadius: 12,
        padding: { top: 10, right: 12, bottom: 10, left: 12 },
        caretPadding: 8,
        titleMarginBottom: 6,
        bodySpacing: 2,
        footerMarginTop: 0,
        titleAlign: 'left' as const,
        bodyAlign: 'left' as const,
        footerAlign: 'left' as const,
        titleFont: { size: 14, weight: 700 },
        bodyFont: { size: 12, weight: 500 },
        footerFont: { size: 11, weight: 600 },
        displayColors: false,
        callbacks: {
          title: (items: Array<{ dataIndex: number }>) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return '';
            return filtered[idx]?.date ?? '';
          },
          label: (ctx: { dataset: { label?: string }; dataIndex: number }) => {
            const s = filtered[ctx.dataIndex];
            if (isAreaSplit) {
              const areaLabel = ctx.dataset.label ?? 'Area';
              const areaCount =
                areaLabel === 'Others'
                  ? (s.areaBreakdown ?? [])
                      .filter((x) => !visibleAreas.includes(x.area))
                      .reduce((sum, x) => sum + x.attended, 0)
                  : s.areaBreakdown?.find((x) => x.area === areaLabel)?.attended ?? 0;
              const areaPct = s.count > 0 ? Math.round((areaCount / s.count) * 100) : 0;
              return `${areaLabel}: ${areaCount} (${areaPct}%)`;
            }
            if (ctx.dataset.label === 'Not Attending') {
              const nonAttending = Math.max(totalYuvaks - s.count, 0);
              const pct = totalYuvaks > 0 ? Math.round((nonAttending / totalYuvaks) * 100) : 0;
              return `Not attending  ${nonAttending}${totalYuvaks > 0 ? `/${totalYuvaks}` : ''}  (${pct}%)`;
            }
            return `Attendance  ${s.count}${totalYuvaks > 0 ? `/${totalYuvaks}` : ''}  (${s.percentage}%)`;
          },
          afterBody: (items: Array<{ dataIndex: number }>) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return [];

            const session = filtered[idx];
            const meta = sessionMetaByDate?.[session.date];
            const vakta = meta?.vakta?.trim() || 'Not added yet';
            const topic = meta?.topic?.trim() || 'Not added yet';
            const lines: string[] = ['', `Vakta: ${vakta}`, `Topic: ${topic}`];

            return lines;
          },
          footer: (items: Array<{ dataIndex: number }>) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return '';
            const session = filtered[idx];
            const areas = session?.areaBreakdown?.length ?? 0;
            if (!session || areas === 0) return '';

            const remaining = Math.max(areas - 3, 0);
            return remaining > 0 ? `+${remaining} more area${remaining > 1 ? 's' : ''}` : '';
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
          maxRotation: 50,
          font: { size: 9 },
          autoSkip: true,
          maxTicksLimit: 7,
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
    // { key: 'nonAttending', label: 'Not Attending' },
    // { key: 'all', label: 'All' },
  ];

  const rangeBtns: { key: Range; label: string }[] = [
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: '6m', label: '6M' },
    { key: 'all', label: 'All' },
  ];

  const viewBtns: { key: View; label: string }[] = [
    { key: 'total', label: 'Total' },
    { key: 'areaSplit', label: 'Area Split' },
  ];

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-800/85 p-4 sm:p-5 shadow-[0_10px_30px_rgba(2,6,23,0.25)] backdrop-blur-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-slate-100 text-2xl sm:text-xl font-bold tracking-tight">{sabhaLabel} - Attendance Trend</h3>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} sessions shown</p>
        </div>
        <span className="text-orange-400 text-sm font-semibold bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/30 shrink-0 self-start sm:self-auto">
          Avg {avgPct}%
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {mode === 'attending' && (
            <div className="flex bg-slate-900/60 rounded-lg p-0.5">
              {viewBtns.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setView(b.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    view === b.key ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex bg-slate-900/60 rounded-lg p-0.5">
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
      </div>

      <div className="h-56 sm:h-64 rounded-xl bg-slate-900/20 px-2 py-1">
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
