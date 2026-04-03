interface ProkeralaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ProkeralaTithi {
  name?: string;
  paksha?: string;
  start?: string;
}

interface ProkeralaPanchangResponse {
  status?: string;
  data?: {
    tithi?: ProkeralaTithi[];
  };
}

interface ProkeralaErrorResponse {
  status?: string;
  errors?: Array<{
    detail?: string;
    title?: string;
    code?: string;
  }>;
}

export interface EkadashiItem {
  dateIso: string;
  displayDate: string;
  tithiName: string;
  paksha: string;
  daysUntil: number;
}

export interface UpcomingEkadashiResult extends EkadashiItem {
  location: string;
  timezone: string;
  nextTen: EkadashiItem[];
}

const PROKERALA_TOKEN_URL = 'https://api.prokerala.com/token';
const PROKERALA_PANCHANG_URL = 'https://api.prokerala.com/v2/astrology/panchang';
const INDIA_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_LATITUDE = 23.0225;
const DEFAULT_LONGITUDE = 72.5714;
const DEFAULT_LOCATION = 'Ahmedabad';
const DEFAULT_SCAN_FALLBACK_DAYS = 15;

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;
let cachedUpcoming: { data: UpcomingEkadashiResult; expiresAtMs: number } | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getIndiaDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? 0);

  return { year, month, day };
}

function formatIndiaDate(date: Date): string {
  const { year, month, day } = getIndiaDateParts(date);
  const monthString = String(month).padStart(2, '0');
  const dayString = String(day).padStart(2, '0');
  return `${year}-${monthString}-${dayString}`;
}

function getDateAtOffset(offsetDays: number): Date {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
}

function getEnvValue(primaryName: string, fallbackName: string): string {
  const value = process.env[primaryName] ?? process.env[fallbackName] ?? '';
  return value.trim();
}

function normalizeTithiName(name: string): string {
  return name.trim().toLowerCase();
}

function getTithiOrdinal(name: string): number | null {
  const normalized = normalizeTithiName(name);
  const ordinals: Record<string, number> = {
    pratipada: 1,
    dwitiya: 2,
    tritiya: 3,
    chaturthi: 4,
    panchami: 5,
    shashthi: 6,
    saptami: 7,
    ashtami: 8,
    navami: 9,
    dashami: 10,
    ekadashi: 11,
    dwadashi: 12,
    trayodashi: 13,
    chaturdashi: 14,
    purnima: 15,
    amavasya: 15,
  };
  return ordinals[normalized] ?? null;
}

function isEkadashi(tithi: ProkeralaTithi): boolean {
  return normalizeTithiName(tithi.name ?? '') === 'ekadashi';
}

function estimateOffsetFromTithiName(name: string): number {
  const ordinal = getTithiOrdinal(name);
  if (!ordinal) return DEFAULT_SCAN_FALLBACK_DAYS;
  if (ordinal <= 11) return 11 - ordinal;
  return (15 - ordinal) + 11;
}

function getCandidateOffsets(baseOffset: number): number[] {
  const offsets = [
    Math.max(0, baseOffset - 1),
    Math.max(0, baseOffset),
    Math.max(0, baseOffset + 1),
    Math.max(0, baseOffset + 2),
  ];
  return [...new Set(offsets)].sort((a, b) => a - b);
}

function formatEventItem(ekadashi: ProkeralaTithi, fallbackDate: string, todayIndia: string): EkadashiItem {
  const ekadashiDate = ekadashi.start ? formatIndiaDate(new Date(ekadashi.start)) : fallbackDate;
  const eventDate = new Date(`${ekadashiDate}T00:00:00+05:30`);
  const todayDate = new Date(`${todayIndia}T00:00:00+05:30`);
  const daysUntil = Math.max(0, Math.round((eventDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000)));

  const displayDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(eventDate);

  return {
    dateIso: ekadashiDate,
    displayDate,
    tithiName: ekadashi.name ?? 'Ekadashi',
    paksha: ekadashi.paksha ?? '',
    daysUntil,
  };
}

function addDaysToIndiaDate(dateIso: string, days: number): string {
  const eventDate = new Date(`${dateIso}T00:00:00+05:30`);
  eventDate.setDate(eventDate.getDate() + days);
  return formatIndiaDate(eventDate);
}

