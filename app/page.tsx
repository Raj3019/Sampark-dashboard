'use client';

import { useSheetData } from '@/hooks/useSheetData';
import { getSabhaStats, getKKStats, getLowestSessions, getHighestSessions, predictNextAttendance, getAreaBreakdown, getPastDates } from '@/lib/analytics';
import StatsCard from '@/components/StatsCard';
import StatusPieChart from '@/components/charts/StatusPieChart';
import AttendanceTrendChart from '@/components/charts/AttendanceTrendChart';
import AreaBreakdownChart from '@/components/charts/AreaBreakdownChart';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading Sabha data...</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-4xl">⚠️</div>
        <p className="text-slate-300 font-medium">Failed to load data</p>
        <p className="text-slate-500 text-sm">{message}</p>
        {message.includes('GOOGLE_SHEET_CSV_URL') && (
          <p className="text-slate-600 text-xs bg-slate-800 rounded p-3 text-left">
            Create <code className="text-orange-400">.env.local</code> with:<br />
            <code className="text-slate-300">GOOGLE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_ID/export?format=csv&amp;gid=0</code>
          </p>
        )}
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, refresh } = useSheetData();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data || data.yuvaks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">No data found. Check your Google Sheet CSV URL in .env.local</p>
      </div>
    );
  }

  const { yuvaks, dates, lastUpdated } = data;
  const pastDates = getPastDates(dates);

  // Per-sabha active dates: exclude columns where nobody attended (blank/future dates)
  const cnYuvaks     = yuvaks.filter((y) => y.sabhaType === 'Chirag Nagar');
  const kishorYuvaks = yuvaks.filter((y) => y.sabhaType === 'Chirag Nagar(Kishor)');
  const cnActiveDates     = pastDates.filter((d) => cnYuvaks.some((y)     => y.dateAttendance[d]));
  const kishorActiveDates = pastDates.filter((d) => kishorYuvaks.some((y) => y.dateAttendance[d]));

  const cnStats     = getSabhaStats(yuvaks, cnActiveDates,     'Chirag Nagar');
  const kishorStats = getSabhaStats(yuvaks, kishorActiveDates, 'Chirag Nagar(Kishor)');
  const kkStats     = getKKStats(yuvaks, pastDates.filter((d) => yuvaks.some((y) => y.dateAttendance[d])));
  const areaBreakdown = getAreaBreakdown(yuvaks, pastDates.filter((d) => yuvaks.some((y) => y.dateAttendance[d])));

  const totalGreen = cnStats.greenCount + kishorStats.greenCount;
  const totalYellow = cnStats.yellowCount + kishorStats.yellowCount;
  // const totalRed = cnStats.redCount + kishorStats.redCount;
  const totalYuvaks = yuvaks.length;

  // Overall trend: only dates where at least one yuvak attended (avoids 0% tail on chart)
  const activePastDates = pastDates.filter((d) => yuvaks.some((y) => y.dateAttendance[d]));
  const overallTrend = activePastDates.map((date) => {
    const count = yuvaks.filter((y) => y.dateAttendance[date]).length;
    return { date, count, percentage: totalYuvaks > 0 ? Math.round((count / totalYuvaks) * 100) : 0 };
  });

  const lowestCN = getLowestSessions(cnStats.sessionTrend, 3);
  const highestCN = getHighestSessions(cnStats.sessionTrend, 3);
  const predictedCN = predictNextAttendance(cnStats.sessionTrend);
  const predictedKishor = predictNextAttendance(kishorStats.sessionTrend);
  const updatedTime = new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sabha Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Overview of all weekly sabha attendance & analytics</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-500 text-xs">Updated: {updatedTime}</span>
          <button onClick={refresh} className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Yuvaks" value={totalYuvaks} subtitle="Both sabhas combined" icon="👥" accent="orange" />
        <StatsCard title="Active (Green)" value={totalGreen} subtitle={`${totalYuvaks > 0 ? Math.round((totalGreen / totalYuvaks) * 100) : 0}% of total`} icon="✅" accent="green" />
        <StatsCard title="Needs Attention" value={totalYellow} subtitle="Absent last 3 sabhas" icon="⚠️" accent="yellow" />
        {/* <StatsCard title="Absent (Red)" value={totalRed} subtitle="Absent 6+ sabhas" icon="🚫" accent="red" /> */}
      </div>

      {/* Sabha comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-blue-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-blue-400 font-semibold">Chirag Nagar Sabha</h3>
              <p className="text-slate-500 text-xs">STD 13+ · Senior gathering</p>
            </div>
            <span className="text-2xl">🏛</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-bold text-slate-100">{cnStats.totalYuvaks}</p><p className="text-xs text-slate-500">Total</p></div>
            <div><p className="text-2xl font-bold text-green-400">{cnStats.avgAttendance}%</p><p className="text-xs text-slate-500">Avg Att.</p></div>
            <div><p className="text-2xl font-bold text-orange-400">{predictedCN}%</p><p className="text-xs text-slate-500">Expected</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{cnStats.greenCount} active</span>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{cnStats.yellowCount} attention</span>
            {/* <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{cnStats.redCount} absent</span> */}
          </div>
        </div>
        <div className="bg-slate-800 border border-purple-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-purple-400 font-semibold">Kishor Sabha</h3>
              <p className="text-slate-500 text-xs">STD 9–12 · Youth gathering</p>
            </div>
            <span className="text-2xl">📚</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-bold text-slate-100">{kishorStats.totalYuvaks}</p><p className="text-xs text-slate-500">Total</p></div>
            <div><p className="text-2xl font-bold text-green-400">{kishorStats.avgAttendance}%</p><p className="text-xs text-slate-500">Avg Att.</p></div>
            <div><p className="text-2xl font-bold text-purple-400">{predictedKishor}%</p><p className="text-xs text-slate-500">Expected</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">{kishorStats.greenCount} active</span>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">{kishorStats.yellowCount} attention</span>
            {/* <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{kishorStats.redCount} absent</span> */}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AttendanceTrendChart sessionTrend={overallTrend} sabhaLabel="All Sabhas" totalYuvaks={totalYuvaks} />
        </div>
        <StatusPieChart green={totalGreen} yellow={totalYellow} red={0} title="Overall Status" />
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">Lowest Attendance Sessions</h3>
          <p className="text-slate-500 text-xs mb-4">Chirag Nagar — possible festivals or holidays</p>
          {lowestCN.length === 0 ? <p className="text-slate-500 text-sm">Not enough data.</p> : (
            <div className="space-y-3">
              {lowestCN.map((s) => (
                <div key={s.date} className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{s.date}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-700 rounded-full h-1.5"><div className="h-full bg-yellow-500 rounded-full" style={{ width: `${s.percentage}%` }} /></div>
                    <span className="text-yellow-400 text-sm font-medium w-16 text-right">{s.count} ({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-slate-100 font-semibold mb-1">Highest Attendance Sessions</h3>
          <p className="text-slate-500 text-xs mb-4">Chirag Nagar — best performing days</p>
          {highestCN.length === 0 ? <p className="text-slate-500 text-sm">Not enough data.</p> : (
            <div className="space-y-3">
              {highestCN.map((s) => (
                <div key={s.date} className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">{s.date}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-700 rounded-full h-1.5"><div className="h-full bg-green-500 rounded-full" style={{ width: `${s.percentage}%` }} /></div>
                    <span className="text-green-400 text-sm font-medium w-16 text-right">{s.count} ({s.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AreaBreakdownChart areaData={areaBreakdown} title="Area-wise Status (All Sabhas)" />
        {kkStats.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-slate-100 font-semibold mb-1">KK Follow-Up Summary</h3>
            <p className="text-slate-500 text-xs mb-4">Top KKs by yuvak count</p>
            <div className="space-y-2 overflow-y-auto max-h-56">
              {kkStats.slice(0, 10).map((kk) => (
                <div key={kk.name} className="flex items-center justify-between py-1.5 border-b border-slate-700/50">
                  <div>
                    <p className="text-slate-200 text-sm">{kk.name}</p>
                    <p className="text-slate-500 text-xs">{kk.yuvaks.length} yuvaks · avg {kk.avgAttendance}%</p>
                  </div>
                  <div className="flex gap-1.5 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{kk.greenCount}</span>
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">{kk.yellowCount}</span>
                    {/* <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{kk.redCount}</span> */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {kkStats.some((k) => k.yuvaks.length > 6) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex gap-3">
          <span className="text-yellow-400 text-xl">⚠️</span>
          <div>
            <p className="text-yellow-300 font-medium text-sm">Some KKs have many yuvaks to follow-up</p>
            <p className="text-yellow-500/80 text-xs mt-1">
              {kkStats.filter((k) => k.yuvaks.length > 6).map((k) => `${k.name} (${k.yuvaks.length})`).join(', ')} — consider redistributing for more effective follow-up.
            </p>
          </div>
        </div>
      )}

      {/* Immediate Follow-Up block commented out */}
    </div>
  );
}



