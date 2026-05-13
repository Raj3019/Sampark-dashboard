'use client';

import { useState, useMemo } from 'react';
import { Yuvak, AttendanceStatus } from '@/lib/types';
import { getDirectoryRiskStatus } from '@/lib/analytics';
import ContactActions from '@/components/ContactActions';

function InlineStatusBadge({ status }: { status: AttendanceStatus }) {
  const configs: Record<AttendanceStatus, { label: string; dot: string; bg: string; text: string }> = {
    green:  { label: 'Low Risk', dot: 'bg-green-400', bg: 'bg-green-500/10 border border-green-500/25', text: 'text-green-400' },
    yellow: { label: 'Moderate Risk', dot: 'bg-amber-400', bg: 'bg-amber-500/10 border border-amber-500/25', text: 'text-amber-400' },
    red:    { label: 'High Risk', dot: 'bg-red-400', bg: 'bg-red-500/10 border border-red-500/25', text: 'text-red-400' },
  };
  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

function AttendanceDots({ yuvak, last6 }: { yuvak: Yuvak; last6: string[] }) {
  const count = last6.filter((d) => yuvak.dateAttendance[d]).length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {last6.map((d, i) => (
          <span key={i} title={d}
            className={`w-3.5 h-3.5 rounded-sm ${yuvak.dateAttendance[d] ? 'bg-green-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>
      <span className="text-slate-400 text-xs tabular-nums">{count}/{last6.length}</span>
    </div>
  );
}

function Last3Badge({ yuvak, last3 }: { yuvak: Yuvak; last3: string[] }) {
  const count = last3.filter((d) => yuvak.dateAttendance[d]).length;
  const total = last3.length;
  const cls = count === total ? 'bg-green-500/20 text-green-400'
    : count === 0 ? 'bg-amber-500/20 text-amber-400'
    : 'bg-amber-500/20 text-amber-400';
  return (
    <span className={`inline-flex items-center justify-center min-w-10 h-7 px-1.5 rounded font-bold text-sm tabular-nums ${cls}`}>
      {count}/{total}
    </span>
  );
}

function LastSabhaBadge({ yuvak, lastDate }: { yuvak: Yuvak; lastDate: string | undefined }) {
  if (!lastDate) return <span className="text-slate-600 text-xs">—</span>;
  return yuvak.dateAttendance[lastDate] ? (
    <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium">
      <span>✅</span> Present
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
      <span className="font-bold">✗</span> Absent
    </span>
  );
}

interface Props {
  yuvaks: Yuvak[];
  dates: string[];
  showSabhaType?: boolean;
}

type SortKey = 'name' | 'area' | 'attendance' | 'status' | 'kk';

export default function YuvakTable({ yuvaks, dates, showSabhaType = false }: Props) {
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | 'all'>('all');
  const [filterSabha, setFilterSabha]   = useState<'all' | 'cn' | 'kishor' | 'bal'>('all');
  const [filterKK, setFilterKK]         = useState('all');
  const [dateWindow, setDateWindow]     = useState<'last6' | '1m' | '3m' | 'custom'>('last6');
  const [customFrom, setCustomFrom]     = useState('');
  const [customTo, setCustomTo]         = useState('');
  const [sortKey, setSortKey]           = useState<SortKey>('name');
  const [sortAsc, setSortAsc]           = useState(true);
  const [page, setPage]                 = useState(1);

  const PAGE_SIZE = 20;

  // Parse a "DD-Mon-YY" date string to a Date object
  const parseSheetDate = (d: string) => {
    const cleaned = d
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, (_, day, mon, yr) => `${mon} ${day} ${yr}`)
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_, day, mon, yr) => `${mon} ${day} 20${yr}`);
    return new Date(cleaned);
  };

  // Effective dates based on the selected time window
  const effectiveDates = useMemo(() => {
    if (dateWindow === 'last6') return dates.slice(-6);
    if (dateWindow === 'custom') {
      if (!customFrom && !customTo) return dates;
      return dates.filter((d) => {
        const dt = parseSheetDate(d);
        if (Number.isNaN(dt.getTime())) return false;
        if (customFrom && dt < new Date(customFrom)) return false;
        if (customTo   && dt > new Date(customTo + 'T23:59:59')) return false;
        return true;
      });
    }
    const months = dateWindow === '1m' ? 1 : 3;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return dates.filter((d) => {
      const dt = parseSheetDate(d);
      return !Number.isNaN(dt.getTime()) && dt >= cutoff;
    });
  }, [dates, dateWindow, customFrom, customTo]);

  const dotsDisplay = effectiveDates.slice(-8); // cap at 8 dots for readability
  const last3        = effectiveDates.slice(-3);
  const hasDates     = effectiveDates.length > 0;

  const kkList = useMemo(
    () => ['all', ...Array.from(new Set(yuvaks.map((y) => y.followUpKK).filter(Boolean))).sort()],
    [yuvaks],
  );

  const withStatus = useMemo(
    () => yuvaks.map((y) => ({ ...y, status: getDirectoryRiskStatus(y, effectiveDates) })),
    [yuvaks, effectiveDates],
  );

  // Last Sabha = the most recent date where at least one yuvak actually attended.
  // This skips pre-added future/today columns where attendance hasn't been recorded yet.
  const lastDate = useMemo(
    () => [...effectiveDates].reverse().find((d) => withStatus.some((y) => y.dateAttendance[d]))
          ?? effectiveDates[effectiveDates.length - 1],
    [effectiveDates, withStatus],
  );

  const filtered = withStatus.filter((y) => {
    if (filterStatus !== 'all' && y.status !== filterStatus) return false;
    if (filterSabha === 'cn'     && y.sabhaType !== 'Chirag Nagar') return false;
    if (filterSabha === 'kishor' && y.sabhaType !== 'Chirag Nagar(Kishor)') return false;
    if (filterSabha === 'bal' && y.sabhaType !== 'Bal Sabha') return false;
    if (filterKK !== 'all' && y.followUpKK !== filterKK) return false;
    if (search &&
      !y.name.toLowerCase().includes(search.toLowerCase()) &&
      !y.followUpKK.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusOrder: Record<AttendanceStatus, number> = { red: 0, yellow: 1, green: 2 };
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name':       cmp = a.name.localeCompare(b.name); break;
      case 'area':       cmp = a.area.localeCompare(b.area); break;
      case 'attendance': cmp = a.attendancePercent - b.attendancePercent; break;
      case 'status':     cmp = statusOrder[a.status] - statusOrder[b.status]; break;
      case 'kk':         cmp = a.followUpKK.localeCompare(b.followUpKK); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  };

  const renderSortArrow = (k: SortKey) =>
    sortKey === k
      ? <span className="text-orange-400">{sortAsc ? ' ↑' : ' ↓'}</span>
      : <span className="text-slate-600"> ↕</span>;

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden">

      {/* ── Filters ── */}
      <div className="px-4 py-3 border-b border-slate-700/60 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">🔍</span>
          <input
            type="text"
            placeholder="Search yuvak name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 w-full sm:w-60"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as AttendanceStatus | 'all'); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 w-full sm:w-auto"
        >
          <option value="all">All Status</option>
          <option value="green">Low Risk</option>
          <option value="yellow">Moderate Risk</option>
          <option value="red">High Risk</option>
        </select>
        {showSabhaType && (
          <select
            value={filterSabha}
            onChange={(e) => { setFilterSabha(e.target.value as 'all' | 'cn' | 'kishor' | 'bal'); setPage(1); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 w-full sm:w-auto"
          >
            <option value="all">All Sabhas</option>
            <option value="cn">Chirag Nagar</option>
            <option value="kishor">AYC</option>
            <option value="bal">Bal</option>
          </select>
        )}
        <select
          value={filterKK}
          onChange={(e) => { setFilterKK(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 w-full sm:w-auto"
        >
          {kkList.map((k) => (
            <option key={k} value={k}>{k === 'all' ? 'All KKs' : k}</option>
          ))}
        </select>
        <select
          value={dateWindow}
          onChange={(e) => { setDateWindow(e.target.value as 'last6' | '1m' | '3m' | 'custom'); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 w-full sm:w-auto"
        >
          <option value="last6">Last 6 Sabhas</option>
          <option value="1m">Last 1 Month</option>
          <option value="3m">Last 3 Months</option>
          <option value="custom">Custom Range...</option>
        </select>
        {dateWindow === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 scheme-dark"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 scheme-dark"
            />
          </div>
        )}
        <span className="sm:ml-auto text-slate-500 text-sm">{filtered.length} of {yuvaks.length} yuvaks</span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/50">
              <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-slate-300 whitespace-nowrap"
                  onClick={() => handleSort('status')}>
                Status {renderSortArrow('status')}
              </th>
              <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-slate-300 whitespace-nowrap"
                  onClick={() => handleSort('name')}>
                Name {renderSortArrow('name')}
              </th>
              <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                STD
              </th>
              <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-slate-300 whitespace-nowrap"
                  onClick={() => handleSort('kk')}>
                KK (Follow-Up Person) {renderSortArrow('kk')}
              </th>
              {showSabhaType && (
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Sabha</th>
              )}
              {hasDates ? (
                <>
                  <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                    Last {dotsDisplay.length} Sabhas
                  </th>
                  <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                    Last 3
                  </th>
                  <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                    Last Sabha
                  </th>
                </>
              ) : (
                <th className="text-left px-4 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-slate-300 whitespace-nowrap"
                    onClick={() => handleSort('attendance')}>
                  Attendance {renderSortArrow('attendance')}
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {paginated.map((y, i) => (
              <tr key={`${y.name}-${i}`} className="hover:bg-slate-800/40 transition-colors">

                {/* Status */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <InlineStatusBadge status={y.status} />
                </td>

                {/* Name */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-semibold">{y.name}</span>
                    <ContactActions name={y.name} phoneNumber={y.phoneNumber} size="xs" />
                  </div>
                </td>

                {/* STD */}
                <td className="px-4 py-3.5">
                  {y.std
                    ? <span className="text-xs px-2 py-0.5 rounded bg-slate-700/80 text-slate-300 font-medium whitespace-nowrap">Std {y.std}</span>
                    : <span className="text-slate-600 text-xs">—</span>
                  }
                </td>

                {/* KK */}
                <td className="px-4 py-3.5 text-slate-300">{y.followUpKK || '—'}</td>

                {/* Sabha type */}
                {showSabhaType && (
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      y.sabhaType === 'Chirag Nagar(Kishor)'
                        ? 'bg-purple-500/20 text-purple-400'
                        : y.sabhaType === 'Bal Sabha'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {y.sabhaType === 'Chirag Nagar(Kishor)' ? 'AYC' : y.sabhaType === 'Bal Sabha' ? 'Bal' : 'CN'}
                    </span>
                  </td>
                )}

                {/* Date-based attendance columns */}
                {hasDates ? (
                  <>
                    <td className="px-4 py-3.5">
                      <AttendanceDots yuvak={y} last6={dotsDisplay} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Last3Badge yuvak={y} last3={last3} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <LastSabhaBadge yuvak={y} lastDate={lastDate} />
                    </td>
                  </>
                ) : (
                  /* Fallback: progress bar when date columns not available */
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            y.attendancePercent >= 60 ? 'bg-green-500' :
                            y.attendancePercent >= 30 ? 'bg-yellow-400' : 'bg-yellow-400'
                          }`}
                          style={{ width: `${Math.min(100, y.attendancePercent)}%` }}
                        />
                      </div>
                      <span className="text-slate-300 text-xs tabular-nums">{y.attendancePercent.toFixed(0)}%</span>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                  No yuvaks found matching the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-700/60 flex items-center justify-between text-sm text-slate-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >Prev</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}


