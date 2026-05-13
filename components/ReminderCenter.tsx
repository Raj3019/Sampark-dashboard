'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth/client';
import { useReminders } from '@/hooks/useReminders';
import ContactActions from '@/components/ContactActions';
import { SABHA_DISPLAY, SABHA_TYPES } from '@/lib/sabha';
import { ReminderItem, SabhaType } from '@/lib/types';

type ReminderCenterProps = {
  variant?: 'compact' | 'full';
};

const RISK_STYLES: Record<'moderate' | 'high', { card: string; badge: string; dot: string; label: string }> = {
  moderate: {
    card: 'border-amber-500/25 bg-amber-950/30',
    badge: 'border-amber-400/30 bg-amber-400/15 text-amber-200',
    dot: 'bg-amber-300',
    label: 'Moderate risk',
  },
  high: {
    card: 'border-red-500/25 bg-red-950/30',
    badge: 'border-red-400/30 bg-red-400/15 text-red-200',
    dot: 'bg-red-300',
    label: 'High risk',
  },
};

function formatDates(dates: string[]) {
  return dates.join(', ');
}

function hasUsablePhoneNumber(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().includes('nan') || trimmed.toLowerCase().includes('undefined')) return false;
  return /\d{7,}/.test(trimmed.replace(/[^\d]/g, ''));
}

