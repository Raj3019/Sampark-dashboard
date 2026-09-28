import { ParsedSheetData, SabhaMeta, SabhaType, SessionMeta, Yuvak } from '@/lib/types';
import { SABHA_TYPES } from '@/lib/sabha';
import { getAuthPool } from '@/lib/auth/db';

const CACHE_TTL_MS = 60_000;

let cachedData: ParsedSheetData | null = null;
let cacheExpiresAt = 0;
let inflightRefresh: Promise<{ data: ParsedSheetData; cache: CacheStatus }> | null = null;

export type CacheStatus = 'HIT' | 'MISS';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sheet-era display format, e.g. "09-Sep-26" — analytics components compare dates in this format
function toDateDisplayLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateIso;
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mon = MONTHS[date.getUTCMonth()];
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${dd}-${mon}-${yy}`;
}

function toComparableDate(value: string): number {
  const parsed = new Date(
    value
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`)
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, (_m, day, mon, yyyy) => `${mon} ${day} ${yyyy}`)
  );
  return parsed.getTime();
}

type MemberRow = {
  id: string;
  full_name: string;
  phone_number: string | null;
  date_of_birth: string | null;
  area: string | null;
  std: string | null;
  sabha_type: string;
  follow_up_kk: string | null;
  attending: boolean;
  super_active: boolean;
};

type SessionRow = {
  id: string;
  sabha_type: string;
  session_date: string;
  vakta: string | null;
  topic: string | null;
};

type AttendanceRow = {
  session_id: string;
  member_id: string;
  present: boolean;
  actual_sabha_type: string | null;
  actual_session_date: string | null;
};

async function fetchAttendanceRows() {
  const pool = getAuthPool();
  const [members, sessions, records] = await Promise.all([
    pool.query<MemberRow>(
      `SELECT m."id", m."full_name", m."phone_number", m."date_of_birth", m."area", m."std",
              COALESCE(f."full_name", m."follow_up_kk") AS "follow_up_kk", m."attending", m."super_active"
       FROM "member" m
       LEFT JOIN "member" f ON f."id" = m."follow_up_member_id"`
    ),
    pool.query<SessionRow>(
      `SELECT s."id", s."sabha_type", to_char(s."session_date", 'YYYY-MM-DD') AS "session_date",
              s."vakta", s."topic"
       FROM "sabha_session" s
       ORDER BY s."session_date" ASC`
    ),
    pool.query<AttendanceRow>(
      `SELECT a."session_id", a."member_id", a."present",
              a."actual_sabha_type", to_char(a."actual_session_date", 'YYYY-MM-DD') AS "actual_session_date"
       FROM "attendance_record" a`
    ),
  ]);

  return { members: members.rows, sessions: sessions.rows, records: records.rows };
}

function emptySabhaMeta(sheetName = ''): SabhaMeta {
  return { vakta: '', topic: '', sheetName };
}

