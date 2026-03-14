'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import YuvakTable from '@/components/YuvakTable';
import StatsCard from '@/components/StatsCard';
import { getAttendanceStatus, getPastDates } from '@/lib/analytics';

export default function YuvaksPage() {
  const { data, loading, error, refresh } = useSheetData();
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('yes');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={refresh} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg text-sm">Retry</button>
      </div>
    </div>
  );

  if (!data) return null;

  const { yuvaks, dates } = data;
  const pastDates = getPastDates(dates);
  // Exclude dates where no yuvak attended (e.g. today's Sabha not recorded yet)
  const activePastDates = pastDates.filter((d) => yuvaks.some((y) => y.dateAttendance[d]));

  const green = yuvaks.filter((y) => getAttendanceStatus(y, pastDates) === 'green').length;
  const yellow = yuvaks.filter((y) => getAttendanceStatus(y, pastDates) === 'yellow').length;
  const red = yuvaks.filter((y) => getAttendanceStatus(y, pastDates) === 'red').length;
  const cnCount = yuvaks.filter((y) => y.sabhaType === 'Chirag Nagar').length;
  const kishorCount = yuvaks.filter((y) => y.sabhaType === 'Chirag Nagar(Kishor)').length;

  const filteredYuvaks = yuvaks.filter((y) => {
    const byAttending = attendingFilter === 'all' ? true : attendingFilter === 'yes' ? y.attendingSabha : !y.attendingSabha;
    return byAttending;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Yuvak Directory</h1>
          <p className="text-slate-500 text-sm mt-1">All yuvaks across both sabhas with attendance status</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Attending filter */}
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs font-medium w-full sm:w-auto">
            {(['yes', 'no', 'all'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setAttendingFilter(v)}
                className={`px-3 py-1.5 transition-colors ${
                  attendingFilter === v
                    ? v === 'yes' ? 'bg-green-700/60 text-green-200'
                      : v === 'no' ? 'bg-red-700/60 text-red-200'
                      : 'bg-slate-600 text-slate-100'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {v === 'all' ? 'All' : v === 'yes' ? '✓ Attending' : '✗ Not Attending'}
              </button>
            ))}
          </div>
          <button onClick={refresh} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg self-start">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Total Yuvaks" value={yuvaks.length} icon="👥" accent="orange" />
        <StatsCard title="Chirag Nagar" value={cnCount} icon="🏛" accent="blue" />
        <StatsCard title="Kishor Sabha" value={kishorCount} icon="📚" accent="blue" />
        <StatsCard title="Active" value={green} icon="✅" accent="green" />
        <StatsCard title="Need Follow-Up" value={yellow + red} icon="⚠️" accent="red" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span><strong className="text-green-400">Active (Green)</strong> — Attended within last 3 sabhas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
          <span><strong className="text-yellow-400">Attention (Yellow)</strong> — Absent last 3 sabhas, attended within 6</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
          <span><strong className="text-red-400">Absent (Red)</strong> — Absent for 6+ consecutive sabhas</span>
        </div>
      </div>

      {/* Full table */}
      <YuvakTable yuvaks={filteredYuvaks} dates={activePastDates} showSabhaType={true} />
    </div>
  );
}

