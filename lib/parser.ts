import Papa from 'papaparse';
import { Yuvak, ParsedSheetData, SabhaType } from './types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Google Sheets/Excel serial epoch offset: days between Dec 30 1899 and Jan 1 1970.
const SHEETS_EPOCH_OFFSET = 25569;

/**
 * Convert a Google Sheets / Excel date serial number to a "DD-Mon-YY" string.
 * Serials are days since Dec 30, 1899. For datetime values (fractional serials,
 * e.g. a cell storing midnight IST = 18:30 UTC = serial .770833), we Math.round
 * to the nearest day so the correct calendar date is preserved regardless of
 * what timezone the sheet owner used.
 */
function sheetSerialToStr(serial: number): string {
  const daysSinceEpoch = Math.round(serial) - SHEETS_EPOCH_OFFSET;
  const d = new Date(daysSinceEpoch * 86_400_000);
  const year = d.getUTCFullYear();
  if (year < 1990 || year > 2100) return String(serial); // not a plausible date
  const dd  = String(d.getUTCDate()).padStart(2, '0');
  const mon = MONTHS[d.getUTCMonth()];
  const yy  = String(year).slice(-2);
  return `${dd}-${mon}-${yy}`;
}

/** Coerce any cell value (number, Date, boolean, null, undefined) to a string */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'yes' : '';
  if (val instanceof Date) {
    // SheetJS may produce dates with a time component: when the spreadsheet owner is
    // in IST (+5:30), a "Feb 25" date cell is stored as midnight IST = 18:30 UTC the
    // previous day (serial 46077.770...). getUTCDate() on that returns Feb 24.
    // Round to the nearest UTC day to recover the correct calendar date.
    const MS_PER_DAY = 86_400_000;
    const roundedMs = Math.round(val.getTime() / MS_PER_DAY) * MS_PER_DAY;
    const d = new Date(roundedMs);
    const dd  = String(d.getUTCDate()).padStart(2, '0');
    const mon = MONTHS[d.getUTCMonth()];
    const yy  = String(d.getUTCFullYear()).slice(-2);
    return `${dd}-${mon}-${yy}`;
  }
  if (typeof val === 'number') {
    // Google Sheets API UNFORMATTED_VALUE returns date serials as numbers.
    // Values > 29221 correspond to dates after 1980-01-01, well above any
    // realistic attendance count or percentage in this app.
    if (val > 29_221) return sheetSerialToStr(val);
    return String(val);
  }
  return String(val);
}

/** Normalise a 2D array so every cell is a plain string */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRows(raw: any[][]): string[][] {
  return raw.map((row) => (Array.isArray(row) ? row.map(toStr) : []));
}

// Matches dates like "25-Feb-26", "4-Mar-26", "1-Jan-25", "25/02/26" etc.
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
  // Excel stores percentages as decimals (e.g. 0.75 for 75%) — detect and convert
  return num > 0 && num <= 1 ? Math.round(num * 100) : num;
}

