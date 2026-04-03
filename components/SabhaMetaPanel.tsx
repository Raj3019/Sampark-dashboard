import { SabhaMeta } from '@/lib/types';

export default function SabhaMetaPanel({
  vakta,
  topic,
  compact = false,
  vaktaLabel = 'Vakta',
  topicLabel = 'Topic',
}: SabhaMeta & { compact?: boolean; vaktaLabel?: string; topicLabel?: string }) {
  const valueClass = compact ? 'text-xs text-slate-300' : 'text-sm text-slate-200';
  const labelClass = compact ? 'text-[11px] text-slate-500 uppercase tracking-wide' : 'text-xs text-slate-500 uppercase tracking-wide';

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
      <div>
        <p className={labelClass}>{vaktaLabel}</p>
        <p className={valueClass}>{vakta || 'Not added yet'}</p>
      </div>
      <div>
        <p className={labelClass}>{topicLabel}</p>
        <p className={valueClass}>{topic || 'Not added yet'}</p>
      </div>
    </div>
  );
}
