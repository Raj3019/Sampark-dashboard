export type SabhaKey = 'CN' | 'AYC' | 'BAL' | 'yuva' | 'ayc' | 'bal' | string;

export const SABHA_STORED_TYPES = ['Chirag Nagar', 'Chirag Nagar(Kishor)', 'Bal Sabha'] as const;

export type AttendanceMemberRow = {
  id: string;
  full_name: string;
  phone_number: string | null;
  date_of_birth: string | null;
  area: string | null;
  std: string | null;
  sabha_type: string;
  follow_up_member_id: string | null;
  is_kk: boolean;
  attending: boolean;
  super_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SabhaSessionRow = {
  id: string;
  sabha_type: string;
  session_date: string;
  vakta: string | null;
  topic: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecordRow = {
  id: string;
  session_id: string;
  member_id: string;
  present: boolean;
};

export type SyncAttendancePayload = {
  sabhaType: string;
  sessionDate: string;
  sabhaDateDisplay?: string;
  presentNames: string[];
  absentNames: string[];
};

export type SyncUpsertOutcome = {
  matchedPresent: number;
  matchedAbsent: number;
  unknownNames: string[];
  skippedVisitors: number;
  createdSessions: number;
  correctedMarks: number;
};
