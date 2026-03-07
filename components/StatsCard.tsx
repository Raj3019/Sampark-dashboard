interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  accent?: 'orange' | 'green' | 'yellow' | 'red' | 'blue';
}

const accentMap = {
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  green: 'text-green-400 bg-green-500/10 border-green-500/20',
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

export default function StatsCard({ title, value, subtitle, icon, accent = 'orange' }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        {icon && (
          <span className={`text-lg w-8 h-8 flex items-center justify-center rounded-lg border ${accentMap[accent]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold ${accentMap[accent].split(' ')[0]}`}>{value}</p>
      {subtitle && <p className="text-slate-500 text-xs">{subtitle}</p>}
    </div>
  );
}
