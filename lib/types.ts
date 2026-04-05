export type SabhaType = string;
export type AttendanceStatus = 'green' | 'yellow' | 'red';
export type ReminderRiskLevel = 'moderate' | 'high';
export type ReminderStatus = 'pending' | 'acknowledged' | 'escalated' | 'resolved';

export interface SabhaMeta {
  vakta: string;
  topic: string;
  sheetName: string;
}

export interface SessionMeta {
  vakta: string;
  topic: string;
}

export interface Yuvak {
  name: string;
  area: string;
  phoneNumber: string;
  dob: string;
  followUpKK: string;
  sabhaType: SabhaType;
  std: string;
  attendingSabha: boolean;
  sabhasAttended: number;
  attendancePercent: number;
  superActive: boolean;
  dateAttendance: Record<string, boolean>; // date string -> attended
  totalSabhas: number;
}

export interface ParsedSheetData {
  yuvaks: Yuvak[];
  dates: string[];
  lastUpdated: string;
  sabhaMeta: Record<SabhaType, SabhaMeta>;
  sabhaSessionMeta: Record<SabhaType, Record<string, SessionMeta>>;
}

export interface ReminderItem {
  id: string;
  reminderKey: string;
  yuvakName: string;
  phoneNumber: string;
  followUpKK: string;
  sabhaType: SabhaType;
  riskLevel: ReminderRiskLevel;
  missedSabhaCount: number;
  missedSabhaDates: string[];
  status: ReminderStatus;
  requiresLeaderReview: boolean;
  escalatedByUserId: string | null;
  escalatedByName: string | null;
  escalatedAt: string | null;
  takenOverByUserId: string | null;
  takenOverByName: string | null;
  takenOverAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderSummary {
  total: number;
  moderate: number;
  high: number;
  pending: number;
  acknowledged: number;
  escalated: number;
  resolved: number;
}

export interface UpcomingEkadashi {
  dateIso: string;
  displayDate: string;
  tithiName: string;
  paksha: string;
  daysUntil: number;
  location: string;
  timezone: string;
  nextTen: Array<{
    dateIso: string;
    displayDate: string;
    tithiName: string;
    paksha: string;
    daysUntil: number;
  }>;
}

export interface KKStats {
  name: string;
  yuvaks: Yuvak[];
  sabhaTypes: SabhaType[];
  greenCount: number;
  yellowCount: number;
  redCount: number;
  avgAttendance: number;
}

export interface SabhaSessionStat {
  date: string;
  count: number;
  percentage: number;
  areaBreakdown?: Array<{
    area: string;
    attended: number;
  }>;
}

export interface SabhaStats {
  sabhaType: SabhaType;
  totalYuvaks: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  avgAttendance: number;
  superActiveCount: number;
  sessionTrend: SabhaSessionStat[];
}
