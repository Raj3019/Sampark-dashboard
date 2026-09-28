'use client';

import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth/client';

export type AuthSession = {
  session?: Record<string, unknown> | null;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } & Record<string, unknown>;
} | null;

export function useAuthSession() {
  const [data, setData] = useState<AuthSession>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setIsPending(true);
    setError(null);

    try {
      const result = await authClient.getSession();
      const session = (result.data ?? null) as AuthSession;
      setData(session);
      setError(result.error ?? null);
      return session;
    } catch (err) {
      setData(null);
      setError(err);
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setIsPending(true);
      setError(null);

      try {
        const result = await authClient.getSession();
        if (cancelled) return;
        setData((result.data ?? null) as AuthSession);
        setError(result.error ?? null);
      } catch (err) {
        if (cancelled) return;
        setData(null);
        setError(err);
      } finally {
        if (!cancelled) {
          setIsPending(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isPending, error, refresh };
}
