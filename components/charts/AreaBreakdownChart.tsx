'use client';

interface AreaData {
  area: string;
  total: number;
  green: number;
  yellow: number;
  red: number;
}

interface Props {
  areaData: AreaData[];
  title?: string;
}

export default function AreaBreakdownChart({ areaData, title = 'Area-wise Breakdown' }: Props) {
  const sorted = [...areaData].sort((a, b) => b.total - a.total);
  const totalYuvaks = sorted.reduce((s, a) => s + a.total, 0);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-slate-100 font-semibold">{title}</h3>
          <p className="text-slate-500 text-xs mt-0.5">{totalYuvaks} yuvaks across {sorted.length} areas</p>
        </div>
        <div className="flex gap-4 text-xs">
          {[
            { label: 'Active', color: 'bg-green-500' },
            { label: 'At Risk', color: 'bg-yellow-400' },
            { label: 'Inactive', color: 'bg-red-500' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
              <span className="text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Area rows */}
      <div className="space-y-5">
        {sorted.map((a) => {
          const activePct = a.total > 0 ? (a.green / a.total) * 100 : 0;
          const riskPct   = a.total > 0 ? (a.yellow / a.total) * 100 : 0;
          const inactivePct = a.total > 0 ? (a.red / a.total) * 100 : 0;

          return (
            <div key={a.area}>
              {/* Row header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-200 text-sm font-medium">{a.area}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-400 font-semibold">{a.green}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-yellow-400 font-semibold">{a.yellow}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-red-400 font-semibold">{a.red}</span>
                  <span className="text-slate-600 ml-1">·</span>
                  <span className="text-slate-400 font-medium">{a.total} total</span>
                </div>
              </div>

              {/* Stacked progress bar */}
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-700/40 gap-px">
                {activePct > 0 && (
                  <div
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${activePct}%` }}
                    title={`Active: ${a.green} (${Math.round(activePct)}%)`}
                  />
                )}
                {riskPct > 0 && (
                  <div
                    className="bg-yellow-400 transition-all duration-500"
                    style={{ width: `${riskPct}%` }}
                    title={`At Risk: ${a.yellow} (${Math.round(riskPct)}%)`}
                  />
                )}
                {inactivePct > 0 && (
                  <div
                    className="bg-red-500/80 transition-all duration-500"
                    style={{ width: `${inactivePct}%` }}
                    title={`Inactive: ${a.red} (${Math.round(inactivePct)}%)`}
                  />
                )}
              </div>

              {/* Percentage labels */}
              <div className="flex justify-between mt-1.5 text-[11px]">
                <span className="text-green-500/80">{Math.round(activePct)}% active</span>
                <span className="text-slate-600">
                  {Math.round(riskPct)}% at risk · {Math.round(inactivePct)}% inactive
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

