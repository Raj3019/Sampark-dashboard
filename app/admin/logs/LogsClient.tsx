'use client';

import { useState, useEffect, useCallback } from 'react';

type ActivityLog = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-red-400',
  leader: 'text-blue-400',
  kk: 'text-green-400',
};

function formatUA(ua: string | null): string {
  if (!ua) return '—';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Safari/i.test(ua)) return 'Safari';
  if (/Edge/i.test(ua)) return 'Edge';
  return ua.slice(0, 30);
}

export default function LogsClient() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/logs?limit=100');
      if (!res.ok) throw new Error('Failed to load logs');
      const data = await res.json() as { logs: ActivityLog[]; total: number };
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Login Activity</h1>
          <p className="text-slate-500 text-sm mt-1">
            {total} total login event{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Action</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">IP</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Browser</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-slate-200 font-medium">{log.userName ?? '—'}</p>
                    <p className="text-slate-500 text-xs">{log.userEmail ?? ''}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium capitalize ${ROLE_COLORS[log.userRole ?? ''] ?? 'text-slate-400'}`}>
                      {log.userRole ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
                      ↗ {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs font-mono">{log.ipAddress ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{formatUA(log.userAgent)}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">No activity logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
