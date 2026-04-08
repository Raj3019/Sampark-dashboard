'use client';

import Link from 'next/link';
import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChartColumn,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner';
import { useUpcomingEkadashi } from '@/hooks/useUpcomingEkadashi';
import { useSheetData } from '@/hooks/useSheetData';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const leaderNavItems: NavItem[] = [
  { href: '/sabha/kishor', label: 'AYC Sabha', icon: BookOpen },
  { href: '/kk-analysis', label: 'KK Analysis', icon: ChartColumn },
  { href: '/yuvaks', label: 'Yuvak Directory', icon: Users },
];

const adminPrimaryNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sabha/kishor', label: 'AYC Sabha', icon: BookOpen },
  { href: '/sabha/chirag-nagar', label: 'Yuva Sabha', icon: BookOpen },
  { href: '/sabha/bal', label: 'Bal Sabha', icon: BookOpen },
  { href: '/kk-analysis', label: 'KK Analysis', icon: ChartColumn },
  { href: '/yuvaks', label: 'Yuvak Directory', icon: Users },
];

const kkNavItems: NavItem[] = [
  { href: '/kk-home', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/yuvaks', label: 'My Yuvaks', icon: Users },
];

const adminSecondaryNavItems: NavItem[] = [
  { href: '/admin/users', label: 'User Management', icon: ShieldCheck },
  { href: '/admin/logs', label: 'Login Activity', icon: CalendarDays },
  { href: '/admin/sheet-changes', label: 'Sheet History', icon: Sparkles },
];

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', leader: 'Leader', kk: 'KK' };

function ThemeToggleIcon({ theme }: { theme: 'dark' | 'light' }) {
  return theme === 'dark'
    ? <Sparkles className="h-5 w-5" />
    : <Moon className="h-5 w-5" />;
}

function getRelativeUpdateLabel(value: string | null | undefined, now: number) {
  if (!value) return 'Not synced yet';

  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return 'Not synced yet';

  const diffMinutes = Math.max(0, Math.round((now - parsed) / 60_000));
  if (diffMinutes <= 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} mins ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function getInitials(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return '?';

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: NavItem & { active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition-all ${
        active
          ? 'bg-[#f5eadc] text-[#d97706] shadow-[inset_0_0_0_1px_rgba(217,119,6,0.06)] dark:bg-amber-500/12 dark:text-amber-300 dark:shadow-[inset_0_0_0_1px_rgba(245,158,11,0.16)]'
          : 'text-[#42526e] hover:bg-[#f8f2ea] hover:text-[#24364f] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
      }`}
    >
      <span className={`absolute inset-y-2.5 left-1 w-1 rounded-full transition-opacity ${active ? 'bg-[#d97706] opacity-100 dark:bg-amber-300' : 'opacity-0 group-hover:opacity-40 bg-[#d5b38b] dark:bg-slate-500'}`} />
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[#d97706] dark:text-amber-300' : 'text-[#5d6f8b] dark:text-slate-400'}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarSection({
  title,
  items,
  pathname,
  onLinkClick,
}: {
  title?: string;
  items: NavItem[];
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      {title ? <p className="px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7f91af] dark:text-slate-500">{title}</p> : null}
      {items.map((item) => (
        <NavLink key={item.href} {...item} active={pathname === item.href} onClick={onLinkClick} />
      ))}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [relativeNow, setRelativeNow] = useState(() => Date.now());
  const { theme, toggle } = useTheme();
  const { data: session } = authClient.useSession();
  const { data: sheetData } = useSheetData();
  const { data: ekadashi, loading: ekadashiLoading, error: ekadashiError } = useUpcomingEkadashi();

  const userRole = (session?.user as { role?: string } | undefined)?.role ?? '';
  const isAdmin = userRole === 'admin';
  const isKK = userRole === 'kk';
  const navItems = isKK ? kkNavItems : isAdmin ? adminPrimaryNavItems : leaderNavItems;
  const secondaryNavItems = isAdmin ? adminSecondaryNavItems : [];

  useEffect(() => {
    if (isKK && pathname === '/sabha/kishor') {
      router.replace('/kk-home');
    }
  }, [isKK, pathname, router]);

  useEffect(() => {
    const interval = window.setInterval(() => setRelativeNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const updateLabel = useMemo(() => getRelativeUpdateLabel(sheetData?.lastUpdated, relativeNow), [relativeNow, sheetData?.lastUpdated]);
  const ekadashiLabel = ekadashiLoading
    ? 'Loading Ekadashi...'
    : ekadashi
      ? `Next Ekadashi: ${ekadashi.displayDate}`
      : ekadashiError?.toLowerCase().includes('rate limit')
        ? 'Ekadashi temporarily unavailable'
        : 'Upcoming Ekadashi unavailable';

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

  const handleReminderShortcut = () => {
    document.getElementById('shell-reminders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sidebarContent = (onLinkClick?: () => void) => (
    <>
      <div className="flex shrink-0 items-center gap-3 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dd7d04] text-xl font-extrabold text-white shadow-[0_12px_24px_rgba(221,125,4,0.2)] dark:bg-amber-500 dark:text-slate-950 dark:shadow-[0_12px_24px_rgba(245,158,11,0.22)]">
          S
        </div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-[#1e3554] dark:text-slate-50">Sabha Analytics</p>
          <p className="mt-0.5 truncate text-[13px] text-[#6a7a96] dark:text-slate-400">Sampark Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <SidebarSection items={navItems} pathname={pathname} onLinkClick={onLinkClick} />
        {secondaryNavItems.length > 0 ? (
          <SidebarSection title="Admin" items={secondaryNavItems} pathname={pathname} onLinkClick={onLinkClick} />
        ) : null}
      </nav>

      <div className="shrink-0 border-t border-[#eadfce] px-4 py-4 dark:border-slate-800">
        {session?.user ? (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fde8bf] text-base font-bold text-[#d97706] dark:bg-amber-500/15 dark:text-amber-300">
              {getInitials(session.user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#1f3552] dark:text-slate-100">{session.user.name}</p>
              <p className="truncate text-[13px] text-[#72829d] dark:text-slate-400">{(ROLE_LABELS[userRole] ?? userRole) || 'Member'}</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#eadfce] bg-[#fffdfa] text-[#42526e] transition hover:border-[#d8c7b0] hover:bg-[#f7efe4] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <ThemeToggleIcon theme={theme} />
          </button>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#eadfce] bg-[#f5efe6] px-4 py-2.5 text-[15px] font-semibold text-[#3c4f6d] transition hover:border-[#ddc9ae] hover:bg-[#eee4d6] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            <span>{isSigningOut ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[16.5rem] flex-col border-r border-[#eadfce] bg-[#fffcf7] md:flex dark:border-slate-800 dark:bg-[#111827]">
        {sidebarContent()}
      </aside>

      <div className="fixed left-[16.5rem] right-0 top-0 z-30 hidden border-b border-[#eadfce] bg-[#fffcf7]/92 backdrop-blur md:block dark:border-slate-800 dark:bg-[#0f172acc]">
        <div className="flex h-[5.25rem] items-center gap-4 px-6">
          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[#e6d8c5] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(148,116,75,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
            <Search className="mr-3 h-4 w-4 text-[#7a8aa5] dark:text-slate-500" />
            <input
              type="text"
              aria-label="Search"
              placeholder="Search yuvaks, KKs, or areas..."
              className="w-full border-0 bg-transparent text-[15px] text-[#1f3552] placeholder:text-[#97a4bb] focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#f2d7a5] bg-[#fff3dc] px-3.5 py-2.5 text-[14px] font-semibold text-[#e18b00] shadow-[0_12px_28px_rgba(225,139,0,0.08)] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-none">
              <CalendarDays className="h-4 w-4" />
              <span>{ekadashiLabel}</span>
            </div>

            <button
              onClick={handleReminderShortcut}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e6d8c5] bg-white text-[#52647f] shadow-[0_8px_24px_rgba(148,116,75,0.07)] transition hover:bg-[#faf5ee] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-800"
              aria-label="Open reminders"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#ef4444]" />
            </button>

            <div className="h-8 w-px bg-[#e7ddce] dark:bg-slate-800" />

            <div className="min-w-[7.5rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa7bb] dark:text-slate-500">Last updated</p>
              <p className="mt-1 text-[13px] font-bold text-[#223754] dark:text-slate-100">{updateLabel}</p>
            </div>

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dd7d04] text-white shadow-[0_16px_30px_rgba(221,125,4,0.24)] transition hover:bg-[#cb7103]"
              aria-label="Search action"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <header className="fixed left-0 right-0 top-0 z-40 border-b border-[#eadfce] bg-[#fffcf7]/95 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-[#0f172acc]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((value) => !value)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadfce] bg-white text-[#42526e] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-base font-extrabold tracking-[-0.02em] text-[#1f3552] dark:text-slate-50">Sabha Analytics</p>
              <p className="text-xs text-[#7d8ca4] dark:text-slate-400">{ekadashi?.displayDate ? `Next Ekadashi ${ekadashi.displayDate}` : 'Sampark Management'}</p>
            </div>
          </div>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadfce] bg-white text-[#42526e] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <ThemeToggleIcon theme={theme} />
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-[#0f172a]/30 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="absolute left-0 top-0 flex h-full w-[16.5rem] flex-col border-r border-[#eadfce] bg-[#fffcf7] pt-[4.75rem] dark:border-slate-800 dark:bg-[#111827]"
            onClick={(event) => event.stopPropagation()}
          >
            {sidebarContent(() => setMobileOpen(false))}
          </aside>
        </div>
      ) : null}
    </>
  );
}
