'use client';

import { useState, useEffect, useCallback } from 'react';

type SheetChange = {
  id: string;
  sabhaType: string;
  changeType: string;
  description: string;
  detectedAt: string;
};

const CHANGE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  yuvak_added:        { label: 'Added',            color: 'bg-green-500/15 text-green-400 border-green-500/30',  icon: '＋' },
  yuvak_removed:      { label: 'Removed',          color: 'bg-red-500/15 text-red-400 border-red-500/30',        icon: '－' },
  attendance_marked:  { label: 'Present',          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     icon: '✓' },
  attendance_unmarked:{ label: 'Absent',           color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: '✗' },
  field_changed:      { label: 'Field Updated',    color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: '✎' },
};

const SABHA_COLORS: Record<string, string> = {
  'Chirag Nagar':        'text-blue-400',
  'Chirag Nagar(Kishor)':'text-purple-400',
  'Bal Sabha':           'text-orange-400',
};

export default function SheetChangesClient() {
  const [changes, setChanges] = useState<SheetChange[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const fetchChanges = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/sheet-changes?limit=200');
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to load changes');
      }
      const data = await res.json() as { changes: SheetChange[]; total: number };
      setChanges(data.changes);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChanges(); }, [fetchChanges]);

  const filtered = filter === 'all' ? changes : changes.filter((c) => c.changeType === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sheet Change History</h1>
          <p className="text-slate-500 text-sm mt-1">
            Changes detected automatically on each data refresh · {total} total change{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchChanges}
          className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors self-start sm:self-auto"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'yuvak_added', label: 'Added' },
          { key: 'yuvak_removed', label: 'Removed' },
          { key: 'attendance_marked', label: 'Present' },
          { key: 'attendance_unmarked', label: 'Absent' },
          { key: 'field_changed', label: 'Field Updates' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === key
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <p className="text-red-400 text-sm font-medium mb-1">Failed to load change history</p>
          <p className="text-red-300/70 text-xs">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
          <p className="text-slate-400 text-sm">No changes recorded yet.</p>
          <p className="text-slate-600 text-xs mt-1">
            Changes are detected automatically each time the sheet data refreshes (every 60s).
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Sabha</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Description</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filtered.map((change) => {
                const cfg = CHANGE_TYPE_CONFIG[change.changeType] ?? { label: change.changeType, color: 'bg-slate-700 text-slate-300 border-slate-600', icon: '?' };
                return (
                  <tr key={change.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                        <span>{cfg.icon}</span> {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium ${SABHA_COLORS[change.sabhaType] ?? 'text-slate-400'}`}>
                        {change.sabhaType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{change.description}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(change.detectedAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
