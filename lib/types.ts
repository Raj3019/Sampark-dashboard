export type SabhaType = 'Chirag Nagar' | 'Chirag Nagar(Kishor)';
export type AttendanceStatus = 'green' | 'yellow' | 'red';

export interface Yuvak {
  name: string;
  area: string;
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
