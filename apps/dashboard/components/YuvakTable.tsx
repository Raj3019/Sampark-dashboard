'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Session date ISO "YYYY-MM-DD" -> "25 Sep"
function formatVisitedDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getUTCDate()).padStart(2, '0')} ${MONTH_SHORT[date.getUTCMonth()]}`;
  }
  return iso;
}

function AttendanceDots({ yuvak, last6 }: { yuvak: Yuvak; last6: string[] }) {
  const count = last6.filter((d) => yuvak.dateAttendance[d]).length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {last6.map((d, i) => {
          const visited = yuvak.dateVisited?.[d];
          return (
            <span key={i}
              title={
                visited
                  ? `Present — visited ${visited.sabhaType} on ${formatVisitedDate(visited.sessionDate)}`
                  : d
              }
              className={`w-3.5 h-3.5 rounded-sm ${
                yuvak.dateAttendance[d]
                  ? visited
                    ? 'bg-green-500 ring-1 ring-amber-400'
                    : 'bg-green-500'
                  : 'bg-[#d8cdbd] dark:bg-slate-700'
              }`}
            />
          );
        })}
      </div>
      <span className="text-[#64748b] text-xs tabular-nums dark:text-slate-400">{count}/{last6.length}</span>
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
  if (!lastDate) return <span className="text-[#94a3b8] text-xs dark:text-slate-600">—</span>;
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
  initialSearch?: string;
  initialKK?: string;
}

type SortKey = 'name' | 'area' | 'attendance' | 'status' | 'kk';

export default function YuvakTable({ yuvaks, dates, showSabhaType = false, initialSearch = '', initialKK = 'all' }: Props) {
  const [search, setSearch]             = useState(initialSearch);
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | 'all'>('all');
  const [filterSabha, setFilterSabha]   = useState<'all' | 'cn' | 'kishor' | 'bal'>('all');
  const [filterKK, setFilterKK]         = useState(initialKK);
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
    const normalizedFilterKK = filterKK.trim().toLowerCase();
    if (filterStatus !== 'all' && y.status !== filterStatus) return false;
    if (filterSabha === 'cn'     && y.sabhaType !== 'Chirag Nagar') return false;
    if (filterSabha === 'kishor' && y.sabhaType !== 'Chirag Nagar(Kishor)') return false;
    if (filterSabha === 'bal' && y.sabhaType !== 'Bal Sabha') return false;
    if (normalizedFilterKK !== 'all' && y.followUpKK.trim().toLowerCase() !== normalizedFilterKK) return false;
    if (search) {
      const query = search.toLowerCase();
      const searchable = [
        y.name,
        y.followUpKK,
        y.area,
        y.phoneNumber,
        y.std,
        y.sabhaType,
      ].join(' ').toLowerCase();
      if (!searchable.includes(query)) return false;
    }
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
      : <span className="text-[#94a3b8] dark:text-slate-600"> ↕</span>;

  return (
    <div className="overflow-hidden rounded-xl border border-[#d9cdbb] bg-[#f1eadf] dark:border-slate-700/60 dark:bg-slate-900">

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 border-b border-[#d9cdbb] px-4 py-3 dark:border-slate-700/60 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs select-none">🔍</span>
          <input
            type="text"
            placeholder="Search yuvak name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-[#d8cdbd] bg-[#fffdfa] py-2 pl-8 pr-3 text-sm text-[#334155] placeholder:text-[#94a3b8] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500 sm:w-60"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as AttendanceStatus | 'all'); setPage(1); }}
          className="w-full rounded-lg border border-[#d8cdbd] bg-[#fffdfa] px-3 py-2 text-sm text-[#334155] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-auto"
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
            className="w-full rounded-lg border border-[#d8cdbd] bg-[#fffdfa] px-3 py-2 text-sm text-[#334155] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-auto"
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
          className="w-full rounded-lg border border-[#d8cdbd] bg-[#fffdfa] px-3 py-2 text-sm text-[#334155] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-auto"
        >
          {kkList.map((k) => (
            <option key={k} value={k}>{k === 'all' ? 'All KKs' : k}</option>
          ))}
        </select>
        <select
          value={dateWindow}
          onChange={(e) => { setDateWindow(e.target.value as 'last6' | '1m' | '3m' | 'custom'); setPage(1); }}
          className="w-full rounded-lg border border-[#d8cdbd] bg-[#fffdfa] px-3 py-2 text-sm text-[#334155] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-auto"
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
              className="rounded-lg border border-[#d8cdbd] bg-[#fffdfa] px-3 py-2 text-sm text-[#334155] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:scheme-dark"
            />
            <span className="text-[#64748b] text-xs dark:text-slate-500">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
              className="rounded-lg border border-[#d8cdbd] bg-[#fffdfa] px-3 py-2 text-sm text-[#334155] focus:border-orange-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:scheme-dark"
            />
          </div>
        )}
        <span className="text-sm text-[#64748b] dark:text-slate-500 sm:ml-auto">{filtered.length} of {yuvaks.length} yuvaks</span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#d9cdbb] bg-[#eadfce]/70 dark:border-slate-700/60 dark:bg-slate-800/50">
              <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hover:text-[#334155] dark:text-slate-500 dark:hover:text-slate-300"
                  onClick={() => handleSort('status')}>
                Status {renderSortArrow('status')}
              </th>
              <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hover:text-[#334155] dark:text-slate-500 dark:hover:text-slate-300"
                  onClick={() => handleSort('name')}>
                Name {renderSortArrow('name')}
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-500">
                STD
              </th>
              <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hover:text-[#334155] dark:text-slate-500 dark:hover:text-slate-300"
                  onClick={() => handleSort('kk')}>
                KK (Follow-Up Person) {renderSortArrow('kk')}
              </th>
              {showSabhaType && (
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-500">Sabha</th>
              )}
              {hasDates ? (
                <>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-500">
                    Last {dotsDisplay.length} Sabhas
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-500">
                    Last 3
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-slate-500">
                    Last Sabha
                  </th>
                </>
              ) : (
                <th className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#64748b] hover:text-[#334155] dark:text-slate-500 dark:hover:text-slate-300"
                    onClick={() => handleSort('attendance')}>
                  Attendance {renderSortArrow('attendance')}
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#d9cdbb] dark:divide-slate-800">
            {paginated.map((y, i) => (
              <tr key={`${y.name}-${i}`} className="transition-colors hover:bg-[#f8f3eb] dark:hover:bg-slate-800/40">

                {/* Status */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <InlineStatusBadge status={y.status} />
                </td>

                {/* Name */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1f2937] dark:text-slate-100">{y.name}</span>
                    <ContactActions name={y.name} phoneNumber={y.phoneNumber} size="xs" />
                  </div>
                </td>

                {/* STD */}
                <td className="px-4 py-3.5">
                  {y.std
                    ? <span className="whitespace-nowrap rounded bg-[#fff7ed] px-2 py-0.5 text-xs font-medium text-[#64748b] dark:bg-slate-700/80 dark:text-slate-300">Std {y.std}</span>
                    : <span className="text-xs text-[#94a3b8] dark:text-slate-600">—</span>
                  }
                </td>

                {/* KK */}
                <td className="px-4 py-3.5 text-[#334155] dark:text-slate-300">{y.followUpKK || '—'}</td>

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
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#d8cdbd] dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full ${
                            y.attendancePercent >= 60 ? 'bg-green-500' :
                            y.attendancePercent >= 30 ? 'bg-yellow-400' : 'bg-yellow-400'
                          }`}
                          style={{ width: `${Math.min(100, y.attendancePercent)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-[#334155] dark:text-slate-300">{y.attendancePercent.toFixed(0)}%</span>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-[#64748b] dark:text-slate-500">
                  No yuvaks found matching the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#d9cdbb] px-4 py-3 text-sm text-[#64748b] dark:border-slate-700/60 dark:text-slate-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous page"
              title="Previous page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#d8cdbd] text-[#334155] hover:bg-[#cdbda8] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              title="Next page"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-[#d8cdbd] text-[#334155] hover:bg-[#cdbda8] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


