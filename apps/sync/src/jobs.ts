export interface SyncJob {
  id: string;
  label: string;
  /**
   * When false the job is refused at start (Bal Sabha data in Sampark is
   * still being curated, so the job is parked until the roster is accurate).
   */
  enabled: boolean;
  /**
   * Primary Sampark sabha PAGE name (what the scraper clicks).
   * For single-page jobs this is the only page; multi-page jobs also set
   * samparkSabhaNames below.
   */
  samparkSabhaName: string;
  /**
   * Full list of Sampark sabha PAGE names synced in ONE run. Sampark exposes
   * Bal Sabha as two separate pages ('Chirag Nagar (Bal)', 'Maneklal (Bal)')
   * while the dashboard/DB must treat them as ONE sabha (sabha_type
   * 'Bal Sabha'), so the bal job loops over this list. Unset/length 1 =
   * single-page job (kishor/yuvak keep samparkSabhaName only).
   */
  samparkSabhaNames?: string[];
  /** Matches the visible page label of this job's Sampark sabha page(s). */
  samparkSabhaPattern: RegExp;
  /**
   * Literal DB value stored in member.sabha_type / sabha_session.sabha_type
   * — the ONE dashboard sabha this job writes to.
   */
  sabhaType: string;
  /**
   * Sampark page name → member.sampark_sabha value used to scope the DB
   * roster for that page (upsertAttendance memberScope). Values must match
   * member.sampark_sabha EXACTLY as stored. Unset for single-page jobs,
   * which keep the legacy roster filter.
   */
  memberScopeBySamparkSabha?: Record<string, string>;
}

/**
 * sabhaType is the literal DB value stored in the Neon
 * `member.sabha_type` / `sabha_session.sabha_type` columns.
 * 'Chirag Nagar(Kishor)' is intentional — parentheses, no space.
 */
export const SABHA_TYPES = {
  kishor: "Chirag Nagar(Kishor)",
  yuvak: "Chirag Nagar",
  bal: "Bal Sabha",
} as const;

/**
 * Sampark page name → member.sampark_sabha roster scope for the Bal job.
 * Both values match the member.sampark_sabha column values EXACTLY as
 * stored ('Chirag Nagar (Bal)' = 32 rows, 'Maneklal (Bal)' = 51 rows).
 */
const BAL_MEMBER_SCOPE = {
  "Chirag Nagar (Bal)": "Chirag Nagar (Bal)",
  "Maneklal (Bal)": "Maneklal (Bal)",
} as const;

export const JOBS = [
  {
    enabled: true,
    id: "kishor",
    label: "Chirag Nagar (Kishor)",
    samparkSabhaName: "Chirag Nagar (Kishore)",
    samparkSabhaPattern: /Chirag Nagar\s*\(Kishor(?:e)?\)/i,
    sabhaType: SABHA_TYPES.kishor,
  },
  {
    enabled: true,
    id: "yuvak",
    label: "Chirag Nagar (Yuvak)",
    samparkSabhaName: "Chirag Nagar",
    samparkSabhaPattern: /^Chirag Nagar$/i,
    sabhaType: SABHA_TYPES.yuvak,
  },
  {
    enabled: false,
    id: "bal",
    label: "Bal Sabha",
    // Primary page = the first Sampark page synced in the run.
    samparkSabhaName: "Chirag Nagar (Bal)",
    // Sampark exposes Bal Sabha as TWO separate pages; both must be scraped
    // and merged into the single 'Bal Sabha' dashboard sabha per run.
    samparkSabhaNames: ["Chirag Nagar (Bal)", "Maneklal (Bal)"],
    // Matches either page label exactly (same relative format as the kishor
    // job: full name + parenthesized sub-sabha tag).
    samparkSabhaPattern: /(?:Chirag Nagar|Maneklal)\s*\(\s*Bal\s*\)/i,
    sabhaType: SABHA_TYPES.bal,
    memberScopeBySamparkSabha: { ...BAL_MEMBER_SCOPE },
  },
] satisfies SyncJob[];

export type SyncJobId = (typeof JOBS)[number]["id"];

export function getJobById(jobId: string): SyncJob | undefined {
  return JOBS.find((job) => job.id === jobId);
}

/**
 * Members Attendance REPORT flow (Sampark Reports page → Export → xlsx import).
 * The exported xlsx's Sabha column distinguishes the two Chirag Nagar sabhas;
 * each value maps to the literal DB sabha_type the marks are written under.
 * Roster scope mirrors the kishor/yuvak jobs: members match where
 * `sabha_type = sabhaType OR sampark_sabha = sabhaType`.
 */
export interface ReportSabhaMapping {
  /** Exact Sabha column value observed in the exported Members Attendance xlsx. */
  reportSabha: string;
  /** Short log/report label ("Yuva" / "Kishor"). */
  label: string;
  /** Literal DB sabha_type for sabha_session / member.sabha_type. */
  sabhaType: string;
}

export const REPORT_SABHA_MAP: readonly ReportSabhaMapping[] = [
  { reportSabha: "Chirag Nagar", label: "Yuva", sabhaType: SABHA_TYPES.yuvak },
  { reportSabha: "Chirag Nagar (Kishore)", label: "Kishor", sabhaType: SABHA_TYPES.kishor },
];

