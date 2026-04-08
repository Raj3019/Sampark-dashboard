'use client';

import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import Navbar from '@/components/Navbar';
import ReminderCenter from '@/components/ReminderCenter';
import UpcomingBirthdays from '@/components/UpcomingBirthdays';
import { ScopedSheetDataProvider } from '@/hooks/ScopedSheetDataProvider';

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const { isPending } = authClient.useSession();

  if (isLoginPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (isPending) {
    return <FullScreenLoader />;
  }

  return (
    <ScopedSheetDataProvider>
      <Navbar />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(252,227,190,0.24),_transparent_28%),linear-gradient(180deg,_#fffdf9_0%,_#fff8ef_100%)] md:ml-[16.5rem] md:pt-[5.25rem] pt-[4.75rem] dark:bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.10),_transparent_24%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(19rem,0.9fr)] xl:items-start">
            <div id="shell-reminders">
              <ReminderCenter variant="compact" />
            </div>
            <UpcomingBirthdays />
          </div>
          {children}
        </div>
      </main>
    </ScopedSheetDataProvider>
  );
}
