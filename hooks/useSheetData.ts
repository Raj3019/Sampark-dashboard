'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ParsedSheetData } from '@/lib/types';

const POLL_INTERVAL_MS = 60_000; // 1 minute

type SheetDataScope = 'scoped' | 'full';
type SheetDataState = {
  data: ParsedSheetData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const ScopedSheetDataContext = createContext<SheetDataState | null>(null);

function useSheetDataState(scope: SheetDataScope, enabled = true): SheetDataState {
  const [data, setData] = useState<ParsedSheetData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000); // allow Drive retries to complete

    try {
      const url = scope === 'full' ? '/api/sabha-data?scope=full' : '/api/sabha-data';
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json: ParsedSheetData = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Loading timed out while fetching Sabha data. Please verify the Google Sheet file and tab names.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [enabled, scope]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, fetchData]);

  useEffect(() => {
    setLoading(enabled);
  }, [enabled]);

  return { data, loading, error, refresh: fetchData };
}

export function useScopedSheetDataState() {
  return useSheetDataState('scoped');
}

export function useSheetData(options?: { scope?: SheetDataScope }) {
  const scope = options?.scope ?? 'scoped';
  const scopedState = useContext(ScopedSheetDataContext);
  const shouldUseScopedState = scope === 'scoped' && scopedState !== null;
  const localState = useSheetDataState(scope, !shouldUseScopedState);

  if (shouldUseScopedState && scopedState) {
    return scopedState;
  }

  return localState;
}
