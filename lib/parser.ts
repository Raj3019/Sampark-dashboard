import Papa from 'papaparse';
import { ParsedSheetData, SabhaMeta, SabhaType, SessionMeta, Yuvak } from './types';
import { SABHA_TYPES } from './sabha';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHEETS_EPOCH_OFFSET = 25569;

function sheetSerialToStr(serial: number): string {
  const daysSinceEpoch = Math.round(serial) - SHEETS_EPOCH_OFFSET;
  const d = new Date(daysSinceEpoch * 86_400_000);
  const year = d.getUTCFullYear();
  if (year < 1990 || year > 2100) return String(serial);
  const dd  = String(d.getUTCDate()).padStart(2, '0');
  const mon = MONTHS[d.getUTCMonth()];
  const yy  = String(year).slice(-2);
  return `${dd}-${mon}-${yy}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'yes' : '';
  if (val instanceof Date) {
    const MS_PER_DAY = 86_400_000;
    const roundedMs = Math.round(val.getTime() / MS_PER_DAY) * MS_PER_DAY;
    const d = new Date(roundedMs);
    const dd  = String(d.getUTCDate()).padStart(2, '0');
    const mon = MONTHS[d.getUTCMonth()];
    const yy  = String(d.getUTCFullYear()).slice(-2);
    return `${dd}-${mon}-${yy}`;
  }
  if (typeof val === 'number') {
    return String(val);
  }
  return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRows(raw: any[][]): string[][] {
  return raw.map((row) => (Array.isArray(row) ? row.map(toStr) : []));
}

function isDateHeader(header: string): boolean {
  const h = header.trim();
  return (
    /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/.test(h) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(h) ||
    /^[A-Za-z]{3}\s\d{1,2},?\s\d{2,4}$/.test(h)
  );
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function coerceDateLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (numericValue >= 29_221 && numericValue <= 80_000) {
      return sheetSerialToStr(numericValue);
    }
  }

  return trimmed;
}

function formatDateAsIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDobValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (numericValue >= 1 && numericValue <= 80_000) {
      const daysSinceEpoch = Math.round(numericValue) - SHEETS_EPOCH_OFFSET;
      const date = new Date(daysSinceEpoch * 86_400_000);
      if (!Number.isNaN(date.getTime())) {
        return formatDateAsIso(date);
      }
    }
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateAsIso(parsed);
  }

  return trimmed;
}

function parseBool(val: string): boolean {
  const normalized = val?.trim().toLowerCase();
  if (!normalized) return false;
  return [
    'yes',
    'y',
    'true',
    '1',
    '1.0',
    'attending',
    'active',
    'present',
    'p',
    'attended',
  ].includes(normalized);
}

function parseYesStrict(val: string): boolean {
  return val?.trim() === 'Yes';
}

function parsePercent(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace('%', '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num > 0 && num <= 1 ? Math.round(num * 100) : num;
}

function createEmptySabhaMeta(sheetName = ''): SabhaMeta {
  return { vakta: '', topic: '', sheetName };
}

function extractLabelValue(row?: string[]): string {
  if (!row) return '';
  return row
    .map((cell) => cell.trim())
    .filter(Boolean)
    .filter((cell) => {
      const normalized = cell.toLowerCase().replace(/[-\s>]/g, '');
      return normalized !== 'vakta' && normalized !== 'topic';
    })
    .join(' ')
    .trim();
}

function toComparableDate(value: string): number {
  const parsed = new Date(
    value
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/, (_m, day, mon, yy) => `${mon} ${day} 20${yy}`)
      .replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, (_m, day, mon, yyyy) => `${mon} ${day} ${yyyy}`)
  );
  return parsed.getTime();
}

export interface SheetParseInput {
  sabhaType: SabhaType;
  sheetName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[][];
}

function parseSingleSheet(input: SheetParseInput): { yuvaks: Yuvak[]; dates: string[]; sabhaMeta: SabhaMeta; sessionMetaByDate: Record<string, SessionMeta> } {
  const rows = normalizeRows(input.rows);
  if (rows.length < 2) {
    return { yuvaks: [], dates: [], sabhaMeta: createEmptySabhaMeta(input.sheetName), sessionMetaByDate: {} };
  }

  const headerRowIdx = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes('yuvak name'))
  );
  if (headerRowIdx === -1) {
    return { yuvaks: [], dates: [], sabhaMeta: createEmptySabhaMeta(input.sheetName), sessionMetaByDate: {} };
  }

  const headers = rows[headerRowIdx].map((h) => h.trim());
  const rowsAboveHeader = rows.slice(0, headerRowIdx);
  let bestDateRow: string[] = [];
  let bestDateCount = 0;

  // Some sheets place vakta/topic rows directly above headers, while date labels are higher.
  // Pick the row above headers that contains the highest number of date-like cells.
  rowsAboveHeader.forEach((candidate) => {
    const count = candidate.reduce((sum, cell) => {
      const coerced = coerceDateLabel(cell ?? '');
      return sum + (isDateHeader(coerced) ? 1 : 0);
    }, 0);
    if (count > bestDateCount) {
      bestDateCount = count;
      bestDateRow = candidate;
    }
  });

  const dataRows = rows.slice(headerRowIdx + 1).filter((row) => row.some((c) => c?.trim()));
  const vaktaRow = rows.find((row, idx) => idx < headerRowIdx && row.some((cell) => /^vakta/i.test(cell.trim())));
  const topicRow = rows.find((row, idx) => idx < headerRowIdx && row.some((cell) => /^topic/i.test(cell.trim())));

  const idx = {
    name: headers.findIndex((h) => normalizeHeader(h).includes('yuvak name')),
    area: headers.findIndex((h) => normalizeHeader(h) === 'area'),
    dob: headers.findIndex((h) => normalizeHeader(h) === 'dob'),
    phoneNumber: headers.findIndex((h) => {
      const nh = normalizeHeader(h);
      return nh.includes('phone') || nh.includes('mobile') || nh.includes('contact');
    }),
    followUpKK: headers.findIndex((h) => normalizeHeader(h).includes('follow') && normalizeHeader(h).includes('kk')),
    std: headers.findIndex((h) => normalizeHeader(h) === 'std'),
    attendingSabha: headers.findIndex((h) => {
      const nh = normalizeHeader(h);
      return nh.includes('attending sabha') || nh === 'attending' || (nh.includes('attending') && nh.includes('status'));
    }),
    sabhasAttended: headers.findIndex((h) => normalizeHeader(h).includes('no. of sabhas') || normalizeHeader(h).includes('sabhas attended')),
    attendancePercent: headers.findIndex((h) => normalizeHeader(h).includes('attendance %') || normalizeHeader(h).includes('attandance %')),
    superActive: headers.findIndex((h) => normalizeHeader(h).includes('super active')),
  };

  const dateColIndices: number[] = [];
  headers.forEach((h, i) => {
    const fromDateRow = coerceDateLabel(bestDateRow[i] ?? '');
    const fromHeader = coerceDateLabel(h);
    const dateLabel = isDateHeader(fromDateRow) ? fromDateRow : fromHeader;
    if (isDateHeader(dateLabel)) dateColIndices.push(i);
  });

  const dates = dateColIndices
    .map((i) => {
      const fromDateRow = coerceDateLabel(bestDateRow[i] ?? '');
      return isDateHeader(fromDateRow) ? fromDateRow : coerceDateLabel(headers[i]);
    })
    .filter(Boolean);
  const sessionMetaByDate: Record<string, SessionMeta> = {};

  dateColIndices.forEach((colIdx, di) => {
    const date = dates[di];
    if (!date) return;

    const vakta = (vaktaRow?.[colIdx] ?? '').trim();
    const topic = (topicRow?.[colIdx] ?? '').trim();

    if (!vakta && !topic) return;
    sessionMetaByDate[date] = { vakta, topic };
  });

  const yuvaks: Yuvak[] = dataRows
    .filter((row) => {
      const name = idx.name >= 0 ? row[idx.name]?.trim() : '';
      if (!name || name.length <= 1) return false;
      if (row.some((cell) => cell?.trim().toLowerCase() === 'unknown')) return false;
      return true;
    })
    .map((row) => {
      const dateAttendance: Record<string, boolean> = {};
      dateColIndices.forEach((colIdx, di) => {
        dateAttendance[dates[di]] = parseBool(row[colIdx] ?? '');
      });

      const pct = idx.attendancePercent >= 0 ? parsePercent(row[idx.attendancePercent] ?? '') : 0;
      const attended = idx.sabhasAttended >= 0 ? parseInt(row[idx.sabhasAttended] ?? '0', 10) || 0 : 0;
      const total = dates.length > 0 ? dates.length : (pct > 0 && attended > 0 ? Math.round((attended / pct) * 100) : 0);
      const hasAnySessionAttendance = Object.values(dateAttendance).some(Boolean);
      const inferredAttending = hasAnySessionAttendance || attended > 0 || pct > 0;

      return {
        name: idx.name >= 0 ? row[idx.name]?.trim() ?? '' : '',
        area: idx.area >= 0 ? row[idx.area]?.trim() ?? '' : '',
        phoneNumber: idx.phoneNumber >= 0 ? row[idx.phoneNumber]?.trim() ?? '' : '',
        dob: idx.dob >= 0 ? parseDobValue(row[idx.dob] ?? '') : '',
        followUpKK: idx.followUpKK >= 0 ? row[idx.followUpKK]?.trim() ?? '' : '',
        sabhaType: input.sabhaType,
        std: idx.std >= 0 ? row[idx.std]?.trim() ?? '' : '',
        attendingSabha: idx.attendingSabha >= 0 ? parseBool(row[idx.attendingSabha] ?? '') : inferredAttending,
        sabhasAttended: attended,
        attendancePercent: pct,
        superActive: idx.superActive >= 0 ? parseYesStrict(row[idx.superActive] ?? '') : false,
        dateAttendance,
        totalSabhas: total,
      };
    });

  return {
    yuvaks,
    dates,
    sabhaMeta: {
      vakta: extractLabelValue(vaktaRow),
      topic: extractLabelValue(topicRow),
      sheetName: input.sheetName,
    },
    sessionMetaByDate,
  };
}

export function parseWorkbookSheets(sheets: SheetParseInput[]): ParsedSheetData {
  const sabhaMeta = Object.fromEntries(
    SABHA_TYPES.map((sabhaType) => [sabhaType, createEmptySabhaMeta()])
  ) as Record<SabhaType, SabhaMeta>;

  const yuvaks: Yuvak[] = [];
  const uniqueDates = new Set<string>();
  const sabhaSessionMeta = Object.fromEntries(
    SABHA_TYPES.map((sabhaType) => [sabhaType, {} as Record<string, SessionMeta>])
  ) as Record<SabhaType, Record<string, SessionMeta>>;

  for (const sheet of sheets) {
    const parsed = parseSingleSheet(sheet);
    yuvaks.push(...parsed.yuvaks);
    parsed.dates.forEach((date) => uniqueDates.add(date));
    sabhaMeta[sheet.sabhaType] = parsed.sabhaMeta;
    sabhaSessionMeta[sheet.sabhaType] = parsed.sessionMetaByDate;
  }

  return {
    yuvaks,
    dates: Array.from(uniqueDates).sort((a, b) => toComparableDate(a) - toComparableDate(b)),
    lastUpdated: new Date().toISOString(),
    sabhaMeta,
    sabhaSessionMeta,
  };
}

export function parseSheetCSV(csvText: string): ParsedSheetData {
  const result = Papa.parse(csvText, { skipEmptyLines: true });
  return parseWorkbookSheets([
    {
      sabhaType: 'Chirag Nagar',
      sheetName: 'CSV Import',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: result.data as any[][],
    },
  ]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSheetRows(rows: any[][]): ParsedSheetData {
  return parseWorkbookSheets([
    {
      sabhaType: 'Chirag Nagar',
      sheetName: 'Attendance Data',
      rows,
    },
  ]);
}
