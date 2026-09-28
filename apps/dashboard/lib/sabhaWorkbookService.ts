import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { getSheetsClient } from '@/lib/googleAuth';
import { parseWorkbookSheets } from '@/lib/parser';
import { ParsedSheetData, Yuvak } from '@/lib/types';
import { getSabhaSheetEnvConfig } from '@/lib/sabha';
import { getAuthPool } from '@/lib/auth/db';

const CACHE_TTL_MS = 60_000;
const SHEETS_TIMEOUT_MS = 15_000;   // per-sheet Sheets API call
const DRIVE_METADATA_TIMEOUT_MS = 8_000;
const DRIVE_TIMEOUT_MS  = 35_000;   // full workbook download via Drive
const DRIVE_MAX_RETRIES = 2;
const DRIVE_RETRY_DELAY_MS = 1_500;

let cachedData: ParsedSheetData | null = null;
let cacheExpiresAt = 0;
let cachedDriveFingerprint: string | null = null;
let inflightRefresh: Promise<{ data: ParsedSheetData; cache: CacheStatus }> | null = null;

export type CacheStatus = 'HIT' | 'MISS';

type WorkbookRows = {
  sabhaType: 'Chirag Nagar' | 'Chirag Nagar(Kishor)' | 'Bal Sabha';
  sheetName: string;
  rows: string[][];
};

type SheetConfig = {
  sabhaType: 'Chirag Nagar' | 'Chirag Nagar(Kishor)' | 'Bal Sabha';
  envKey: string;
  fallback: string;
  sheetName: string;
};

type WorkbookFetchResult =
  | { kind: 'rows'; rows: WorkbookRows[] }
  | { kind: 'cached'; data: ParsedSheetData };

export async function getSabhaData(options?: { forceFresh?: boolean }): Promise<{ data: ParsedSheetData; cache: CacheStatus }> {
  const forceFresh = options?.forceFresh ?? false;

  if (!forceFresh && cachedData && Date.now() < cacheExpiresAt) {
    return { data: cachedData, cache: 'HIT' };
  }

  if (!forceFresh && inflightRefresh) {
    return await inflightRefresh;
  }

  const refreshPromise = refreshSabhaData(forceFresh);
  inflightRefresh = refreshPromise;

  try {
    return await refreshPromise;
  } catch (err) {
    // If a stale cache exists, return it rather than surfacing an error
    if (cachedData) {
      console.warn('Fresh fetch failed, serving stale cache:', err instanceof Error ? err.message : err);
      return { data: cachedData, cache: 'HIT' };
    }
    throw err;
  } finally {
    if (inflightRefresh === refreshPromise) {
      inflightRefresh = null;
    }
  }
}

async function refreshSabhaData(forceFresh: boolean): Promise<{ data: ParsedSheetData; cache: CacheStatus }> {
  const previousData = cachedData;
  const workbookResult = await fetchWorkbookRows({ forceFresh });

  if (workbookResult.kind === 'cached') {
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return { data: workbookResult.data, cache: 'HIT' };
  }

  const rows = workbookResult.rows;
  const data = parseWorkbookSheets(rows);

  // Detect and log changes in the background (don't block the response)
  if (previousData) {
    detectAndLogChanges(previousData, data).catch((err) =>
      console.error('Sheet change detection failed:', err)
    );
  }

  cachedData = data;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return { data, cache: 'MISS' };
}

// ── Change detection ──────────────────────────────────────────────────────────

type ChangeEntry = {
  sabhaType: string;
  changeType: string;
  description: string;
};