function formatTimestamp(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatActorLine(label: string, name: string | null, timestamp: string | null) {
  if (!name) return null;
  const time = formatTimestamp(timestamp);
  return `${label} ${name}${time ? ` on ${time}` : ''}`;
}

function getSabhaLabel(sabhaType: SabhaType) {
  return SABHA_DISPLAY[sabhaType]?.navLabel ?? sabhaType;
}

function sortSabhaTypes(types: SabhaType[]) {
  const order = new Map(SABHA_TYPES.map((sabhaType, index) => [sabhaType, index]));
  return [...types].sort((left, right) => (order.get(left) ?? 99) - (order.get(right) ?? 99));
}

function groupRemindersBySabha(reminders: ReminderItem[]) {
  const sabhaTypes = sortSabhaTypes(Array.from(new Set(reminders.map((item) => item.sabhaType))));

  return sabhaTypes.map((sabhaType) => ({
    sabhaType,
    reminders: reminders.filter((item) => item.sabhaType === sabhaType),
  }));
}

export default function ReminderCenter({ variant = 'compact' }: ReminderCenterProps) {
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  const isLeader = role === 'leader' || role === 'admin';
  const { reminders, loading, error } = useReminders();
  const [selectedKk, setSelectedKk] = useState('all');
  const [openRisks, setOpenRisks] = useState<{ high: boolean; moderate: boolean }>({
    high: false,
    moderate: false,
  });

  const normalizedReminders = reminders
    .filter((item) => item.yuvakName.trim())
    .map((item) => ({
      ...item,
      phoneNumber: hasUsablePhoneNumber(item.phoneNumber) ? item.phoneNumber.trim() : '',
    }));

  const kkOptions = Array.from(new Set(normalizedReminders.map((item) => item.followUpKK))).sort((a, b) => a.localeCompare(b));
  const visibleReminders = isLeader && selectedKk !== 'all'
    ? normalizedReminders.filter((item) => item.followUpKK === selectedKk)
    : normalizedReminders;

  const visibleSummary = visibleReminders.reduce((acc, item) => {
    acc.total += 1;
    acc[item.riskLevel] += 1;
    acc[item.status] += 1;
    return acc;
  }, {
    total: 0,
    moderate: 0,
    high: 0,
    pending: 0,
    acknowledged: 0,
    escalated: 0,
    resolved: 0,
  });

  /*
  const handleAction = async (reminder: ReminderItem, action: 'acknowledge' | 'takeover' | 'resolve' | 'escalate') => {
    try {
      const result = await updateReminder(reminder.id, action, reminder.reminderKey);
      const reminderName = result.reminder?.yuvakName ?? reminder.yuvakName;
      const actionLabel = action === 'acknowledge'
        ? 'marked as seen'
        : action === 'takeover'
          ? 'taken over'
          : action === 'resolve'
            ? 'resolved'
            : 'escalated';

      toast.success(`${reminderName} reminder ${actionLabel}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update reminder');
    }
  };
  */

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#e7e0d6] bg-white/92 px-5 py-5 shadow-[0_20px_45px_rgba(31,41,55,0.08)] dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-[#ece4d7] dark:bg-slate-800" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="h-16 rounded-2xl bg-[#ece4d7] dark:bg-slate-800" />
            <div className="h-16 rounded-2xl bg-[#ece4d7] dark:bg-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-200">
        <p className="font-semibold">Reminder feed unavailable</p>
        <p className="mt-1 text-red-700/90 dark:text-red-100/80">{error}</p>
      </div>
    );
  }

  const reminderCountLabel = visibleSummary.total === 1 ? 'reminder' : 'reminders';
  const highRiskReminders = visibleReminders.filter((item) => item.riskLevel === 'high');
  const moderateRiskReminders = visibleReminders.filter((item) => item.riskLevel === 'moderate');
  const subtitle = isLeader
    ? 'Leaders see every moderate and high risk follow-up item.'
    : 'Your assigned follow-up reminders appear here first.';

  return (
    <section className={`rounded-3xl border border-[#e7e0d6] bg-white/92 shadow-[0_20px_45px_rgba(31,41,55,0.08)] dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none ${variant === 'full' ? 'p-5 sm:p-6' : 'max-h-[28rem] overflow-hidden p-5'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#1f2937] dark:text-slate-100">Follow-up reminders</h2>
            <span className="rounded-full border border-[#eadfce] bg-[#fff7ed] px-2.5 py-1 text-[11px] font-semibold text-[#a16207] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {visibleSummary.total} {reminderCountLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#64748b] dark:text-slate-400">{subtitle}</p>
          {isLeader && selectedKk !== 'all' && (
            <p className="mt-1 text-[11px] text-sky-600 dark:text-sky-300">Filtered by KK: {selectedKk}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLeader && (
            <select
              value={selectedKk}
              onChange={(event) => setSelectedKk(event.target.value)}
              className="rounded-xl border border-[#e7e0d6] bg-[#fffdfa] px-3 py-2 text-xs font-semibold text-[#334155] outline-none ring-0 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">All KKs ({kkOptions.length})</option>
              {kkOptions.map((kkName) => (
                <option key={kkName} value={kkName}>{kkName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          {
            key: 'high' as const,
            label: 'High risk',
            value: visibleSummary.high,
            tone: 'text-red-300',
            reminders: highRiskReminders,
          },
          {
            key: 'moderate' as const,
            label: 'Moderate risk',
            value: visibleSummary.moderate,
            tone: 'text-amber-300',
            reminders: moderateRiskReminders,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#ece4d7] bg-[#fffdfa] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-slate-800 dark:bg-slate-950/50 dark:shadow-none">
            <button
              type="button"
              aria-expanded={openRisks[item.key]}
              aria-controls={`risk-panel-${item.key}`}
              onClick={() => {
                setOpenRisks((current) => ({ ...current, [item.key]: !current[item.key] }));
              }}
              className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-left outline-none transition hover:bg-[#f8f3eb] focus-visible:ring-2 focus-visible:ring-sky-500/60 dark:hover:bg-slate-900/70"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8b6f47] dark:text-slate-500">{item.label}</p>
                <p className={`mt-1 text-lg font-semibold ${item.tone}`}>{item.value}</p>
              </div>
              <div className="flex items-center">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#eadfce] bg-white text-[#64748b] shadow-sm transition-all dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 ${openRisks[item.key] ? 'rotate-180 border-sky-500/50 text-sky-600 dark:text-sky-200' : 'hover:border-[#d4c4ae] hover:text-[#334155] dark:hover:border-slate-600 dark:hover:text-slate-100'}`}
                >
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
              </div>
            </button>

            {openRisks[item.key] && (
              <div id={`risk-panel-${item.key}`} className="mt-2 max-h-56 space-y-2 overflow-y-auto border-t border-[#f0e8dc] pt-2 dark:border-slate-800/90">
                {item.reminders.length === 0 ? (
                  <p className="rounded-xl border border-[#ece4d7] bg-[#fff9f1] px-2.5 py-2 text-xs text-[#64748b] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    No {item.label.toLowerCase()} reminders.
                  </p>
                ) : (
                  groupRemindersBySabha(item.reminders).map((group) => (
                    <div key={`${item.label}-${group.sabhaType}`} className="space-y-2">
                      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-[#ece4d7] bg-[#fff7ed] px-2.5 py-1.5 text-[11px] font-semibold text-[#8b5e13] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        <span>{getSabhaLabel(group.sabhaType)}</span>
                        <span>{group.reminders.length}</span>
                      </div>
                      {group.reminders.map((reminder) => (
                        <div key={`${item.label}-${reminder.id}`} className="rounded-xl border border-[#ece4d7] bg-[#fffdfa] px-3 py-3 transition-colors hover:bg-[#f8f3eb] dark:border-slate-800/90 dark:bg-slate-900/70 dark:hover:bg-slate-900">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[#1f2937] dark:text-slate-100">{reminder.yuvakName}</p>
                            <span className="shrink-0 rounded-full border border-[#eadfce] bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#8b5e13] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                              {SABHA_DISPLAY[reminder.sabhaType]?.shortLabel ?? getSabhaLabel(reminder.sabhaType)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#64748b] dark:text-slate-400">
                            KK: <span className="text-[#334155] dark:text-slate-300">{reminder.followUpKK}</span> - Missed {reminder.missedSabhaCount} sabhas
                          </p>
                          {reminder.phoneNumber ? (
                            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                              <span className="text-[#64748b] dark:text-slate-400">
                                Phone: <span className="text-[#334155] dark:text-slate-200">{reminder.phoneNumber}</span>
                              </span>
                              <ContactActions name={reminder.yuvakName} phoneNumber={reminder.phoneNumber} size="xs" />
                            </div>
                          ) : (
                            <p className="mt-1.5 text-[11px] text-[#94a3b8] dark:text-slate-500">
                              Phone number not available
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {variant === 'full' && (
        <div className="mt-4 space-y-3">
          {visibleReminders.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-5 text-sm text-slate-400">
              {isLeader && selectedKk !== 'all'
                ? 'No reminders for this KK right now.'
                : 'No moderate or high risk reminders right now.'}
            </div>
          ) : (
            visibleReminders.map((reminder) => {
              const styles = RISK_STYLES[reminder.riskLevel];
              return (
                <article key={reminder.id} className={`rounded-2xl border px-4 py-4 ${styles.card}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-50">{reminder.yuvakName}</h3>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                          {styles.label}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                          {reminder.sabhaType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">
                        Follow-up KK: <span className="font-semibold text-slate-100">{reminder.followUpKK}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-300">
                        Missed last {reminder.missedSabhaCount} sabhas: <span className="text-slate-100">{formatDates(reminder.missedSabhaDates)}</span>
                      </p>
                      {reminder.status === 'escalated' && (
                        <p className="mt-1 text-xs text-rose-200">
                          {formatActorLine('Escalated by', reminder.escalatedByName, reminder.escalatedAt) && (
                            <>{formatActorLine('Escalated by', reminder.escalatedByName, reminder.escalatedAt)}</>
                          )}
                        </p>
                      )}
                      {reminder.takenOverByName && (
                        <p className="mt-1 text-xs text-violet-200">
                          {formatActorLine('Taken over by', reminder.takenOverByName, reminder.takenOverAt) && (
                            <>{formatActorLine('Taken over by', reminder.takenOverByName, reminder.takenOverAt)}</>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Reminder actions are temporarily disabled in the UI.
                        Keep this block commented so the feature can be restored later. */}
                    {/* <div className="flex flex-wrap gap-2">
                      {!isLeader && reminder.status === 'pending' && (
                        <ActionButton
                          label="Acknowledge"
                          onClick={() => handleAction(reminder, 'acknowledge')}
                        />
                      )}
                      {!isLeader && reminder.status !== 'escalated' && reminder.status !== 'resolved' && (
                        <ActionButton
                          label="Escalate"
                          tone="warning"
                          onClick={() => handleAction(reminder, 'escalate')}
                        />
                      )}
                      {isLeader && reminder.status !== 'resolved' && (
                        <ActionButton
                          label="Take over"
                          tone="warning"
                          onClick={() => handleAction(reminder, 'takeover')}
                        />
                      )}
                      {isLeader && reminder.status !== 'resolved' && (
                        <ActionButton
                          label="Mark resolved"
                          tone="neutral"
                          onClick={() => handleAction(reminder, 'resolve')}
                        />
                      )}
                    </div> */}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 uppercase tracking-[0.16em] text-slate-300">
                      {reminder.status}
                    </span>
                    {reminder.requiresLeaderReview && (
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 uppercase tracking-[0.16em] text-violet-200">
                        Leader review
                      </span>
                    )}
                    <ContactActions name={reminder.yuvakName} phoneNumber={reminder.phoneNumber} size="xs" />
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
