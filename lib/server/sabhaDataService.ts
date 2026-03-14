import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { getSheetsClient } from '@/lib/googleAuth';
import { parseSheetRows } from '@/lib/parser';
import { ParsedSheetData } from '@/lib/types';

const CACHE_TTL_MS = 60_000;

let cachedData: ParsedSheetData | null = null;
let cacheExpiresAt = 0;

export type CacheStatus = 'HIT' | 'MISS';

export async function getSabhaData(options?: { forceFresh?: boolean }): Promise<{ data: ParsedSheetData; cache: CacheStatus }> {
  const forceFresh = options?.forceFresh ?? false;

  if (!forceFresh && cachedData && Date.now() < cacheExpiresAt) {
    return { data: cachedData, cache: 'HIT' };
  }

  const rows = await fetchSheetRows();
  const data = parseSheetRows(rows);

  cachedData = data;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return { data, cache: 'MISS' };
}

async function fetchSheetRows(): Promise<string[][]> {
  const fileId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME;

  if (!fileId) {
    throw new Error('GOOGLE_SHEET_ID is not set in .env');
  }

  try {
    const sheets = getSheetsClient();
    const range = sheetName ? (sheetName.includes(' ') ? `'${sheetName}'` : sheetName) : undefined;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: range ?? 'A:ZZ',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return (response.data.values ?? []) as string[][];
  } catch {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!email || !rawKey) throw new Error('Missing service account credentials');

    const privateKey = rawKey.replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    let dlResponse;
    try {
      dlResponse = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    } catch (driveErr: unknown) {
      const status = (driveErr as { status?: number; code?: number })?.status
        ?? (driveErr as { status?: number; code?: number })?.code;
      if (status === 403) {
        throw new Error(
          `403 Forbidden - Two things to check:\n` +
          `1. Share the file in Google Drive with: ${email}\n` +
          `2. Enable "Google Drive API" at console.cloud.google.com -> APIs & Services`
        );
      }
      throw driveErr;
    }

    const buffer = Buffer.from(dlResponse.data as ArrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];

    const worksheet = workbook.Sheets[targetSheet];
    return XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
  }
}