/** Core parsing logic — shared between CSV and Sheets API paths */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRows(rawRows: any[][]): ParsedSheetData {
  const rows = normalizeRows(rawRows);
  if (rows.length < 2) return { yuvaks: [], dates: [], lastUpdated: new Date().toISOString() };

  // Find the header row — the one that contains "Yuvak Name"
  let headerRowIdx = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes('yuvak name'))
  );
  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers = rows[headerRowIdx].map((h) => h.trim());
  const dataRows = rows.slice(headerRowIdx + 1).filter((row) => row.some((c) => c?.trim()));

  // Compute non-sabha indices first so we can exclude them from the sabhaType scan
  const idxBase = {
    name: headers.findIndex((h) => normalizeHeader(h).includes('yuvak name')),
    area: headers.findIndex((h) => normalizeHeader(h) === 'area'),
    followUpKK: headers.findIndex((h) => normalizeHeader(h).includes('follow') && normalizeHeader(h).includes('kk')),
    std: headers.findIndex((h) => normalizeHeader(h) === 'std'),
    attendingSabha: headers.findIndex((h) => normalizeHeader(h).includes('attending sabha')),
    sabhasAttended: headers.findIndex((h) => normalizeHeader(h).includes('no. of sabhas') || normalizeHeader(h).includes('sabhas attended')),
    attendancePercent: headers.findIndex((h) => normalizeHeader(h).includes('attendance %') || normalizeHeader(h).includes('attandance %')),
    superActive: headers.findIndex((h) => normalizeHeader(h).includes('super active')),
  };

  // Detect sabhaType column — must be done AFTER idxBase so we can exclude those cols
  const sabhaTypeIdx = (() => {
    // 1. Try common header names
    const byHeader = headers.findIndex((h) => {
      const n = normalizeHeader(h);
      if (n.includes('attending') || n.includes('no. of') || n.includes('attended')) return false;
      return n === 'sabha' || n === 'sabha type' || n.includes('type of sabha') ||
        (n.includes('cn') && n.includes('kishor')) || (n.includes('kishor') && n.includes('cn'));
    });
    if (byHeader !== -1) return byHeader;

    // 2. Fallback: look for a CATEGORICAL column (≤4 distinct values) that contains
    //    "kishor" — this avoids false-positives from KK-name columns (which have many values)
    const knownCols = new Set(Object.values(idxBase).filter((i) => i >= 0));
    const sampleRows = dataRows.slice(0, 40);
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      if (isDateHeader(headers[colIdx])) continue;
      if (knownCols.has(colIdx)) continue; // skip name, KK, area, std, etc.
      const values = sampleRows
        .map((row) => row[colIdx]?.trim().toLowerCase())
        .filter(Boolean);
      const distinct = new Set(values);
      // Categorical (≤4 unique values) AND contains "kishor" → sabhaType column
      if (distinct.size >= 1 && distinct.size <= 4 && [...distinct].some((v) => v.includes('kishor'))) {
        return colIdx;
      }
    }
    return -1;
  })();

  const idx = { ...idxBase, sabhaType: sabhaTypeIdx };

  const dateColIndices: number[] = [];
  headers.forEach((h, i) => {
    if (isDateHeader(h)) dateColIndices.push(i);
  });

  const dates = dateColIndices.map((i) => headers[i]);

  const yuvaks: Yuvak[] = dataRows
    .filter((row) => {
      const name = idx.name >= 0 ? row[idx.name]?.trim() : '';
      if (!name || name.length <= 1) return false;

      if (idx.sabhaType >= 0) {
        const sabhaRaw = row[idx.sabhaType]?.trim().toLowerCase() ?? '';
        // Must explicitly contain "chirag nagar" — excludes "Unknown", blank, any other sabha
        if (!sabhaRaw.includes('chirag nagar')) return false;
      } else {
        // Column not detected: exclude any row that has a cell literally equal to "unknown"
        // (guards against Unknown sabha rows slipping through when detection fails)
        if (row.some((cell) => cell?.trim().toLowerCase() === 'unknown')) return false;
      }
      return true;
    })
    .map((row) => {
      const dateAttendance: Record<string, boolean> = {};
      dateColIndices.forEach((colIdx, di) => {
        dateAttendance[dates[di]] = parseBool(row[colIdx] ?? '');
      });

      const sabhaRaw = idx.sabhaType >= 0 ? row[idx.sabhaType]?.trim() ?? '' : '';
      const sabhaType: SabhaType = sabhaRaw.toLowerCase().includes('kishor')
        ? 'Chirag Nagar(Kishor)'
        : 'Chirag Nagar';

      const pct = idx.attendancePercent >= 0 ? parsePercent(row[idx.attendancePercent] ?? '') : 0;
      const attended = idx.sabhasAttended >= 0 ? parseInt(row[idx.sabhasAttended] ?? '0', 10) || 0 : 0;
      const total = dates.length > 0 ? dates.length : (pct > 0 && attended > 0 ? Math.round((attended / pct) * 100) : 0);

      return {
        name: idx.name >= 0 ? row[idx.name]?.trim() ?? '' : '',
        area: idx.area >= 0 ? row[idx.area]?.trim() ?? '' : '',
        followUpKK: idx.followUpKK >= 0 ? row[idx.followUpKK]?.trim() ?? '' : '',
        sabhaType,
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
    lastUpdated: new Date().toISOString(),
  };
}

/** Parse from CSV text (fallback / public sheet path) */
export function parseSheetCSV(csvText: string): ParsedSheetData {
  const result = Papa.parse(csvText, { skipEmptyLines: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseRows(result.data as any[][]);
}

/** Parse data from Google Sheets API or SheetJS (2D array, any cell types) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSheetRows(rows: any[][]): ParsedSheetData {
  return parseRows(rows);
}
