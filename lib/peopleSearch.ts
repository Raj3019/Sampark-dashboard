import { getDirectoryRiskStatus, getPastDates } from '@/lib/analytics';
import { getAuthPool } from '@/lib/auth/db';
import { UserAccessContext } from '@/lib/auth/session';
import { ParsedSheetData, Yuvak } from '@/lib/types';
import { KkDetail, KkDetailYuvak, LeaderDetail, PeopleSearchResult, PersonDetail, YuvakDetail } from '@/lib/peopleSearchTypes';

export type PeopleUserRow = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  assignedKK: string | null;
  createdAt: string | null;
};

export function normalizePersonValue(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function samePersonValue(left: string | null | undefined, right: string | null | undefined) {
  return normalizePersonValue(left) === normalizePersonValue(right);
}

export function createYuvakId(yuvak: Pick<Yuvak, 'name' | 'sabhaType' | 'followUpKK'>) {
  return [yuvak.sabhaType, yuvak.name, yuvak.followUpKK].map((part) => part.trim()).join('::');
}

function matchesQuery(values: Array<string | number | null | undefined>, query: string) {
  return values.some((value) => String(value ?? '').toLowerCase().includes(query));
}

function getActivePastDates(data: ParsedSheetData, yuvaks = data.yuvaks) {
  const pastDates = getPastDates(data.dates);
  return pastDates.filter((date) => yuvaks.some((yuvak) => yuvak.dateAttendance[date]));
}

function canViewAllPersonal(access: UserAccessContext) {
  return access.role === 'admin' || access.role === 'leader';
}

function canViewYuvakPersonal(access: UserAccessContext, yuvak: Yuvak) {
  return canViewAllPersonal(access) || (access.role === 'kk' && samePersonValue(yuvak.followUpKK, access.assignedKK));
}

function canViewKkPersonal(access: UserAccessContext, kkName: string) {
  return canViewAllPersonal(access) || (access.role === 'kk' && samePersonValue(kkName, access.assignedKK));
}

export function getVisibleYuvaksForAccess(data: ParsedSheetData, access: UserAccessContext) {
  if (access.role !== 'kk') return data.yuvaks;
  if (!access.assignedKK) return [];
  return data.yuvaks.filter((yuvak) => samePersonValue(yuvak.followUpKK, access.assignedKK));
}

export async function getPeopleUsers() {
  const pool = getAuthPool();
  const result = await pool.query<PeopleUserRow>(
    `SELECT "id", "name", "email", "username", "role", "assignedKK", "createdAt"
     FROM "user"
     WHERE "role" IN ('admin', 'leader', 'kk')
     ORDER BY "name" ASC`
  );
  return result.rows;
}

export function buildPeopleSearchResults(data: ParsedSheetData, users: PeopleUserRow[], access: UserAccessContext, rawQuery: string): PeopleSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const visibleYuvaks = getVisibleYuvaksForAccess(data, access);
  const activePastDates = getActivePastDates(data, visibleYuvaks);

  const yuvakResults = visibleYuvaks
    .filter((yuvak) => matchesQuery([
      yuvak.name,
      yuvak.followUpKK,
      yuvak.area,
      yuvak.phoneNumber,
      yuvak.std,
      yuvak.sabhaType,
    ], query))
    .slice(0, 5)
    .map((yuvak): PeopleSearchResult => ({
      type: 'yuvak',
      id: createYuvakId(yuvak),
      title: yuvak.name,
      subtitle: [yuvak.sabhaType, yuvak.area || 'No area'].filter(Boolean).join(' • '),
      meta: `${yuvak.attendancePercent}% attendance${yuvak.followUpKK ? ` • KK: ${yuvak.followUpKK}` : ''}`,
    }));

  const kkNames = Array.from(new Set(visibleYuvaks.map((yuvak) => yuvak.followUpKK?.trim()).filter(Boolean) as string[]));
  const kkResults = kkNames
    .filter((kkName) => matchesQuery([kkName], query))
    .map((kkName) => {
      const kkYuvaks = visibleYuvaks.filter((yuvak) => samePersonValue(yuvak.followUpKK, kkName));
      const avgAttendance = kkYuvaks.length > 0
        ? Math.round(kkYuvaks.reduce((sum, yuvak) => sum + yuvak.attendancePercent, 0) / kkYuvaks.length)
        : 0;
      const highRisk = kkYuvaks.filter((yuvak) => getDirectoryRiskStatus(yuvak, activePastDates) === 'red').length;
      return {
        type: 'kk' as const,
        id: kkName,
        title: kkName,
        subtitle: `${kkYuvaks.length} assigned yuvaks`,
        meta: `${avgAttendance}% avg attendance • ${highRisk} high risk`,
      };
    })
    .sort((a, b) => b.subtitle.localeCompare(a.subtitle))
    .slice(0, 3);

  const leaderResults = users
    .filter((user) => {
      if (access.role === 'kk') {
        return user.id === access.userId;
      }
      return user.role === 'leader' || user.role === 'admin';
    })
    .filter((user) => matchesQuery([user.name, user.email, user.username, user.role], query))
    .slice(0, 3)
    .map((user): PeopleSearchResult => ({
      type: 'leader',
      id: user.id,
      title: user.name,
      subtitle: user.role === 'admin' ? 'Admin' : 'Leader',
      meta: canViewAllPersonal(access) ? [user.email, user.username].filter(Boolean).join(' • ') || 'User account' : 'User account',
    }));

  return [...yuvakResults, ...kkResults, ...leaderResults].slice(0, 8);
}

