'use client';

import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth/client';
import { isSessionWithinMaxAge } from '@/lib/auth/session-policy';

export type AuthSession = {
  session?: {
    createdAt?: Date | string | number | null;
  } | null;
  user?: {
    name?: string | null;
    role?: string;
    assignedKK?: string;
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
      if (session && !isSessionWithinMaxAge(session)) {
        await authClient.signOut();
        setData(null);
        return null;
      }

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
        const session = (result.data ?? null) as AuthSession;
        if (session && !isSessionWithinMaxAge(session)) {
          await authClient.signOut();
          if (cancelled) return;
          setData(null);
          return;
        }

        setData(session);
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
