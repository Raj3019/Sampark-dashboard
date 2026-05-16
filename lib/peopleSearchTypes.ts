import { AttendanceStatus } from '@/lib/types';

export type PeopleSearchResultType = 'yuvak' | 'kk' | 'leader';

export type PeopleSearchResult = {
  type: PeopleSearchResultType;
  id: string;
  title: string;
  subtitle: string;
  meta: string;
};

export type AttendanceRecord = {
  date: string;
  present: boolean;
};

export type DetailVisibility = {
  personal: boolean;
  restrictedReason?: string;
};

export type YuvakDetail = {
  type: 'yuvak';
  visibility: DetailVisibility;
  profile: {
    name: string;
    phoneNumber: string | null;
    dob: string | null;
    std: string;
    area: string;
    sabhaType: string;
    followUpKK: string;
    attendingSabha: boolean;
  };
  attendance: {
    totalSabhas: number;
    sabhasAttended: number;
    attendancePercent: number;
    lastSabhaDate: string | null;
    lastSabhaPresent: boolean | null;
    last6: AttendanceRecord[];
    records: AttendanceRecord[];
  };
  status: {
    risk: AttendanceStatus;
    superActive: boolean;
  };
};

export type KkDetailYuvak = {
  id: string;
  name: string;
  sabhaType: string;
  area: string;
  phoneNumber: string | null;
  attendancePercent: number;
  risk: AttendanceStatus;
  lastSabhaPresent: boolean | null;
};

export type KkDetail = {
  type: 'kk';
  visibility: DetailVisibility;
  profile: {
    name: string;
    user: {
      id: string;
      name: string;
      email: string | null;
      username: string | null;
      createdAt: string | null;
    } | null;
  };
  selfAttendance: {
    yuvakId: string;
    sabhaType: string;
    area: string;
    phoneNumber: string | null;
    dob: string | null;
    std: string;
    totalSabhas: number;
    sabhasAttended: number;
    attendancePercent: number;
    risk: AttendanceStatus;
    superActive: boolean;
    lastSabhaDate: string | null;
    lastSabhaPresent: boolean | null;
    last6: AttendanceRecord[];
    records: AttendanceRecord[];
  } | null;
  summary: {
    totalYuvaks: number;
    activeCount: number;
    attentionCount: number;
    highRiskCount: number;
    avgAttendance: number;
  };
  sabhaSplit: Array<{
    sabhaType: string;
    count: number;
  }>;
  assignedYuvaks: KkDetailYuvak[];
};

export type LeaderDetail = {
  type: 'leader';
  visibility: DetailVisibility;
  profile: {
    id: string;
    name: string;
    role: 'leader' | 'admin';
    email: string | null;
    username: string | null;
    createdAt: string | null;
  };
  summary: {
    scope: string;
    totalYuvaks: number;
    totalKKs: number;
    sabhaCount: number;
    avgAttendance: number;
  };
};

export type PersonDetail = YuvakDetail | KkDetail | LeaderDetail;