function summarizeSabhaSplit(yuvaks: Yuvak[]) {
  const split = new Map<string, number>();
  for (const yuvak of yuvaks) {
    split.set(yuvak.sabhaType || 'Unknown', (split.get(yuvak.sabhaType || 'Unknown') ?? 0) + 1);
  }
  return Array.from(split.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([sabhaType, count]) => ({ sabhaType, count }));
}

function createKkYuvakSummary(yuvak: Yuvak, activePastDates: string[], showPersonal: boolean): KkDetailYuvak {
  const lastDate = activePastDates[activePastDates.length - 1];
  return {
    id: createYuvakId(yuvak),
    name: yuvak.name,
    sabhaType: yuvak.sabhaType,
    area: yuvak.area,
    phoneNumber: showPersonal ? yuvak.phoneNumber || null : null,
    attendancePercent: yuvak.attendancePercent,
    risk: getDirectoryRiskStatus(yuvak, activePastDates),
    lastSabhaPresent: lastDate ? Boolean(yuvak.dateAttendance[lastDate]) : null,
  };
}

export function buildYuvakDetail(data: ParsedSheetData, access: UserAccessContext, id: string): YuvakDetail | null {
  const visibleYuvaks = getVisibleYuvaksForAccess(data, access);
  const yuvak = visibleYuvaks.find((item) => createYuvakId(item) === id);
  if (!yuvak) return null;

  const activePastDates = getActivePastDates(data, visibleYuvaks);
  const records = activePastDates.map((date) => ({ date, present: Boolean(yuvak.dateAttendance[date]) }));
  const lastDate = activePastDates[activePastDates.length - 1];
  const showPersonal = canViewYuvakPersonal(access, yuvak);

  return {
    type: 'yuvak',
    visibility: {
      personal: showPersonal,
      restrictedReason: showPersonal ? undefined : 'Personal fields are hidden for this role.',
    },
    profile: {
      name: yuvak.name,
      phoneNumber: showPersonal ? yuvak.phoneNumber || null : null,
      dob: showPersonal ? yuvak.dob || null : null,
      std: yuvak.std,
      area: yuvak.area,
      sabhaType: yuvak.sabhaType,
      followUpKK: yuvak.followUpKK,
      attendingSabha: yuvak.attendingSabha,
    },
    attendance: {
      totalSabhas: yuvak.totalSabhas,
      sabhasAttended: yuvak.sabhasAttended,
      attendancePercent: yuvak.attendancePercent,
      lastSabhaDate: lastDate ?? null,
      lastSabhaPresent: lastDate ? Boolean(yuvak.dateAttendance[lastDate]) : null,
      last6: records.slice(-6),
      records,
    },
    status: {
      risk: getDirectoryRiskStatus(yuvak, activePastDates),
      superActive: yuvak.superActive,
    },
  };
}