async function detectAndLogChanges(
  previous: ParsedSheetData,
  current: ParsedSheetData
): Promise<void> {
  const changes: ChangeEntry[] = [];

  const sabhaTypes = ['Chirag Nagar', 'Chirag Nagar(Kishor)', 'Bal Sabha'] as const;

  for (const sabhaType of sabhaTypes) {
    const prevYuvaks = previous.yuvaks.filter((y) => y.sabhaType === sabhaType);
    const currYuvaks = current.yuvaks.filter((y) => y.sabhaType === sabhaType);

    const prevMap = new Map<string, Yuvak>(prevYuvaks.map((y) => [y.name, y]));
    const currMap = new Map<string, Yuvak>(currYuvaks.map((y) => [y.name, y]));

    // Added yuvaks
    for (const [name] of currMap) {
      if (!prevMap.has(name)) {
        changes.push({ sabhaType, changeType: 'yuvak_added', description: `"${name}" was added to ${sabhaType}` });
      }
    }

    // Removed yuvaks
    for (const [name] of prevMap) {
      if (!currMap.has(name)) {
        changes.push({ sabhaType, changeType: 'yuvak_removed', description: `"${name}" was removed from ${sabhaType}` });
      }
    }

    // Changes for yuvaks present in both
    for (const [name, currY] of currMap) {
      const prevY = prevMap.get(name);
      if (!prevY) continue;

      // Attendance changes
      const allDates = new Set([
        ...Object.keys(prevY.dateAttendance),
        ...Object.keys(currY.dateAttendance),
      ]);
      for (const date of allDates) {
        const prev = prevY.dateAttendance[date] ?? false;
        const curr = currY.dateAttendance[date] ?? false;
        if (curr && !prev) {
          changes.push({ sabhaType, changeType: 'attendance_marked', description: `"${name}" marked present on ${date} (${sabhaType})` });
        } else if (!curr && prev) {
          changes.push({ sabhaType, changeType: 'attendance_unmarked', description: `"${name}" marked absent on ${date} (${sabhaType})` });
        }
      }

      // Field changes
      if (prevY.area !== currY.area && currY.area) {
        changes.push({ sabhaType, changeType: 'field_changed', description: `"${name}" area changed from "${prevY.area || 'blank'}" to "${currY.area}" (${sabhaType})` });
      }
      if (prevY.followUpKK !== currY.followUpKK && currY.followUpKK) {
        changes.push({ sabhaType, changeType: 'field_changed', description: `"${name}" follow-up KK changed from "${prevY.followUpKK || 'blank'}" to "${currY.followUpKK}" (${sabhaType})` });
      }
      if (prevY.attendingSabha !== currY.attendingSabha) {
        changes.push({
          sabhaType,
          changeType: 'field_changed',
          description: `"${name}" attendance status changed to ${currY.attendingSabha ? 'Attending' : 'Not Attending'} (${sabhaType})`,
        });
      }
    }
  }

  if (changes.length === 0) return;

  const pool = getAuthPool();
  for (const change of changes) {
    await pool.query(
      `INSERT INTO "sheet_change_log" ("id", "sabhaType", "changeType", "description", "detectedAt")
       VALUES ($1, $2, $3, $4, NOW())`,
      [crypto.randomUUID(), change.sabhaType, change.changeType, change.description]
    );
  }
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWorkbookRows(options?: { forceFresh?: boolean }): Promise<WorkbookFetchResult> {
  const sheetConfigs: SheetConfig[] = getSabhaSheetEnvConfig().map((config) => ({
    ...config,
    sheetName: process.env[config.envKey] || config.fallback,
  }));

  const fileId = process.env.GOOGLE_SHEET_ID;
  if (!fileId) {
    throw new Error('GOOGLE_SHEET_ID is not set in .env');
  }

  try {
    const sheets = getSheetsClient();
    let shouldFallbackToDrive = false;

    const rows = await Promise.all(sheetConfigs.map(async (config) => {
      const range = `${config.sheetName.includes(' ') ? `'${config.sheetName}'` : config.sheetName}!A:ZZ`;

      try {
        const response = await withTimeout(
          sheets.spreadsheets.values.get({
            spreadsheetId: fileId,
            range,
            valueRenderOption: 'UNFORMATTED_VALUE',
          }),
          SHEETS_TIMEOUT_MS,
          `Google Sheets fetch for ${config.sheetName}`
        );

        return {
          sabhaType: config.sabhaType,
          sheetName: config.sheetName,
          rows: (response.data.values ?? []) as string[][],
        };
      } catch (sheetErr) {
        if (isUnsupportedDocumentError(sheetErr)) throw sheetErr;
        if (isTimeoutError(sheetErr)) {
          shouldFallbackToDrive = true;
        }
        console.error(`Sheet "${config.sheetName}" could not be fetched: ${sheetErr instanceof Error ? sheetErr.message : sheetErr}`);
        return {
          sabhaType: config.sabhaType,
          sheetName: config.sheetName,
          rows: [] as string[][],
        };
      }
    }));

    if (shouldFallbackToDrive) {
      console.warn('One or more Google Sheets tab reads timed out. Falling back to Google Drive workbook download.');
      return await fetchWorkbookRowsFromDrive(fileId, sheetConfigs, { forceFresh: options?.forceFresh ?? false });
    }

    return { kind: 'rows', rows };
  } catch (error) {
    if (!isUnsupportedDocumentError(error)) {
      const message = error instanceof Error ? error.message : 'Unknown Sheets API error';
      throw new Error(`Failed to fetch sheet data: ${message}`);
    }

    return await fetchWorkbookRowsFromDrive(fileId, sheetConfigs, { forceFresh: options?.forceFresh ?? false });
  }
}

function isUnsupportedDocumentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('not supported for this document');
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('timed out');
}

