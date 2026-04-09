import { SabhaMeta } from '@/lib/types';

export default function SabhaMetaPanel({
  vakta,
  topic,
  compact = false,
  vaktaLabel = 'Vakta',
  topicLabel = 'Topic',
}: SabhaMeta & { compact?: boolean; vaktaLabel?: string; topicLabel?: string }) {
  const valueClass = compact ? 'text-[12px] text-[#475569] dark:text-slate-300' : 'text-sm text-slate-200';
  const labelClass = compact ? 'text-[10px] font-medium text-[#7c8798] uppercase tracking-[0.14em] dark:text-slate-500' : 'text-xs text-slate-500 uppercase tracking-wide';

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
      <div>
        <p className={labelClass}>{vaktaLabel}</p>
        <p className={`mt-0.5 ${valueClass}`}>{vakta || 'Not added yet'}</p>
      </div>
      <div>
        <p className={labelClass}>{topicLabel}</p>
        <p className={`mt-0.5 ${valueClass}`}>{topic || 'Not added yet'}</p>
      </div>
    </div>
  );
}
