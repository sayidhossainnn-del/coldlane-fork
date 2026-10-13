import { ReactNode } from "react";
import { cn } from "../utils/cn";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import type { CampaignStatus } from "../data/mock";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  positive = true,
  icon: Icon,
  accent = "indigo",
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  icon: LucideIcon;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "violet";
}) {
  const accents: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accents[accent])}>
          <Icon size={18} />
        </div>
      </div>
      {delta && (
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold">
          {positive ? (
            <ArrowUpRight size={14} className="text-emerald-500" />
          ) : (
            <ArrowDownRight size={14} className="text-rose-500" />
          )}
          <span className={positive ? "text-emerald-600" : "text-rose-600"}>{delta}</span>
          <span className="font-normal text-slate-400">vs last week</span>
        </div>
      )}
    </Card>
  );
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const styles: Record<CampaignStatus, string> = {
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Paused: "bg-amber-50 text-amber-700 ring-amber-200",
    Draft: "bg-slate-100 text-slate-600 ring-slate-200",
    Completed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  };
  const dot: Record<CampaignStatus, string> = {
    Active: "bg-emerald-500",
    Paused: "bg-amber-500",
    Draft: "bg-slate-400",
    Completed: "bg-indigo-500",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", styles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status])} />
      {status}
    </span>
  );
}

export function ProgressBar({ value, color = "indigo" }: { value: number; color?: "indigo" | "emerald" | "amber" }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", colors[color])} style={{ width: `${value}%` }} />
    </div>
  );
}

export function IconButton({ icon: Icon, onClick, className }: { icon: LucideIcon; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800",
        className
      )}
    >
      <Icon size={15} />
    </button>
  );
}

export function PrimaryButton({ children, className, onClick, icon: Icon }: { children: ReactNode; className?: string; onClick?: () => void; icon?: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700",
        className
      )}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, onClick, icon: Icon }: { children: ReactNode; className?: string; onClick?: () => void; icon?: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
        className
      )}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600", className)}>
      {children}
    </span>
  );
}