export function buildKkDetail(data: ParsedSheetData, users: PeopleUserRow[], access: UserAccessContext, kkName: string): KkDetail | null {
  const visibleYuvaks = getVisibleYuvaksForAccess(data, access);
  const assignedYuvaks = visibleYuvaks.filter((yuvak) => samePersonValue(yuvak.followUpKK, kkName));
  const selfYuvak = visibleYuvaks.find((yuvak) => samePersonValue(yuvak.name, kkName)) ?? null;
  if (assignedYuvaks.length === 0 && !(access.role === 'kk' && samePersonValue(kkName, access.assignedKK))) {
    return null;
  }

  const activePastDates = getActivePastDates(data, visibleYuvaks);
  const showPersonal = canViewKkPersonal(access, kkName);
  const linkedUser = users.find((user) => user.role === 'kk' && samePersonValue(user.assignedKK, kkName)) ?? null;
  const risks = assignedYuvaks.map((yuvak) => getDirectoryRiskStatus(yuvak, activePastDates));
  const selfRecords = selfYuvak
    ? activePastDates.map((date) => ({ date, present: Boolean(selfYuvak.dateAttendance[date]) }))
    : [];
  const lastSelfDate = activePastDates[activePastDates.length - 1];

  return {
    type: 'kk',
    visibility: {
      personal: showPersonal,
      restrictedReason: showPersonal ? undefined : 'Personal fields are hidden for this role.',
    },
    profile: {
      name: kkName,
      user: linkedUser
        ? {
            id: linkedUser.id,
            name: linkedUser.name,
            email: showPersonal ? linkedUser.email : null,
            username: showPersonal ? linkedUser.username : null,
            createdAt: showPersonal ? linkedUser.createdAt : null,
          }
        : null,
    },
    selfAttendance: selfYuvak
      ? {
          yuvakId: createYuvakId(selfYuvak),
          sabhaType: selfYuvak.sabhaType,
          area: selfYuvak.area,
          phoneNumber: showPersonal ? selfYuvak.phoneNumber || null : null,
          dob: showPersonal ? selfYuvak.dob || null : null,
          std: selfYuvak.std,
          totalSabhas: selfYuvak.totalSabhas,
          sabhasAttended: selfYuvak.sabhasAttended,
          attendancePercent: selfYuvak.attendancePercent,
          risk: getDirectoryRiskStatus(selfYuvak, activePastDates),
          superActive: selfYuvak.superActive,
          lastSabhaDate: lastSelfDate ?? null,
          lastSabhaPresent: lastSelfDate ? Boolean(selfYuvak.dateAttendance[lastSelfDate]) : null,
          last6: selfRecords.slice(-6),
          records: selfRecords,
        }
      : null,
    summary: {
      totalYuvaks: assignedYuvaks.length,
      activeCount: assignedYuvaks.filter((yuvak) => yuvak.superActive).length,
      attentionCount: assignedYuvaks.filter((yuvak) => !yuvak.superActive).length,
      highRiskCount: risks.filter((risk) => risk === 'red').length,
      avgAttendance: assignedYuvaks.length > 0
        ? Math.round(assignedYuvaks.reduce((sum, yuvak) => sum + yuvak.attendancePercent, 0) / assignedYuvaks.length)
        : 0,
    },
    sabhaSplit: summarizeSabhaSplit(assignedYuvaks),
    assignedYuvaks: assignedYuvaks
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((yuvak) => createKkYuvakSummary(yuvak, activePastDates, showPersonal)),
  };
}

export function buildLeaderDetail(data: ParsedSheetData, users: PeopleUserRow[], access: UserAccessContext, userId: string): LeaderDetail | null {
  const user = users.find((item) => item.id === userId && (item.role === 'leader' || item.role === 'admin'));
  if (!user) return null;
  if (access.role === 'kk' && user.id !== access.userId) return null;

  const visibleYuvaks = getVisibleYuvaksForAccess(data, access);
  const kkCount = new Set(visibleYuvaks.map((yuvak) => normalizePersonValue(yuvak.followUpKK)).filter(Boolean)).size;
  const sabhaCount = new Set(visibleYuvaks.map((yuvak) => yuvak.sabhaType).filter(Boolean)).size;
  const showPersonal = canViewAllPersonal(access) || user.id === access.userId;

  return {
    type: 'leader',
    visibility: {
      personal: showPersonal,
      restrictedReason: showPersonal ? undefined : 'Personal fields are hidden for this role.',
    },
    profile: {
      id: user.id,
      name: user.name,
      role: user.role === 'admin' ? 'admin' : 'leader',
      email: showPersonal ? user.email : null,
      username: showPersonal ? user.username : null,
      createdAt: showPersonal ? user.createdAt : null,
    },
    summary: {
      scope: access.role === 'kk' ? 'Assigned KK scope' : 'All sabhas',
      totalYuvaks: visibleYuvaks.length,
      totalKKs: kkCount,
      sabhaCount,
      avgAttendance: visibleYuvaks.length > 0
        ? Math.round(visibleYuvaks.reduce((sum, yuvak) => sum + yuvak.attendancePercent, 0) / visibleYuvaks.length)
        : 0,
    },
  };
}

export function buildPersonDetail(data: ParsedSheetData, users: PeopleUserRow[], access: UserAccessContext, type: string, id: string): PersonDetail | null {
  if (type === 'yuvak') return buildYuvakDetail(data, access, id);
  if (type === 'kk') return buildKkDetail(data, users, access, id);
  if (type === 'leader') return buildLeaderDetail(data, users, access, id);
  return null;
}
