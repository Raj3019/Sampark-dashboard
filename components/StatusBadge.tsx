import { AttendanceStatus } from '@/lib/types';
import { getStatusColor, getStatusLabel } from '@/lib/analytics';

interface Props {
  status: AttendanceStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const colors = getStatusColor(status);
  const label = getStatusLabel(status);
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${colors.bg} ${colors.text} ${colors.border} ${sizeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}
