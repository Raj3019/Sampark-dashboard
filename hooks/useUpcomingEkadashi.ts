'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UpcomingEkadashi } from '@/lib/types';

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function useUpcomingEkadashi() {
  const [data, setData] = useState<UpcomingEkadashi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEkadashi = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch('/api/calendar/ekadashi', { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as UpcomingEkadashi;
      setData(json);
      setError(null);
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Timed out while fetching upcoming Ekadashi'
        : err instanceof Error
          ? err.message
          : 'Failed to fetch upcoming Ekadashi';
      setError(message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEkadashi();
    const interval = setInterval(fetchEkadashi, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchEkadashi]);

  return { data, loading, error, refresh: fetchEkadashi };
}
