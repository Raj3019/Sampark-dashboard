import { SabhaMeta } from '@/lib/types';

export default function SabhaMetaPanel({
  vakta,
  topic,
  compact = false,
  vaktaLabel = 'Vakta',
  topicLabel = 'Topic',
}: SabhaMeta & { compact?: boolean; vaktaLabel?: string; topicLabel?: string }) {
  const valueClass = compact ? 'text-[13px] leading-snug text-[#334155] dark:text-slate-300' : 'text-sm text-slate-200';
  const labelClass = compact ? 'text-[10px] font-semibold text-[#7c8798] uppercase tracking-[0.12em] dark:text-slate-500' : 'text-xs text-slate-500 uppercase tracking-wide';

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
      <div className="min-w-0">
        <p className={labelClass}>{vaktaLabel}</p>
        <p className={`mt-1 truncate ${valueClass}`} title={vakta || 'Not added yet'}>{vakta || 'Not added yet'}</p>
      </div>
      <div className="min-w-0">
        <p className={labelClass}>{topicLabel}</p>
        <p className={`mt-1 truncate ${valueClass}`} title={topic || 'Not added yet'}>{topic || 'Not added yet'}</p>
      </div>
    </div>
  );
}
