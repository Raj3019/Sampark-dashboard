'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';

type BirthdayEntry = {
  name: string;
  followUpKK: string;
  phoneNumber: string;
  displayDate: string;
  daysUntil: number;
};

function normalizePhoneHref(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[^\d+]/g, '');
  if (!normalized) return null;

  return `tel:${normalized}`;
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getUpcomingBirthdays(values: Array<{ name: string; dob: string; followUpKK: string; phoneNumber: string }>) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return values
    .flatMap((item) => {
      const parsedDob = parseIsoDate(item.dob);
      if (!parsedDob) return [];

      const month = parsedDob.getUTCMonth();
      const day = parsedDob.getUTCDate();

      let nextBirthday = new Date(Date.UTC(todayUtc.getUTCFullYear(), month, day));
      if (nextBirthday < todayUtc) {
        nextBirthday = new Date(Date.UTC(todayUtc.getUTCFullYear() + 1, month, day));
      }

      const diffMs = nextBirthday.getTime() - todayUtc.getTime();
      const daysUntil = Math.round(diffMs / 86_400_000);
      if (daysUntil > 30) return [];

      return [{
        name: item.name,
        followUpKK: item.followUpKK,
        phoneNumber: item.phoneNumber,
        displayDate: nextBirthday.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
        daysUntil,
      } satisfies BirthdayEntry];
    })
    .sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return a.name.localeCompare(b.name);
    });
}

function getBadgeLabel(daysUntil: number) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `${daysUntil}d`;
}

export default function UpcomingBirthdays() {
  const { data, loading, error } = useSheetData();
  const [expanded, setExpanded] = useState(false);

  if (loading || error || !data) return null;

  const kishorYuvaks = data.yuvaks.filter((yuvak) => yuvak.sabhaType.toLowerCase().includes('kishor'));

  // Temporarily limiting birthdays to Kishor only.
  // Restore `data.yuvaks` here when we want birthdays from every sabha again.
  // const birthdays = getUpcomingBirthdays(data.yuvaks);
  const birthdays = getUpcomingBirthdays(kishorYuvaks);
  if (birthdays.length === 0) return null;

  const visibleBirthdays = expanded ? birthdays : birthdays.slice(0, 2);
  const hiddenCount = Math.max(0, birthdays.length - 2);

  return (
    <aside className="w-full rounded-2xl border border-amber-400/20 bg-linear-to-br from-amber-500/10 via-slate-900/95 to-slate-950 px-4 py-4 shadow-[0_16px_45px_rgba(2,6,23,0.28)] lg:max-w-sm">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/12 text-amber-200">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v18" />
            <path d="M8 7h8" />
            <path d="M5 21h14" />
            <path d="M7 10a5 5 0 0 1 10 0c0 2.5-1.25 3.75-2.5 5S12 18 12 18s-1.25-1.75-2.5-3S7 12.5 7 10Z" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Upcoming birthdays</p>
          <p className="text-xs text-slate-400">Next 30 days</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {visibleBirthdays.map((birthday) => {
          const phoneHref = normalizePhoneHref(birthday.phoneNumber);
          return (
          <div key={`${birthday.name}-${birthday.displayDate}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-slate-100">{birthday.name}</p>
                {phoneHref && (
                  <a
                    href={phoneHref}
                    aria-label={`Call ${birthday.name}`}
                    title={`Call ${birthday.name}`}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-200 transition-colors hover:bg-emerald-500/20"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.64 2.62a2 2 0 0 1-.45 2.11L8.03 9.72a16 16 0 0 0 6.25 6.25l1.27-1.27a2 2 0 0 1 2.11-.45c.84.31 1.72.52 2.62.64A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </a>
                )}
              </div>
              <p className="truncate text-xs text-slate-400">
                {birthday.displayDate}
                {birthday.followUpKK ? ` | ${birthday.followUpKK}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
              {getBadgeLabel(birthday.daysUntil)}
            </span>
          </div>
          );
        })}

        {birthdays.length > 2 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/8 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-300/14"
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Show less' : `Show ${hiddenCount} more`}</span>
            <span className={`inline-flex transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 7.5L10 12.5L15 7.5" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
