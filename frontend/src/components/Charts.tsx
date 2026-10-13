import { useState } from "react";

type Pt = { label: string; sent: number; opened: number; replied: number };

function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function AreaChart({ data, height = 220, series }: { data: Pt[]; height?: number; series: { key: "sent" | "opened" | "replied"; color: string; name: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = height;
  const padL = 6;
  const padB = 26;
  const max = Math.max(...data.flatMap((d) => series.map((s) => d[s.key]))) * 1.15 || 1;
  const stepX = (W - padL * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => H - padB - (v / max) * (H - padB - 12);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={padL} x2={W - padL} y1={12 + t * (H - padB - 12)} y2={12 + t * (H - padB - 12)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {series.map((s) => {
          const pts = data.map((d, i) => ({ x: padL + i * stepX, y: y(d[s.key]) }));
          const line = smooth(pts);
          return (
            <g key={s.key}>
              <path d={`${line} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`} fill={`url(#g-${s.key})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 0} fill="#0b0b0f" stroke={s.color} strokeWidth="2.5" />
              ))}
            </g>
          );
        })}
        {hover !== null && (
          <line x1={padL + hover * stepX} x2={padL + hover * stepX} y1={8} y2={H - padB} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
        )}
        {data.map((d, i) => (
          <g key={d.label}>
            <text x={padL + i * stepX} y={H - 6} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>{d.label}</text>
            <rect
              x={padL + i * stepX - stepX / 2} y={0} width={stepX} height={H - padB} fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-40 -translate-x-1/2 rounded-xl border border-ink-600 bg-ink-850/95 p-2.5 text-[11px] shadow-xl backdrop-blur"
          style={{ left: `${((padL + hover * stepX) / W) * 100}%` }}
        >
          <p className="mb-1.5 font-semibold text-white">{data[hover].label}</p>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="font-medium text-slate-100">{data[hover][s.key].toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, height = 160, color = "#8b5cf6" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center gap-2">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-100 opacity-85"
              style={{ height: `${(d.value / max) * 100}%`, background: `linear-gradient(180deg, ${color}, ${color}44)` }}
            />
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
              {d.value.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 148, thickness = 18, center }: { segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: { top: string; bottom: string } }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} strokeLinecap="butt"
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      {center && (
        <div className="absolute text-center">
          <p className="text-xl font-semibold tracking-tight text-white">{center.top}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">{center.bottom}</p>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, color = "#6366f1", w = 90, h = 30 }: { values: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * w, y: h - ((v - min) / (max - min || 1)) * (h - 4) - 2 }));
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={smooth(pts)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.4" fill={color} />
    </svg>
  );
}

export function FunnelBars({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const max = steps[0]?.value || 1;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? (s.value / steps[i - 1].value) * 100 : 100;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-white">{s.value.toLocaleString()}</span>
                {i > 0 && <span className="text-slate-600">{prev.toFixed(1)}%</span>}
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-lg bg-white/[0.04]">
              <div
                className="h-full rounded-lg transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}66)` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Heatmap({ grid, rows, cols }: { grid: number[][]; rows: string[]; cols: string[] }) {
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[420px]">
        <div className="mb-1 grid gap-1 pl-9" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
          {cols.map((c) => (
            <span key={c} className="text-center text-[9px] text-slate-600">{c}</span>
          ))}
        </div>
        {grid.map((row, ri) => (
          <div key={rows[ri]} className="mb-1 flex items-center gap-1">
            <span className="w-8 text-[9px] text-slate-600">{rows[ri]}</span>
            <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
              {row.map((v, hi) => (
                <div
                  key={hi}
                  title={`${rows[ri]} ${cols[hi]} — ${v}%`}
                  className="aspect-square rounded-[3px] transition hover:scale-110 hover:ring-1 hover:ring-white/30"
                  style={{ background: v === 0 ? "rgba(255,255,255,0.03)" : `rgba(99,102,241,${0.12 + (v / 100) * 0.85})` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
