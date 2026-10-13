import type { ReactNode, SVGProps } from "react";

const paths: Record<string, ReactNode> = {
  home: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15v-4" /><path d="M12 15V7" /><path d="M17 15v-6" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></>,
  template: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0c.14.36.4.66.73.86.3.18.65.26 1 .25H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  chevronRight: <><path d="m9 18 6-6-6-6" /></>,
  chevronLeft: <><path d="m15 18-6-6 6-6" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  reply: <><path d="M9 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h11a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5H8" /><path d="m9 13-4 4 4 4" /></>,
  zap: <><path d="M13 2 3 14h8l-1 8 11-13h-9l1-7Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>,
  play: <><path d="M6 4l14 8-14 8V4Z" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  filter: <><path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z" /></>,
  sparkles: <><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16l-1.8-4.5L5 9.7l5.2-1.8L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
  phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2.1Z" /></>,
  linkedin: <><rect x="2" y="2" width="20" height="20" rx="4" /><path d="M7 10v7" /><circle cx="7" cy="7" r="1" /><path d="M11 17v-4a3 3 0 0 1 6 0v4" /></>,
  branch: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M6 8.5V14a3 3 0 0 0 3 3h6.5" /><path d="M6 14a3 3 0 0 0 3 3" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 9 5-5 5 5" /><path d="M12 4v12" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 11 5 5 5-5" /><path d="M12 16V4" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  command: <><path d="M15 6a3 3 0 1 1 3 3h-3V6ZM9 6a3 3 0 1 0-3 3h3V6Z" /><path d="M15 18a3 3 0 1 0 3-3h-3v3ZM9 18a3 3 0 1 1-3-3h3v3Z" /><rect x="9" y="9" width="6" height="6" /></>,
  more: <><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  flame: <><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .4-2 1-3-2 1-4 3.5-4 7a7 7 0 0 0 14 0c0-6-7-12-7-12Z" /></>,
  at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>,
  paperclip: <><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  bold: <><path d="M7 4h6a4 4 0 0 1 0 8H7V4Z" /><path d="M7 12h7a4 4 0 0 1 0 8H7v-8Z" /></>,
  italic: <><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m3 17 5-4 4 3 3-2 6 5" /></>,
  code: <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>,
  star: <><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3Z" /></>,
  archive: <><rect x="2" y="4" width="20" height="4" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></>,
  wallet: <><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><circle cx="17" cy="14.5" r="1" /></>,
};

export function Icon({ name, className = "h-4 w-4", ...rest }: { name: keyof typeof paths | string; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {paths[name] ?? paths.sparkles}
    </svg>
  );
}

export function Avatar({ name, hue = 250, size = 34, ring }: { name: string; hue?: number; size?: number; ring?: boolean }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white/95 ${ring ? "ring-2 ring-ink-900" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, hsl(${hue} 72% 58%), hsl(${(hue + 40) % 360} 68% 42%))`,
      }}
    >
      {initials}
    </div>
  );
}

export function Badge({ children, tone = "slate", dot, className = "" }: { children: ReactNode; tone?: string; dot?: boolean; className?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-white/5 text-slate-300 ring-white/10",
    emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    rose: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
    violet: "bg-violet-500/10 text-violet-300 ring-violet-500/25",
    brand: "bg-brand-500/12 text-brand-300 ring-brand-500/30",
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone] ?? tones.slate} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "default",
  size = "md",
  icon,
  className = "",
  ...rest
}: {
  children?: ReactNode;
  variant?: "primary" | "default" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-500 shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_6px_18px_-6px_rgba(79,70,229,0.8)]",
    default: "bg-white/[0.06] text-slate-200 hover:bg-white/[0.11] ring-1 ring-inset ring-white/10",
    ghost: "text-slate-400 hover:text-white hover:bg-white/[0.06]",
    danger: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30 hover:bg-rose-500/25",
    success: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25",
  };
  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3.5 text-[13px] gap-2",
    lg: "h-11 px-5 text-sm gap-2",
    icon: "h-9 w-9 justify-center",
  };
  return (
    <button
      className={`inline-flex shrink-0 items-center rounded-lg font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

export function Card({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={`rounded-2xl border border-ink-700/80 bg-ink-900/70 backdrop-blur-sm ${pad ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Progress({ value, tone = "brand", className = "" }: { value: number; tone?: string; className?: string }) {
  const tones: Record<string, string> = {
    brand: "from-brand-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-400",
    amber: "from-amber-500 to-orange-400",
    rose: "from-rose-500 to-pink-500",
    sky: "from-sky-500 to-cyan-400",
  };
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${tones[tone] ?? tones.brand} transition-all duration-700`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange?.(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-brand-500" : "bg-white/12"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-4.5" : "left-0.5"}`} />
    </button>
  );
}

export function Ring({ value, size = 46, stroke = 4, tone = "#34d399", label }: { value: number; size?: number; stroke?: number; tone?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-white">{label ?? value}</span>
    </div>
  );
}

export function Tabs({ tabs, active, onChange, className = "" }: { tabs: string[]; active: string; onChange: (t: string) => void; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-ink-700/80 bg-ink-900/60 p-1 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            active === t ? "bg-white/[0.09] text-white shadow-sm ring-1 ring-inset ring-white/10" : "text-slate-500 hover:text-slate-200"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, delta, hint, tone = "emerald" }: { label: string; value: string; delta?: string; hint?: string; tone?: "emerald" | "rose" | "slate" }) {
  const up = delta?.startsWith("+");
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl" />
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {delta && (
          <span className={`mb-0.5 text-[11px] font-semibold ${tone === "slate" ? "text-slate-400" : up ? "text-emerald-400" : "text-rose-400"}`}>{delta}</span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </Card>
  );
}

export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${width} animate-pop rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl shadow-black/60`}>
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="x" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-700 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-600">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20";

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-ink-700/70 ${className}`} />;
}