async function fetchWorkbookRowsFromDrive(
  fileId: string,
  sheetConfigs: SheetConfig[],
  options?: { forceFresh?: boolean }
): Promise<WorkbookFetchResult> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error('Missing service account credentials');
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  if (!options?.forceFresh && cachedData && cachedDriveFingerprint) {
    const latestFingerprint = await getDriveFileFingerprint(drive, fileId).catch((err) => {
      console.warn('Drive metadata check failed, falling back to workbook download:', err instanceof Error ? err.message : err);
      return null;
    });

    if (latestFingerprint && latestFingerprint === cachedDriveFingerprint) {
      return { kind: 'cached', data: cachedData };
    }
  }

  let lastErr: unknown;
  let buffer: Buffer | null = null;

  for (let attempt = 1; attempt <= DRIVE_MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' }),
        DRIVE_TIMEOUT_MS,
        `Google Drive workbook download (attempt ${attempt})`
      );
      buffer = Buffer.from(response.data as ArrayBuffer);
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`Drive download attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
      if (attempt < DRIVE_MAX_RETRIES) {
        await sleep(DRIVE_RETRY_DELAY_MS);
      }
    }
  }

  if (!buffer) {
    throw lastErr ?? new Error('Drive download failed after retries');
  }

  cachedDriveFingerprint = await getDriveFileFingerprint(drive, fileId).catch(() => cachedDriveFingerprint);
  const workbook = XLSX.read(buffer!, { type: 'buffer', cellDates: true });
  return { kind: 'rows', rows: extractConfiguredSheetsFromWorkbook(workbook, sheetConfigs) };
}

async function getDriveFileFingerprint(
  drive: ReturnType<typeof google.drive>,
  fileId: string
): Promise<string> {
  const response = await withTimeout(
    drive.files.get({
      fileId,
      fields: 'id,modifiedTime,md5Checksum,size,version',
      supportsAllDrives: true,
    }),
    DRIVE_METADATA_TIMEOUT_MS,
    'Google Drive workbook metadata lookup'
  );

  const meta = response.data;
  return [
    meta.id ?? fileId,
    meta.modifiedTime ?? 'no-modified-time',
    meta.md5Checksum ?? 'no-md5',
    meta.size ?? 'no-size',
    meta.version ?? 'no-version',
  ].join(':');
}

function extractConfiguredSheetsFromWorkbook(
  workbook: XLSX.WorkBook,
  sheetConfigs: SheetConfig[]
): WorkbookRows[] {
  return sheetConfigs.map((config) => {
    const worksheet = workbook.Sheets[config.sheetName];

    if (!worksheet) {
      console.error(`Sheet tab "${config.sheetName}" was not found in the workbook. Available tabs: ${workbook.SheetNames.join(', ')}`);
      return {
        sabhaType: config.sabhaType,
        sheetName: config.sheetName,
        rows: [] as string[][],
      };
    }

    return {
      sabhaType: config.sabhaType,
      sheetName: config.sheetName,
      rows: sheetToTrimmedRows(worksheet),
    };
  });
}

function sheetToTrimmedRows(worksheet: XLSX.WorkSheet): string[][] {
  const cellKeys = Object.keys(worksheet).filter((key) => !key.startsWith('!'));
  if (cellKeys.length === 0) return [];

  let minCol = Number.POSITIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxCol = 0;
  let maxRow = 0;

  for (const key of cellKeys) {
    const cell = XLSX.utils.decode_cell(key);
    minCol = Math.min(minCol, cell.c);
    minRow = Math.min(minRow, cell.r);
    maxCol = Math.max(maxCol, cell.c);
    maxRow = Math.max(maxRow, cell.r);
  }

  const range = XLSX.utils.encode_range({
    s: { c: minCol, r: minRow },
    e: { c: maxCol, r: maxRow },
  });

  return XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    defval: '',
    range,
  });
}
