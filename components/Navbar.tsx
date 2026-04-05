'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';
import { authClient } from '@/lib/auth/client';
import { toast } from 'sonner';

const navItems = [
  // { href: '/', label: 'Dashboard', icon: 'DB' },
  // { href: '/sabha/chirag-nagar', label: 'Yuva Sabha', icon: 'CN' },
  { href: '/sabha/kishor', label: 'AYC Sabha', icon: 'KS' },
  // { href: '/sabha/bal', label: 'Bal Sabha', icon: 'BS' },
  { href: '/kk-analysis', label: 'KK Analysis', icon: 'KK' },
  { href: '/yuvaks', label: 'Yuvak Directory', icon: 'YD' },
  // { href: '/ai', label: 'Ask Akshar', icon: 'AI' },
];

const kkNavItems = [
  { href: '/kk-home', label: 'My Dashboard', icon: 'MD' },
  { href: '/yuvaks', label: 'My Yuvaks', icon: 'MY' },
];

const adminNavItems = [
  { href: '/admin/users', label: 'User Management', icon: 'UM' },
  { href: '/admin/logs', label: 'Login Activity', icon: 'LA' },
  { href: '/admin/sheet-changes', label: 'Sheet History', icon: 'SH' },
];

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', leader: 'Leader', kk: 'KK' };
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-300 border border-red-500/20',
  leader: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
  kk: 'bg-green-500/15 text-green-300 border border-green-500/20',
};

function ThemeToggleIcon({ theme }: { theme: 'dark' | 'light' }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" /><path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

function NavLink({ href, label, icon, active, onClick }: { href: string; label: string; icon: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
      }`}
    >
      <span className="text-xs w-5 text-center font-semibold">{icon}</span>
      {label}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { theme, toggle } = useTheme();

  const { data: session } = authClient.useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? '';
  const isAdmin = userRole === 'admin';
  const isKK = userRole === 'kk';

  useEffect(() => {
    if (isKK && pathname === '/sabha/kishor') {
      router.replace('/kk-home');
    }
  }, [isKK, pathname, router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      toast.success('Signed out successfully');
      setMobileOpen(false);
      router.replace('/login');
      router.refresh();
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setIsSigningOut(false);
    }
  };

  const sidebarContent = (onLinkClick?: () => void) => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {(isKK ? kkNavItems : navItems).map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} onClick={onLinkClick} />
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest">Admin</p>
            </div>
            {adminNavItems.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} onClick={onLinkClick} />
            ))}
          </>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800 space-y-3 shrink-0">
        {session?.user && (
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
              <span className="text-orange-400 text-xs font-bold">
                {session.user.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 text-xs font-medium truncate">{session.user.name}</p>
              <span className={`inline-block mt-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold ${ROLE_COLORS[userRole] ?? 'text-slate-400'}`}>
                {ROLE_LABELS[userRole] ?? userRole}
              </span>
            </div>
          </div>
        )}
        <p className="text-slate-600 text-xs">Auto-refreshes every 60s</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200 disabled:opacity-60"
          >
            {isSigningOut ? 'Signing out...' : 'Logout'}
          </button>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 border border-slate-700"
          >
            <ThemeToggleIcon theme={theme} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-slate-900 border-r border-slate-800 fixed top-0 left-0 z-30">
        <div className="px-6 py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
              <Image src="/sampark_logo.jpeg" alt="Sampark Logo" width={36} height={36} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-orange-400 font-bold text-sm leading-tight">Sabha Analytics</p>
              <p className="text-slate-500 text-xs">Sampark Management</p>
              <span className="mt-1 inline-flex rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                V1
              </span>
            </div>
          </div>
        </div>
        {sidebarContent()}
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700"
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          <div className="w-7 h-7 rounded-md bg-white overflow-hidden shrink-0 flex items-center justify-center">
            <Image src="/sampark_logo.jpeg" alt="Sampark Logo" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="block text-orange-400 font-bold text-sm leading-tight">Sabha Analytics</span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-sky-300">Website V1</span>
          </div>
        </div>
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-slate-300 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700"
        >
          <ThemeToggleIcon theme={theme} />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/60" onClick={() => setMobileOpen(false)}>
          <aside
            className="absolute top-0 left-0 w-64 h-full bg-slate-900 border-r border-slate-800 pt-16 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent(() => setMobileOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
