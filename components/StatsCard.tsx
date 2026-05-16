interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  accent?: 'orange' | 'green' | 'yellow' | 'red' | 'blue';
  eyebrow?: string;
}

const accentMap = {
  orange: {
    value: 'text-amber-500 dark:text-amber-400',
    icon: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/20',
    glow: 'from-amber-500/10 via-amber-500/0',
  },
  green: {
    value: 'text-emerald-600 dark:text-emerald-400',
    icon: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    glow: 'from-emerald-500/10 via-emerald-500/0',
  },
  yellow: {
    value: 'text-amber-600 dark:text-yellow-400',
    icon: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-yellow-300 dark:bg-yellow-500/10 dark:border-yellow-500/20',
    glow: 'from-yellow-500/10 via-yellow-500/0',
  },
  red: {
    value: 'text-rose-600 dark:text-rose-400',
    icon: 'text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20',
    glow: 'from-rose-500/10 via-rose-500/0',
  },
  blue: {
    value: 'text-sky-600 dark:text-sky-400',
    icon: 'text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/20',
    glow: 'from-sky-500/10 via-sky-500/0',
  },
};

export default function StatsCard({ title, value, subtitle, icon, accent = 'orange', eyebrow }: Props) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#d9cdbb] bg-[#f1eadf] p-4 shadow-[0_14px_30px_rgba(31,41,55,0.06)] dark:border-slate-700/80 dark:bg-slate-800/90 dark:shadow-none">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-br ${accentMap[accent].glow} to-transparent`} />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94a3b8] dark:text-slate-500">{eyebrow}</p>
            )}
            <p className="mt-1 text-[15px] font-medium text-[#64748b] dark:text-slate-400">{title}</p>
          </div>
          {icon && (
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-semibold ${accentMap[accent].icon}`}>
              {icon}
            </span>
          )}
        </div>
        <div>
          <p className={`text-[2.1rem] font-bold tracking-tight ${accentMap[accent].value}`}>{value}</p>
          {subtitle && <p className="mt-1.5 text-[13px] text-[#7c8798] dark:text-slate-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
