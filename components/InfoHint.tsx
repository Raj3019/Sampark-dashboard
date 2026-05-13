import { Info } from 'lucide-react';

export default function InfoHint({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      <span
        tabIndex={0}
        aria-label={label}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-current/45 text-[10px] opacity-75 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none"
      >
        <Info className="h-3 w-3" />
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-44 -translate-x-1/2 rounded-lg border border-[#d8cdbd] bg-white px-2.5 py-1.5 text-[11px] font-medium normal-case leading-snug tracking-normal text-[#334155] shadow-[0_10px_24px_rgba(31,41,55,0.14)] group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
        {label}
      </span>
    </span>
  );
}
