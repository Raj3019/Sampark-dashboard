'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from './ThemeProvider';

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'DB' },
  { href: '/sabha/chirag-nagar', label: 'Chirag Nagar', icon: 'CN' },
  { href: '/sabha/kishor', label: 'Kishor Sabha', icon: 'KS' },
  { href: '/kk-analysis', label: 'KK Analysis', icon: 'KK' },
  { href: '/yuvaks', label: 'Yuvak Directory', icon: 'YD' },
  { href: '/ai', label: 'AI Akshar', icon: 'AI' },
];

function ThemeToggleIcon({ theme }: { theme: 'dark' | 'light' }) {
  if (theme === 'dark') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-slate-900 border-r border-slate-800 fixed top-0 left-0 z-30">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
              <Image src="/sampark_logo.jpeg" alt="Sampark Logo" width={36} height={36} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-orange-400 font-bold text-sm leading-tight">Sabha Analytics</p>
              <p className="text-slate-500 text-xs">Sampark Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <span className="text-xs w-5 text-center font-semibold">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <p className="text-slate-600 text-xs">Auto-refreshes every 60s</p>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 border border-slate-700"
          >
            <ThemeToggleIcon theme={theme} />
          </button>
        </div>
      </aside>

      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-white overflow-hidden shrink-0 flex items-center justify-center">
            <Image src="/sampark_logo.jpeg" alt="Sampark Logo" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="text-orange-400 font-bold text-sm">Sabha Analytics</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-slate-300 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700"
          >
            <ThemeToggleIcon theme={theme} />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-slate-400 hover:text-slate-100 p-1"
            aria-label="Toggle menu"
          >
            {mobileOpen ? 'X' : 'M'}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/60" onClick={() => setMobileOpen(false)}>
          <aside
            className="absolute top-0 left-0 w-64 min-h-screen bg-slate-900 border-r border-slate-800 pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs w-5 text-center font-semibold">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