export async function buildParsedAttendanceData(): Promise<ParsedSheetData> {
  const { members, sessions, records } = await fetchAttendanceRows();

  const sabhaMeta = Object.fromEntries(
    SABHA_TYPES.map((sabhaType) => [sabhaType, emptySabhaMeta(sabhaType)])
  ) as Record<SabhaType, SabhaMeta>;

  const sabhaSessionMeta = Object.fromEntries(
    SABHA_TYPES.map((sabhaType) => [sabhaType, {} as Record<string, SessionMeta>])
  ) as Record<SabhaType, Record<string, SessionMeta>>;

  const yuvaks: Yuvak[] = [];
  const uniqueDates = new Set<string>();

  for (const sabhaType of SABHA_TYPES) {
    const sabhaSessions = sessions.filter((session) => session.sabha_type === sabhaType);
    if (sabhaSessions.length === 0) continue;

    const schemaDates = sabhaSessions.map((session) => toDateDisplayLabel(session.session_date));
    const sessionIdIndex = new Map(sabhaSessions.map((session, index) => [session.id, index]));
    const sabhaRecords = records.filter((rec) => sessionIdIndex.has(rec.session_id));

    sabhaSessions.forEach((session, index) => {
      const date = schemaDates[index];
      uniqueDates.add(date);
      if (session.vakta || session.topic) {
        sabhaSessionMeta[sabhaType][date] = { vakta: session.vakta ?? '', topic: session.topic ?? '' };
      }
    });

    const latest = [...sabhaSessions].reverse().find((session) => session.vakta || session.topic);
    sabhaMeta[sabhaType] = {
      vakta: latest?.vakta ?? '',
      topic: latest?.topic ?? '',
      sheetName: sabhaType,
    };

    for (const member of members.filter((m) => m.sabha_type === sabhaType)) {
      const dateAttendance: Record<string, boolean> = {};
      sabhaSessions.forEach((_session, index) => {
        dateAttendance[schemaDates[index]] = false;
      });

      let sabhasAttended = 0;
      let dateVisited: Record<string, { sabhaType: string; sessionDate: string }> | undefined;
      for (const rec of sabhaRecords) {
        if (rec.member_id !== member.id || !rec.present) continue;
        const index = sessionIdIndex.get(rec.session_id);
        if (index === undefined) continue;
        dateAttendance[schemaDates[index]] = true;
        sabhasAttended += 1;

        // Surfaces "visited another sabha" metadata captured by the sync.
        // Keyed by the display label of the actual session date; only present
        // rows with actual_sabha_type set carry visit info.
        if (rec.actual_sabha_type && rec.actual_session_date) {
          const visitLabel = toDateDisplayLabel(rec.actual_session_date);
          dateVisited = dateVisited ?? {};
          dateVisited[visitLabel] = {
            sabhaType: rec.actual_sabha_type,
            sessionDate: rec.actual_session_date,
          };
        }
      }

      const totalSabhas = sabhaSessions.length;
      const attendancePercent = totalSabhas > 0
        ? Math.round((sabhasAttended / totalSabhas) * 100)
        : 0;

      const yuvak: Yuvak = {
        name: member.full_name,
        area: member.area ?? '',
        phoneNumber: member.phone_number ?? '',
        dob: member.date_of_birth ?? '',
        followUpKK: member.follow_up_kk ?? '',
        sabhaType,
        std: member.std ?? '',
        attendingSabha: member.attending,
        sabhasAttended,
        attendancePercent,
        superActive: member.super_active,
        dateAttendance,
        totalSabhas,
      };
      if (dateVisited) yuvak.dateVisited = dateVisited;

      yuvaks.push(yuvak);
    }
  }

  return {
    yuvaks,
    dates: Array.from(uniqueDates).sort((a, b) => toComparableDate(a) - toComparableDate(b)),
    lastUpdated: new Date().toISOString(),
    sabhaMeta,
    sabhaSessionMeta,
  };
}

export async function getSabhaData(options?: { forceFresh?: boolean }): Promise<{ data: ParsedSheetData; cache: CacheStatus }> {
  const forceFresh = options?.forceFresh ?? false;

  if (!forceFresh && cachedData && Date.now() < cacheExpiresAt) {
    return { data: cachedData, cache: 'HIT' };
  }

  if (!forceFresh && inflightRefresh) {
    return await inflightRefresh;
  }

  const refreshPromise = refreshSabhaData();
  inflightRefresh = refreshPromise;

  try {
    return await refreshPromise;
  } catch (err) {
    if (cachedData) {
      console.warn('Fresh data load failed, serving stale cache:', err instanceof Error ? err.message : err);
      return { data: cachedData, cache: 'HIT' };
    }
    throw err;
  } finally {
    if (inflightRefresh === refreshPromise) {
      inflightRefresh = null;
    }
  }
}

async function refreshSabhaData(): Promise<{ data: ParsedSheetData; cache: CacheStatus }> {
  const data = await buildParsedAttendanceData();
  cachedData = data;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return { data, cache: 'MISS' };
}
