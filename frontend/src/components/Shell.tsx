import { Icon } from "./ui";

export type NavKey =
  | "dashboard" | "campaigns" | "leads" | "inbox" | "analytics"
  | "accounts" | "templates" | "settings";

// Counts are not hardcoded: badges would need live data from the API.
export const NAV: { key: NavKey; label: string; icon: string; badge?: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "campaigns", label: "Campaigns", icon: "send" },
  { key: "leads", label: "Leads", icon: "users" },
  { key: "inbox", label: "Unified Inbox", icon: "inbox" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "accounts", label: "Email Accounts", icon: "at" },
  { key: "templates", label: "Templates", icon: "template" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export function Sidebar({
  active,
  onNavigate,
  collapsed,
  onToggle,
}: {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`relative z-20 flex h-full shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/80 backdrop-blur-xl transition-all duration-300 ${
        collapsed ? "w-[68px]" : "w-[236px]"
      }`}
    >
      {/* brand */}
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-600 to-violet-700 shadow-lg shadow-brand-900/50">
          <Icon name="send" className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold tracking-tight text-white">Northwind</p>
            <p className="truncate text-[10px] text-slate-500">Outbound Platform</p>
          </div>
        )}
        <button onClick={onToggle} className="hidden rounded-md p-1 text-slate-600 hover:bg-white/5 hover:text-slate-300 lg:block">
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} className="h-4 w-4" />
        </button>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        {!collapsed && <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Workspace</p>}
        {NAV.map((n) => {
          const isActive = active === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              title={collapsed ? n.label : undefined}
              className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all ${
                isActive ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400" />}
              <Icon name={n.icon} className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"}`} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.badge && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? "bg-brand-500/25 text-brand-200" : "bg-white/[0.07] text-slate-400"}`}>
                      {n.badge}
                    </span>
                  )}
                </>
              )}
              {collapsed && n.badge && <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-400" />}
            </button>
          );
        })}

        {/* Warmup / deliverability widget: no API backs it — hidden. */}
      </nav>

      {/* User footer: there is no user/profile API — hidden. */}
    </aside>
  );
}

export function Topbar({
  title,
  subtitle,
  onCommand,
  onMobileNav,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  onCommand: () => void;
  onMobileNav: () => void;
  breadcrumb?: string[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-700/70 bg-ink-950/80 px-4 backdrop-blur-xl md:px-6">
      <button onClick={onMobileNav} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden">
        <Icon name="layout" />
      </button>

      <div className="min-w-0">
        {breadcrumb && (
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-slate-600">
            {breadcrumb.map((b, i) => (
              <span key={b} className="flex items-center gap-1.5">
                {i > 0 && <Icon name="chevronRight" className="h-2.5 w-2.5" />}
                {b}
              </span>
            ))}
          </div>
        )}
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onCommand}
          className="hidden items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-1.5 text-[12px] text-slate-500 transition hover:border-ink-600 hover:text-slate-300 md:flex"
        >
          <Icon name="search" className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="ml-6 flex items-center gap-0.5 rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-500">
            <Icon name="command" className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <button className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
          {/* Unread dot: no notifications API — hidden. */}
          <Icon name="bell" />
        </button>

        {/* Sender avatar stack and "Live sending" badge: no API in the shell — hidden. */}

        <button className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/40 transition hover:brightness-110">
          <Icon name="plus" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

const PALETTE_ITEMS = [
  { icon: "plus", label: "Create new campaign", hint: "C" },
  { icon: "upload", label: "Import leads from CSV", hint: "I" },
  { icon: "at", label: "Connect email account", hint: "E" },
  { icon: "sparkles", label: "Generate email with AI", hint: "G" },
  { icon: "send", label: "Go to Campaigns", hint: "" },
  { icon: "users", label: "Go to Leads", hint: "" },
  { icon: "inbox", label: "Go to Unified Inbox", hint: "" },
  { icon: "chart", label: "Go to Analytics", hint: "" },
  { icon: "settings", label: "Open deliverability settings", hint: "" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop overflow-hidden rounded-2xl border border-ink-600 bg-ink-850/95 shadow-2xl shadow-black/70">
        <div className="flex items-center gap-3 border-b border-ink-700 px-4">
          <Icon name="search" className="h-4 w-4 text-slate-500" />
          <input autoFocus placeholder="Search campaigns, leads, actions…" className="h-14 flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none" />
          <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          <p className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Suggested</p>
          {PALETTE_ITEMS.map((it, i) => (
            <button
              key={it.label}
              onClick={onClose}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[13px] transition ${
                i === 0 ? "bg-white/[0.07] text-white" : "text-slate-300 hover:bg-white/[0.05]"
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${i === 0 ? "bg-brand-500/20 text-brand-300" : "bg-white/[0.05] text-slate-400"}`}>
                <Icon name={it.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1">{it.label}</span>
              {it.hint && <kbd className="rounded border border-ink-600 px-1.5 text-[10px] text-slate-500">{it.hint}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
