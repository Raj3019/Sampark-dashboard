'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

type SyncAlert = {
  id: string;
  source: string;
  kind: string;
  sabha_type: string;
  sampark_sabha: string | null;
  member_name: string | null;
  refDate: string | null;
  message: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

const KIND_LABELS: Record<string, string> = {
  unknown_name: 'Unknown Name',
  mark_conflict: 'Mark Conflict',
};

const KIND_BADGES: Record<string, string> = {
  unknown_name: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  mark_conflict: 'bg-red-500/15 text-red-300 border-red-500/30',
};

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<SyncAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'unknown_name' | 'mark_conflict'>('all');
  const [sabhaFilter, setSabhaFilter] = useState('all');

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alerts');
      if (!res.ok) throw new Error('Failed to load alerts');
      const data = await res.json() as SyncAlert[];
      setAlerts(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const sabhaOptions = useMemo(
    () => Array.from(new Set(alerts.map((alert) => alert.sabha_type))).sort(),
    [alerts]
  );

  const filteredAlerts = useMemo(
    () => alerts.filter((alert) => {
      const matchesKind = kindFilter === 'all' || alert.kind === kindFilter;
      const matchesSabha = sabhaFilter === 'all' || alert.sabha_type === sabhaFilter;
      return matchesKind && matchesSabha;
    }),
    [alerts, kindFilter, sabhaFilter]
  );

  const stats = useMemo(() => ({
    open: alerts.length,
    unknownNames: alerts.filter((alert) => alert.kind === 'unknown_name').length,
    markConflicts: alerts.filter((alert) => alert.kind === 'mark_conflict').length,
  }), [alerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const handleDismiss = async (alert: SyncAlert) => {
    setDismissingId(alert.id);
    setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [alert.id] }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to dismiss alert');
      toast.success('Alert dismissed');
    } catch (err) {
      setAlerts((prev) => [...prev, alert].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss alert');
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_10px_30px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Sync Alerts</h1>
            <p className="mt-1 text-sm text-slate-500">Issues detected during Sampark sync and cross-verification</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full sm:w-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Open', value: stats.open, accent: 'orange' },
            { label: 'Unknown Names', value: stats.unknownNames, accent: 'amber' },
            { label: 'Mark Conflicts', value: stats.markConflicts, accent: 'red' },
          ].map((chip) => (
            <div key={chip.label} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{chip.label}</p>
              <p className={`mt-2 text-2xl font-bold ${chip.accent === 'amber' ? 'text-amber-400' : chip.accent === 'red' ? 'text-red-400' : 'text-orange-400'}`}>
                {chip.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-1 lg:max-w-xl">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as 'all' | 'unknown_name' | 'mark_conflict')}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Kinds</option>
              <option value="unknown_name">Unknown Names</option>
              <option value="mark_conflict">Mark Conflicts</option>
            </select>
            <select
              value={sabhaFilter}
              onChange={(e) => setSabhaFilter(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Sabhas</option>
              {sabhaOptions.map((sabha) => (
                <option key={sabha} value={sabha}>{sabha}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500">
            Showing <span className="text-slate-300 font-medium">{filteredAlerts.length}</span> of <span className="text-slate-300 font-medium">{alerts.length}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : filteredAlerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-12 text-center shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
          <p className="text-slate-300 font-medium">No open alerts — everything matches.</p>
          <p className="mt-1 text-xs text-slate-500">Sync issues show up here after the next sync run.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
          <div className="overflow-x-auto">
            <table style={{ minWidth: 1120 }} className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Kind</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Sabha</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Member</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Message</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Detected</th>
                  <th className="text-right px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4">
                      {KIND_LABELS[alert.kind] ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${KIND_BADGES[alert.kind] || 'bg-slate-500/15 text-slate-300 border-slate-500/30'}`}>
                          {KIND_LABELS[alert.kind]}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">{alert.kind}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-100">
                      <span className="font-medium">{alert.sabha_type}</span>
                      {alert.sampark_sabha && (
                        <span className="block mt-0.5 text-[11px] text-slate-500">{alert.sampark_sabha}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-200">{alert.member_name ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {alert.refDate
                        ? new Date(`${alert.refDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs max-w-[26rem]">
                      <p className="break-words">{alert.message}</p>
                      {alert.detail ? (
                        <p className="mt-0.5 break-words text-[11px] text-slate-600">
                          {Object.entries(alert.detail)
                            .filter(([, value]) => value !== null && value !== undefined)
                            .map(([key, value]) => `${key}: ${String(value)}`)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {new Date(alert.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDismiss(alert)}
                        disabled={dismissingId === alert.id}
                        className="inline-flex items-center rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                      >
                        {dismissingId === alert.id ? '...' : 'Dismiss'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
