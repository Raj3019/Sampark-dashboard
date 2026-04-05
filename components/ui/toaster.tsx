'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';

export default function Toaster() {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      expand={false}
      gap={12}
      visibleToasts={3}
      mobileOffset="1rem"
      theme={theme}
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            'w-[360px] max-w-[calc(100vw-1rem)] rounded-xl border border-slate-700/80 bg-slate-950/95 px-4 py-3 text-slate-100 shadow-[0_18px_45px_rgba(2,6,23,0.38)] backdrop-blur-xl',
          content: 'gap-1',
          icon: 'mt-0.5',
          title: 'text-sm font-semibold leading-tight text-slate-50',
          description: 'text-xs leading-5 text-slate-300',
          actionButton:
            'rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-orange-400',
          cancelButton:
            'rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800',
          closeButton:
            'rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-slate-100',
          success: 'border-emerald-500/30 bg-emerald-950/95 text-emerald-100',
          error: 'border-red-500/30 bg-red-950/95 text-red-100',
          info: 'border-sky-500/30 bg-sky-950/95 text-sky-100',
          warning: 'border-amber-500/30 bg-amber-950/95 text-amber-100',
          loading: 'border-slate-700 bg-slate-950/95 text-slate-100',
          default: 'border-slate-700 bg-slate-950/95 text-slate-100',
        },
      }}
    />
  );
}
