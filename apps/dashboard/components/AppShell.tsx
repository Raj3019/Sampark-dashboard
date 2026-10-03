'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { ScopedSheetDataProvider } from '@/hooks/ScopedSheetDataProvider';
import { useAuthSession } from '@/hooks/useAuthSession';

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
          <div className="absolute inset-0 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
        <div>
          <p className="text-slate-100 font-semibold">Loading Sabha Analytics</p>
          <p className="mt-1 text-sm text-slate-500">Fetching the latest data...</p>
        </div>
      </div>
    </div>
  );
}

function AuthGateFallback({ showLoader }: { showLoader: boolean }) {
  if (showLoader) return <FullScreenLoader />;
  return <div className="min-h-screen bg-[#0f172a]" />;
}

function useDelayedValue(active: boolean, delayMs: number) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    if (!active) {
      const reset = window.setTimeout(() => setValue(false), 0);
      return () => window.clearTimeout(reset);
    }

    const timeout = window.setTimeout(() => setValue(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [active, delayMs]);

  return active && value;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const { data: session, isPending } = useAuthSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const showAuthLoader = useDelayedValue(isPending, 450);

  useEffect(() => {
    if (!isLoginPage && !isPending && !session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoginPage, isPending, pathname, router, session]);

  if (isLoginPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (isPending) {
    return <AuthGateFallback showLoader={showAuthLoader} />;
  }

  if (!session) {
    return <AuthGateFallback showLoader={showAuthLoader} />;
  }

  return (
    <ScopedSheetDataProvider>
      <Navbar sidebarCollapsed={sidebarCollapsed} onSidebarCollapsedChange={setSidebarCollapsed} />
      <main className={`min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(252,227,190,0.24),_transparent_28%),linear-gradient(180deg,_#fffdf9_0%,_#fff8ef_100%)] pt-[4.75rem] transition-[margin-left] duration-200 md:pt-[5.25rem] dark:bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.10),_transparent_24%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)] ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-[16.5rem]'}`}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Follow-up reminders (ReminderCenter) and the birthday aside moved off
              the shell: reminders are hidden, birthdays live on /birthdays. */}
          {children}
        </div>
      </main>
    </ScopedSheetDataProvider>
  );
}
