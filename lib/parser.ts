import Papa from 'papaparse';
import { ParsedSheetData, SabhaMeta, SabhaType, Yuvak } from './types';
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
    if (val > 29_221) return sheetSerialToStr(val);
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

function parseBool(val: string): boolean {
  return val?.trim().toLowerCase() === 'yes';
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

function parseSingleSheet(input: SheetParseInput): { yuvaks: Yuvak[]; dates: string[]; sabhaMeta: SabhaMeta } {
  const rows = normalizeRows(input.rows);
  if (rows.length < 2) {
    return { yuvaks: [], dates: [], sabhaMeta: createEmptySabhaMeta(input.sheetName) };
  }

  const headerRowIdx = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes('yuvak name'))
  );
  if (headerRowIdx === -1) {
    return { yuvaks: [], dates: [], sabhaMeta: createEmptySabhaMeta(input.sheetName) };
  }

  const headers = rows[headerRowIdx].map((h) => h.trim());
  const dateRow = rows[headerRowIdx - 1] ?? [];
  const dataRows = rows.slice(headerRowIdx + 1).filter((row) => row.some((c) => c?.trim()));
  const vaktaRow = rows.find((row, idx) => idx < headerRowIdx && row.some((cell) => /^vakta/i.test(cell.trim())));
  const topicRow = rows.find((row, idx) => idx < headerRowIdx && row.some((cell) => /^topic/i.test(cell.trim())));

  const idx = {
    name: headers.findIndex((h) => normalizeHeader(h).includes('yuvak name')),
    area: headers.findIndex((h) => normalizeHeader(h) === 'area'),
    followUpKK: headers.findIndex((h) => normalizeHeader(h).includes('follow') && normalizeHeader(h).includes('kk')),
    std: headers.findIndex((h) => normalizeHeader(h) === 'std'),
    attendingSabha: headers.findIndex((h) => normalizeHeader(h).includes('attending sabha')),
    sabhasAttended: headers.findIndex((h) => normalizeHeader(h).includes('no. of sabhas') || normalizeHeader(h).includes('sabhas attended')),
    attendancePercent: headers.findIndex((h) => normalizeHeader(h).includes('attendance %') || normalizeHeader(h).includes('attandance %')),
    superActive: headers.findIndex((h) => normalizeHeader(h).includes('super active')),
  };

  const dateColIndices: number[] = [];
  headers.forEach((h, i) => {
    const dateLabel = dateRow[i]?.trim() || h;
    if (isDateHeader(dateLabel)) dateColIndices.push(i);
  });

  const dates = dateColIndices.map((i) => dateRow[i]?.trim() || headers[i]).filter(Boolean);

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

      return {
        name: idx.name >= 0 ? row[idx.name]?.trim() ?? '' : '',
        area: idx.area >= 0 ? row[idx.area]?.trim() ?? '' : '',
        followUpKK: idx.followUpKK >= 0 ? row[idx.followUpKK]?.trim() ?? '' : '',
        sabhaType: input.sabhaType,
        std: idx.std >= 0 ? row[idx.std]?.trim() ?? '' : '',
        attendingSabha: idx.attendingSabha >= 0 ? parseBool(row[idx.attendingSabha] ?? '') : true,
        sabhasAttended: attended,
        attendancePercent: pct,
        superActive: idx.superActive >= 0 ? parseBool(row[idx.superActive] ?? '') : false,
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
  };
}

export function parseWorkbookSheets(sheets: SheetParseInput[]): ParsedSheetData {
  const sabhaMeta = Object.fromEntries(
    SABHA_TYPES.map((sabhaType) => [sabhaType, createEmptySabhaMeta()])
  ) as Record<SabhaType, SabhaMeta>;

  const yuvaks: Yuvak[] = [];
  const uniqueDates = new Set<string>();

  for (const sheet of sheets) {
    const parsed = parseSingleSheet(sheet);
    yuvaks.push(...parsed.yuvaks);
    parsed.dates.forEach((date) => uniqueDates.add(date));
    sabhaMeta[sheet.sabhaType] = parsed.sabhaMeta;
  }

  return {
    yuvaks,
    dates: Array.from(uniqueDates).sort((a, b) => toComparableDate(a) - toComparableDate(b)),
    lastUpdated: new Date().toISOString(),
    sabhaMeta,
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
