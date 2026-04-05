'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReminderItem, ReminderSummary } from '@/lib/types';

const POLL_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 120_000;

export function useReminders() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [summary, setSummary] = useState<ReminderSummary>({
    total: 0,
    moderate: 0,
    high: 0,
    pending: 0,
    acknowledged: 0,
    escalated: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch('/api/reminders', { signal: controller.signal });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const json = await res.json() as { reminders: ReminderItem[]; summary: ReminderSummary };
      setReminders(json.reminders);
      setSummary(json.summary);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Loading timed out while fetching reminders. Please retry in a few seconds.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load reminders');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  const updateReminder = useCallback(async (
    reminderId: string,
    action: 'acknowledge' | 'takeover' | 'resolve' | 'escalate',
    reminderKey?: string
  ) => {
    const res = await fetch(`/api/reminders/${reminderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, reminderKey }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<{ reminder: ReminderItem }>;
  }, []);

  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchReminders]);

  return {
    reminders,
    summary,
    loading,
    error,
    refresh: fetchReminders,
    updateReminder,
  };
}