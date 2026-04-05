import { Yuvak, AttendanceStatus, KKStats, SabhaStats, SabhaSessionStat, SabhaType } from './types';

/**
 * Filters date strings to only those that have already occurred (≤ today).
 * Handles "DD-Mon-YY" format (e.g., "25-Feb-26", "4-Mar-26").
 */
export function getPastDates(dates: string[]): string[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return dates.filter((d) => {
    // Handle "DD-Mon-YY" (e.g. "4-Mar-26") and "DD-Mon-YYYY" (e.g. "4-Mar-2026")
    const cleaned = d
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, (_, day, mon, yr) => `${mon} ${day} ${yr}`)
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_, day, mon, yr) => `${mon} ${day} 20${yr}`);
    const parsed = new Date(cleaned);
    return !isNaN(parsed.getTime()) && parsed <= today;
  });
}

/**
 * Determines attendance status using sheet-driven fields only.
 * Green  → Super Active (last 4 Sabha Yes)
 * Yellow → Not super active (attention)
 */
export function getAttendanceStatus(yuvak: Yuvak, sortedDates: string[]): AttendanceStatus {
  // Keep parameter for API compatibility with existing call-sites.
  void sortedDates;

  if (yuvak.superActive) return 'green';
  return 'yellow';
}

/**
 * Directory risk status based on recent sabha attendance.
 * Red    -> missed last 4 sabhas
 * Yellow -> missed last 2 sabhas
 * Green  -> otherwise
 */
export function getDirectoryRiskStatus(yuvak: Yuvak, sortedDates: string[]): AttendanceStatus {
  const last1 = sortedDates.slice(-1);
  const last2 = sortedDates.slice(-2);
  const last4 = sortedDates.slice(-4);

  const missedLast4 = last4.length === 4 && last4.every((date) => !yuvak.dateAttendance[date]);
  if (missedLast4) return 'red';

  const missedLast2 = last2.length === 2 && last2.every((date) => !yuvak.dateAttendance[date]);
  if (missedLast2) return 'yellow';

  void last1;
  return 'green';
}

export function getStatusColor(status: AttendanceStatus) {
  switch (status) {
    case 'red': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' };
    case 'yellow': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-400' };
    case 'green': return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-500' };
  }
}

export function getStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'red': return 'Not Attending';
    case 'yellow': return 'Needs Attention';
    case 'green': return 'Active';
  }
}

/** Computes per-session attendance counts from date attendance data */
export function getSessionTrend(yuvaks: Yuvak[], dates: string[]): SabhaSessionStat[] {
  return dates.map((date) => {
    const areaMap = new Map<string, number>();
    const attended = yuvaks.filter((y) => {
      const present = y.dateAttendance[date];
      if (!present) return false;
      const area = y.area?.trim() || 'Unknown';
      areaMap.set(area, (areaMap.get(area) ?? 0) + 1);
      return true;
    }).length;
    return {
      date,
      count: attended,
      percentage: yuvaks.length > 0 ? Math.round((attended / yuvaks.length) * 100) : 0,
      areaBreakdown: Array.from(areaMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([area, areaCount]) => ({ area, attended: areaCount })),
    };
  });
}

/** Aggregated stats for a single sabha type */
export function getSabhaStats(yuvaks: Yuvak[], dates: string[], sabhaType: SabhaType): SabhaStats {
  const filtered = yuvaks.filter((y) => y.sabhaType === sabhaType);

  const statuses = filtered.map((y) => getAttendanceStatus(y, dates));
  const greenCount = statuses.filter((s) => s === 'green').length;
  const yellowCount = statuses.filter((s) => s === 'yellow').length;
  const redCount = statuses.filter((s) => s === 'red').length;
  const avgAttendance =
    filtered.length > 0
      ? Math.round(filtered.reduce((sum, y) => sum + y.attendancePercent, 0) / filtered.length)
      : 0;
  const superActiveCount = filtered.filter((y) => y.superActive).length;
  const sessionTrend = getSessionTrend(filtered, dates);

  return {
    sabhaType,
    totalYuvaks: filtered.length,
    greenCount,
    yellowCount,
    redCount,
    avgAttendance,
    superActiveCount,
    sessionTrend,
  };
}

/** Per-KK statistics */
export function getKKStats(yuvaks: Yuvak[], dates: string[]): KKStats[] {
  const kkMap = new Map<string, Yuvak[]>();
  yuvaks.forEach((y) => {
    if (!y.followUpKK) return;
    if (!kkMap.has(y.followUpKK)) kkMap.set(y.followUpKK, []);
    kkMap.get(y.followUpKK)!.push(y);
  });

  return Array.from(kkMap.entries())
    .map(([name, kkYuvaks]) => {
      const statuses = kkYuvaks.map((y) => getAttendanceStatus(y, dates));
      const sabhaTypes = [...new Set(kkYuvaks.map((y) => y.sabhaType))] as SabhaType[];
      return {
        name,
        yuvaks: kkYuvaks,
        sabhaTypes,
        greenCount: statuses.filter((s) => s === 'green').length,
        yellowCount: statuses.filter((s) => s === 'yellow').length,
        redCount: statuses.filter((s) => s === 'red').length,
        avgAttendance:
          kkYuvaks.length > 0
            ? Math.round(kkYuvaks.reduce((s, y) => s + y.attendancePercent, 0) / kkYuvaks.length)
            : 0,
      };
    })
    .sort((a, b) => b.yuvaks.length - a.yuvaks.length);
}

/** Finds the session with the lowest attendance (useful for correlating festivals/events) */
export function getLowestSessions(sessionTrend: SabhaSessionStat[], topN = 3): SabhaSessionStat[] {
  return [...sessionTrend].filter((s) => s.count > 0).sort((a, b) => a.count - b.count).slice(0, topN);
}

/** Finds the session with the highest attendance */
export function getHighestSessions(sessionTrend: SabhaSessionStat[], topN = 3): SabhaSessionStat[] {
  return [...sessionTrend].sort((a, b) => b.count - a.count).slice(0, topN);
}

/** Estimates expected attendance for upcoming sabha based on recent trend */
export function predictNextAttendance(sessionTrend: SabhaSessionStat[]): number {
  if (sessionTrend.length === 0) return 0;
  const recent = sessionTrend.slice(-4);
  const avg = recent.reduce((s, r) => s + r.percentage, 0) / recent.length;
  return Math.round(avg);
}

/** Area-wise breakdown */
export function getAreaBreakdown(yuvaks: Yuvak[], dates: string[]) {
  const areaMap = new Map<string, { total: number; green: number; yellow: number; red: number }>();
  yuvaks.forEach((y) => {
    if (!y.area) return;
    if (!areaMap.has(y.area)) areaMap.set(y.area, { total: 0, green: 0, yellow: 0, red: 0 });
    const entry = areaMap.get(y.area)!;
    entry.total++;
    const status = getAttendanceStatus(y, dates);
    entry[status]++;
  });
  return Array.from(areaMap.entries()).map(([area, stats]) => ({ area, ...stats }));
}
