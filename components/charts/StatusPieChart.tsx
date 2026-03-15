'use client';

interface Props {
  green: number;
  yellow: number;
  red: number;
  title?: string;
}

export default function StatusPieChart({ green, yellow, red: _red, title = 'Overall Status' }: Props) {
  const total = green + yellow;
  const gPct  = total > 0 ? (green  / total) * 100 : 0;
  const yPct  = total > 0 ? (yellow / total) * 100 : 0;
  // const rPct  = total > 0 ? (red    / total) * 100 : 0;

  const gradient = total > 0
    ? `conic-gradient(#22c55e 0% ${gPct}%, #eab308 ${gPct}% 100%)`
    : 'conic-gradient(#334155 0% 100%)';

  const segments = [
    { label: 'Active',     count: green,  pct: gPct, color: '#22c55e', text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Attention',  count: yellow, pct: yPct, color: '#eab308', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    // { label: 'Absent',     count: red,    pct: rPct, color: '#ef4444', text: 'text-red-400',   bg: 'bg-red-500/10   border-red-500/20'   },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-slate-100 font-semibold">{title}</h3>
        <p className="text-slate-500 text-xs mt-0.5">Based on last 3 / 6 sabha attendance</p>
      </div>

      <div className="flex items-center gap-5">
        {/* CSS Donut */}
        <div className="relative shrink-0 w-32 h-32">
          <div className="w-full h-full rounded-full" style={{ background: gradient }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-slate-100 leading-none">{total}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Total</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {segments.map((s) => (
            <div key={s.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${s.bg}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className={`text-sm font-medium ${s.text}`}>{s.label}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <span className={`font-bold text-sm tabular-nums ${s.text}`}>{s.count}</span>
                <span className="text-slate-500 text-xs tabular-nums">{s.pct.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
