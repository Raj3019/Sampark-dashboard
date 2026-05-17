'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { toast } from 'sonner';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unable to sign in. Please check your username and password.';
}

export default function LoginForm({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.username({
        username: username.trim(),
        password,
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setError(getErrorMessage(result.error));
        toast.error(getErrorMessage(result.error));
        return;
      }

      toast.success('Signed in successfully');
      router.replace(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="space-y-1.5">
        <label htmlFor="username" className="block text-[0.9rem] font-bold uppercase tracking-widest text-white">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s7-4 7-10V7l-7-3-7 3v5c0 6 7 10 7 10Z" />
            </svg>
          </span>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your username"
            className="login-auth-input w-full rounded-lg border border-slate-300 bg-white px-10 py-2.5 text-[0.95rem] text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-[#d77a07] focus:ring-2 focus:ring-[#d77a07]/20"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-[0.9rem] font-bold uppercase tracking-widest text-white">
          Password
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 1 1 8 0v3" />
            </svg>
          </span>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="login-auth-input w-full rounded-lg border border-slate-300 bg-white px-10 py-2.5 pr-10 text-[0.95rem] text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-[#d77a07] focus:ring-2 focus:ring-[#d77a07]/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-2 my-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3L21 21" />
                <path d="M10.58 10.58A2 2 0 0 0 12 16a2 2 0 0 0 1.42-.58" />
                <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7-1.04 2.35-2.88 4.29-5.19 5.47" />
                <path d="M6.71 6.72C4.68 7.85 3.06 9.68 2 12c1.73 3.89 6 7 10 7 1.52 0 2.99-.36 4.3-1" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/8 px-3 py-1.5 text-[0.72rem] text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e58200] px-4 py-2 text-[1.12rem] font-semibold text-white shadow-[0_10px_18px_rgba(229,130,0,0.22)] transition-colors hover:bg-[#d77a07] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
        {!isSubmitting && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
        )}
      </button>
    </form>
  );
}
