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
    <>
      <Navbar />
      <main className="md:ml-60 pt-14 md:pt-0 min-h-screen">
        <ScopedSheetDataProvider>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
              <ReminderCenter variant="compact" />
              <UpcomingBirthdays />
            </div>
            {children}
          </div>
        </ScopedSheetDataProvider>
      </main>
    </>
  );
}
