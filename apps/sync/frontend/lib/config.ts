import fs from "fs";
import path from "path";

/**
 * Resolve the Google Sheet URL the jobs write to.
 *
 * The sheet ID lives in the project's root `.env` (GOOGLE_SHEET_ID), which the
 * scraper child process loads via dotenv. The Next server itself only auto-loads
 * env files from `frontend/`, so we fall back to reading the root `.env` directly
 * to avoid duplicating the value.
 */
export function getSheetUrl(): string | null {
  let id =
    process.env.GOOGLE_SHEET_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID?.trim() ||
    "";

  if (!id) {
    try {
      const envPath = path.join(process.cwd(), "..", ".env");
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^\s*GOOGLE_SHEET_ID\s*=\s*(.+?)\s*$/m);
      if (match) id = match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // Root .env not available — fall through and return null below.
    }
  }

  if (!id) return null;

  id = id.replace(/\/+$/, ""); // strip any accidental trailing slashes
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
