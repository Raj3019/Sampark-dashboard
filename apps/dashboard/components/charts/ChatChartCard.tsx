'use client';

import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  BarElement,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { ChartSpec } from '@/lib/ai/types';
import { useTheme } from '@/components/ThemeProvider';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

const FALLBACK_COLORS = ['#f97316', '#22c55e', '#ef4444', '#3b82f6'];

export default function ChatChartCard({ chart }: { chart: ChartSpec }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const datasets = chart.series.map((series, idx) => ({
    label: series.name,
    data: series.data,
    borderColor: series.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    backgroundColor: (series.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]) + (chart.type === 'line' ? '33' : 'cc'),
    borderWidth: 2,
    fill: chart.type === 'line',
    tension: 0.3,
  }));

  const data = {
    labels: chart.labels,
    datasets,
  };

  const textPrimary = isLight ? '#334155' : '#cbd5e1';
  const textSecondary = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? '#dbe4ef' : '#1e293b';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: textPrimary, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: isLight ? '#ffffff' : '#0f172a',
        titleColor: isLight ? '#0f172a' : '#f8fafc',
        bodyColor: isLight ? '#334155' : '#cbd5e1',
        borderColor: isLight ? '#cbd5e1' : '#334155',
        borderWidth: 1,
      },
    },
    scales: chart.type === 'pie'
      ? undefined
      : {
          x: {
            grid: { color: gridColor },
            ticks: { color: textSecondary, maxRotation: 45, font: { size: 10 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textSecondary, font: { size: 10 } },
            beginAtZero: true,
          },
        },
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 mt-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-sm font-semibold text-slate-100">{chart.title}</p>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-400 uppercase">
          {chart.type}
        </span>
      </div>
      <div className="h-72">
        {chart.type === 'pie' && <Pie data={data} options={options} />}
        {chart.type === 'bar' && <Bar data={data} options={options} />}
        {chart.type === 'line' && <Line data={data} options={options} />}
      </div>
    </div>
  );
}
