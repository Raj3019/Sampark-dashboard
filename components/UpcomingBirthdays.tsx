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

function normalizeWhatsappHref(value: string | null | undefined, name: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;

  const phoneNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
  const message = encodeURIComponent(
    `Jay Swaminarayan ${name}! Wishing you a very happy birthday. May Maharaj and Swami bless you with joy, good health, and a wonderful year ahead.`
  );

  return `https://wa.me/${phoneNumber}?text=${message}`;
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

  const birthdays = getUpcomingBirthdays(data.yuvaks);
  if (birthdays.length === 0) return null;

  const visibleBirthdays = expanded ? birthdays : birthdays.slice(0, 2);
  const hiddenCount = Math.max(0, birthdays.length - 2);

  return (
    <aside className="w-full rounded-3xl border border-[#e7e0d6] bg-white/92 px-5 py-5 shadow-[0_20px_45px_rgba(31,41,55,0.08)] dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none xl:max-h-[28rem] xl:overflow-hidden">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/40 bg-amber-50 text-amber-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
          <p className="text-lg font-semibold text-[#1f2937] dark:text-slate-100">Upcoming birthdays</p>
          <p className="text-sm text-[#64748b] dark:text-slate-400">Next 30 days</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 xl:max-h-[22rem] xl:overflow-y-auto xl:pr-1">
        {visibleBirthdays.map((birthday) => {
          const phoneHref = normalizePhoneHref(birthday.phoneNumber);
          const whatsappHref = normalizeWhatsappHref(birthday.phoneNumber, birthday.name);
          return (
          <div key={`${birthday.name}-${birthday.displayDate}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[#ece4d7] bg-[#fffdfa] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-[#1f2937] dark:text-slate-100">{birthday.name}</p>
                {phoneHref && (
                  <a
                    href={phoneHref}
                    aria-label={`Call ${birthday.name}`}
                    title={`Call ${birthday.name}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200"
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
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Send WhatsApp birthday wish to ${birthday.name}`}
                    title={`Send WhatsApp birthday wish to ${birthday.name}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="currentColor"
                    >
                      <path d="M19.05 4.94A9.94 9.94 0 0 0 12.03 2C6.55 2 2.08 6.46 2.08 11.95c0 1.76.46 3.47 1.33 4.98L2 22l5.23-1.37a9.9 9.9 0 0 0 4.79 1.22h.01c5.48 0 9.95-4.46 9.95-9.95a9.9 9.9 0 0 0-2.93-6.96ZM12.03 20.17h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.22 8.22 0 0 1-1.27-4.38c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.28.85 5.83 2.41a8.18 8.18 0 0 1 2.39 5.82c0 4.54-3.69 8.23-8.22 8.23Zm4.51-6.16c-.25-.13-1.47-.73-1.7-.81-.23-.09-.39-.13-.56.12-.17.26-.64.81-.79.98-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.25.25-.42.09-.17.05-.31-.02-.43-.07-.13-.56-1.35-.77-1.84-.2-.48-.4-.41-.56-.42h-.48c-.17 0-.43.06-.65.31-.22.26-.85.83-.85 2.02 0 1.19.87 2.35.99 2.51.12.17 1.7 2.59 4.12 3.63.57.25 1.02.4 1.37.52.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.68-1.17.21-.57.21-1.06.15-1.17-.06-.11-.22-.17-.47-.29Z" />
                    </svg>
                  </a>
                )}
              </div>
              <p className="truncate text-xs text-[#64748b] dark:text-slate-400">
                {birthday.displayDate}
                {birthday.followUpKK ? ` | ${birthday.followUpKK}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-amber-300/50 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {getBadgeLabel(birthday.daysUntil)}
            </span>
          </div>
          );
        })}

        {birthdays.length > 2 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#e7dccb] bg-[#f7efe3] px-3 py-2.5 text-xs font-semibold text-[#8b5e13] transition-colors hover:bg-[#efe2ce] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