function togglePaksha(paksha: string): string {
  const normalized = paksha.trim().toLowerCase();
  if (normalized === 'shukla') return 'Krishna';
  if (normalized === 'krishna') return 'Shukla';
  return paksha;
}

function buildApproximateFutureItem(previous: EkadashiItem, todayIndia: string): EkadashiItem {
  const nextDateIso = addDaysToIndiaDate(previous.dateIso, 15);
  const nextDate = new Date(`${nextDateIso}T00:00:00+05:30`);
  const todayDate = new Date(`${todayIndia}T00:00:00+05:30`);
  const daysUntil = Math.max(0, Math.round((nextDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000)));

  const displayDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(nextDate);

  return {
    dateIso: nextDateIso,
    displayDate,
    tithiName: previous.tithiName,
    paksha: togglePaksha(previous.paksha),
    daysUntil,
  };
}

function getProkeralaErrorDetail(payload: ProkeralaErrorResponse | null): string {
  const detail = payload?.errors?.[0]?.detail?.trim();
  return detail && detail.length > 0 ? detail : 'Unknown Prokerala API error';
}

async function getProkeralaAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAtMs - 10_000 > now) {
    return cachedToken.accessToken;
  }

  const clientId = getEnvValue('PROKERALA_CALENDAR_CLIENT_ID', 'PROKERALA_CALENDAR_CLINET_ID');
  const clientSecret = getEnvValue('PROKERALA_CALENDAR_CLIENT_SECRET', 'PROKERALA_CALENDAR_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Prokerala credentials are missing. Configure client ID and secret in environment variables.');
  }

  const tokenResponse = await fetch(PROKERALA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
    cache: 'no-store',
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to authenticate with Prokerala (HTTP ${tokenResponse.status}).`);
  }

  const tokenJson = (await tokenResponse.json()) as ProkeralaTokenResponse;
  const accessToken = tokenJson.access_token;
  const expiresInSeconds = Number(tokenJson.expires_in ?? 3600);

  if (!accessToken) {
    throw new Error('Prokerala authentication succeeded but access token was not returned.');
  }

  cachedToken = {
    accessToken,
    expiresAtMs: now + Math.max(60, expiresInSeconds - 30) * 1000,
  };

  return accessToken;
}

async function fetchPanchangForDate(dateString: string): Promise<ProkeralaPanchangResponse> {
  const accessToken = await getProkeralaAccessToken();
  const latitude = Number(process.env.PROKERALA_CALENDAR_LATITUDE ?? DEFAULT_LATITUDE);
  const longitude = Number(process.env.PROKERALA_CALENDAR_LONGITUDE ?? DEFAULT_LONGITUDE);

  const params = new URLSearchParams({
    datetime: `${dateString}T12:00:00+05:30`,
    coordinates: `${latitude},${longitude}`,
    ayanamsa: '1',
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${PROKERALA_PANCHANG_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return (await response.json()) as ProkeralaPanchangResponse;
    }

    const errorJson = (await response.json().catch(() => null)) as ProkeralaErrorResponse | null;
    const detail = getProkeralaErrorDetail(errorJson);

    if (detail.toLowerCase().includes('only jan 1 is allowed in test mode') || detail.toLowerCase().includes('sandbox mode')) {
      throw new Error('Prokerala test-mode credentials only allow Jan 1 dates. Please switch to Live app credentials to show upcoming Ekadashi.');
    }

    if (response.status === 429 && attempt < 1) {
      const retryAfterHeader = Number(response.headers.get('Retry-After') ?? '0');
      const backoffMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 12_000;
      await sleep(backoffMs);
      continue;
    }

    if (response.status === 429) {
      throw new Error('Prokerala rate limit reached (5 requests per minute). Please try again shortly.');
    }

    throw new Error(`Prokerala panchang request failed (HTTP ${response.status}): ${detail}`);
  }

  throw new Error('Prokerala panchang request failed after retries.');
}

type LocatedItem = {
  item: EkadashiItem;
  offset: number;
};

async function getEkadashiAtOffset(
  offset: number,
  todayIndia: string,
  searchCache: Map<number, ProkeralaPanchangResponse>
): Promise<LocatedItem | null> {
  if (offset < 0) return null;

  const date = formatIndiaDate(getDateAtOffset(offset));
  const panchang = searchCache.get(offset) ?? await fetchPanchangForDate(date);
  searchCache.set(offset, panchang);

  const ekadashi = (panchang.data?.tithi ?? []).find(isEkadashi);
  if (!ekadashi) return null;

  return {
    item: formatEventItem(ekadashi, date, todayIndia),
    offset,
  };
}

async function findFirstUpcoming(todayIndia: string, searchCache: Map<number, ProkeralaPanchangResponse>): Promise<LocatedItem> {
  const todayPanchang = searchCache.get(0) ?? await fetchPanchangForDate(todayIndia);
  searchCache.set(0, todayPanchang);

  const todayTithi = todayPanchang.data?.tithi ?? [];
  const todayEkadashi = todayTithi.find(isEkadashi);
  if (todayEkadashi) {
    return {
      item: formatEventItem(todayEkadashi, todayIndia, todayIndia),
      offset: 0,
    };
  }

  const referenceTithi = todayTithi[0]?.name ?? '';
  const estimatedOffset = estimateOffsetFromTithiName(referenceTithi);
  const candidateOffsets = getCandidateOffsets(estimatedOffset).filter((offset) => offset > 0);

  for (const offset of candidateOffsets) {
    const found = await getEkadashiAtOffset(offset, todayIndia, searchCache);
    if (found) return found;
  }

  for (let delta = 3; delta <= 8; delta += 1) {
    const found = await getEkadashiAtOffset(estimatedOffset + delta, todayIndia, searchCache);
    if (found) return found;
  }

  throw new Error('Unable to determine upcoming Ekadashi from Panchang response.');
}

async function findNextFromPrevious(
  previousOffset: number,
  todayIndia: string,
  searchCache: Map<number, ProkeralaPanchangResponse>
): Promise<LocatedItem | null> {
  const predicted = previousOffset + 15;
  const probeOffsets = [
    predicted - 1,
    predicted,
    predicted + 1,
    predicted - 2,
    predicted + 2,
  ].filter((offset) => offset > previousOffset);

  for (const offset of probeOffsets) {
    const found = await getEkadashiAtOffset(offset, todayIndia, searchCache);
    if (found) return found;
  }

  for (let delta = 3; delta <= 6; delta += 1) {
    const found = await getEkadashiAtOffset(predicted + delta, todayIndia, searchCache);
    if (found) return found;
  }

  return null;
}

export async function getUpcomingEkadashi(): Promise<UpcomingEkadashiResult> {
  const now = Date.now();
  if (cachedUpcoming && cachedUpcoming.expiresAtMs > now) {
    return cachedUpcoming.data;
  }

  const todayIndia = formatIndiaDate(new Date());
  const clientName = getEnvValue('PROKERALA_CALENDAR_CLIENT_NAME', 'PROKERALA_CALENDAR_CLINET_NAME') || DEFAULT_LOCATION;
  const location = process.env.PROKERALA_CALENDAR_LOCATION?.trim() || clientName;

  const staleResult: UpcomingEkadashiResult | null = cachedUpcoming?.data ?? null;
  const searchCache = new Map<number, ProkeralaPanchangResponse>();

  try {
    const first = await findFirstUpcoming(todayIndia, searchCache);
    const second = await findNextFromPrevious(first.offset, todayIndia, searchCache);
    const seedItems = second && second.item.dateIso !== first.item.dateIso
      ? [first.item, second.item]
      : [first.item];
    const items = [...seedItems];

    while (items.length < 10) {
      items.push(buildApproximateFutureItem(items[items.length - 1], todayIndia));
    }

    const result: UpcomingEkadashiResult = {
      ...first.item,
      location,
      timezone: INDIA_TIMEZONE,
      nextTen: items,
    };

    cachedUpcoming = { data: result, expiresAtMs: now + 12 * 60 * 60 * 1000 };
    return result;
  } catch (error) {
    if (staleResult) {
      return staleResult;
    }
    throw error;
  }
}
