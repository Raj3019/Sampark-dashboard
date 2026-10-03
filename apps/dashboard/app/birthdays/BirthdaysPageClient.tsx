'use client';

import { useSheetData } from '@/hooks/useSheetData';
import { getUpcomingBirthdays, type BirthdayEntry } from '@/components/UpcomingBirthdays';

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
  const phoneNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
  const message = encodeURIComponent(
    `Jay Swaminarayan ${name}! Wishing you a very happy birthday. May Maharaj and Swami bless you with joy, good health, and a wonderful year ahead.`
  );
  return `https://wa.me/${phoneNumber}?text=${message}`;
}

function badgeLabel(daysUntil: number) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `${daysUntil}D`;
}

function groupLabel(daysUntil: number) {
  if (daysUntil <= 7) return 'Next 7 days';
  if (daysUntil <= 15) return 'Next 15 days';
  return 'Next 30 days';
}

export default function BirthdaysPageClient() {
  const { data, loading, error } = useSheetData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#d9cdbb] bg-[#f1eadf] dark:border-slate-800 dark:bg-slate-900/80 px-5 py-10 text-center">
        <p className="text-sm text-[#64748b] dark:text-slate-400">Could not load member data.</p>
      </div>
    );
  }

  const birthdays = data ? getUpcomingBirthdays(data.yuvaks.map((y) => ({
    name: y.name,
    dob: y.dob,
    followUpKK: y.followUpKK,
    phoneNumber: y.phoneNumber,
  }))) : [];

  let lastGroup = '';
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1f2937] dark:text-slate-100">Upcoming Birthdays</h1>
        <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">
          Members celebrating in the next 30 days ({birthdays.length})
        </p>
      </div>

      {birthdays.length === 0 && (
        <div className="rounded-3xl border border-[#d9cdbb] bg-[#f1eadf] dark:border-slate-800 dark:bg-slate-900/80 px-5 py-12 text-center">
          <p className="text-sm text-[#64748b] dark:text-slate-400">
            No birthdays in the next 30 days.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {birthdays.map((birthday: BirthdayEntry) => {
          const group = groupLabel(birthday.daysUntil);
          const showGroup = group !== lastGroup;
          lastGroup = group;
          const phoneHref = normalizePhoneHref(birthday.phoneNumber);
          const whatsappHref = normalizeWhatsappHref(birthday.phoneNumber, birthday.name);
          return (
            <div key={`${birthday.name}-${birthday.displayDate}`}>
              {showGroup && (
                <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b5e13] dark:text-slate-400">
                  {group}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ece4d7] bg-[#fffdfa] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
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
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
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
                  {badgeLabel(birthday.daysUntil)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
