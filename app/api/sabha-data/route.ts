import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import { getSheetsClient } from '@/lib/googleAuth';
import { parseSheetRows } from '@/lib/parser';
import { ParsedSheetData } from '@/lib/types';

// ---------------------------------------------------------------------------
// In-memory cache — avoids a live Google API call on every request.
// The Next.js API route runs in a long-lived Node process, so the cache
// persists across requests for the lifetime of the server.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60_000; // 60 seconds — matches the client poll interval
let cachedData: ParsedSheetData | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  // Serve from cache if still fresh
  if (cachedData && Date.now() < cacheExpiresAt) {
    return NextResponse.json(cachedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Cache': 'HIT',
      },
    });
  }

  const fileId = process.env.GOOGLE_SHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME;

  if (!fileId) {
    return NextResponse.json(
      { error: 'GOOGLE_SHEET_ID is not set in .env' },
      { status: 500 }
    );
  }

  try {
    // Try Google Sheets API first (works for native .gsheet files)
    // Falls back to Drive API download for .xlsx files
    let rows: string[][];

    try {
      const sheets = getSheetsClient();
      const range = sheetName
        ? sheetName.includes(' ') ? `'${sheetName}'` : sheetName
        : undefined;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: range ?? 'A:ZZ',
      });
      rows = (response.data.values ?? []) as string[][];
    } catch {
      // File is an Excel file in Drive — download and parse with SheetJS
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
        dlResponse = await drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
      } catch (driveErr: unknown) {
        const status = (driveErr as { status?: number; code?: number })?.status
          ?? (driveErr as { status?: number; code?: number })?.code;
        if (status === 403) {
          throw new Error(
            `403 Forbidden — Two things to check:\n` +
            `1. Share the file in Google Drive with: ${email}\n` +
            `2. Enable "Google Drive API" at console.cloud.google.com → APIs & Services`
          );
        }
        throw driveErr;
      }

      const buffer = Buffer.from(dlResponse.data as ArrayBuffer);
      // cellDates: true → SheetJS converts Excel date serial numbers to JS Date objects
      // so date-formatted column headers come through as Date, not raw numbers
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      // Use specified sheet name or first sheet
      const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
        ? sheetName
        : workbook.SheetNames[0];

      const worksheet = workbook.Sheets[targetSheet];
      rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });
    }

    const data = parseSheetRows(rows);

    // Populate cache
    cachedData = data;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Cache': 'MISS',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch sheet data: ${message}` }, { status: 500 });
  }
}
