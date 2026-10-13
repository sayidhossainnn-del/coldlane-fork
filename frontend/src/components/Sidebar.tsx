import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  Users,
  Mail,
  Inbox,
  FileText,
  BarChart3,
  Settings,
  Sparkles,
  ChevronsUpDown,
  Plus,
} from "lucide-react";
import { cn } from "../utils/cn";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/inbox", label: "Unibox", icon: Inbox, badge: 3 },
  { to: "/accounts", label: "Email Accounts", icon: Mail },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-200">
          <Send className="h-4.5 w-4.5" size={18} />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900">Outreachly</span>
      </div>

      <div className="px-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700">
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <span className="flex items-center gap-3">
                <item.icon
                  size={17}
                  className={cn(isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-500")}
                />
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-3.5 ring-1 ring-indigo-100">
        <div className="flex items-center gap-2 text-indigo-700">
          <Sparkles size={15} />
          <span className="text-xs font-semibold">Deliverability Score</span>
        </div>
        <p className="mt-1.5 text-2xl font-bold text-slate-900">94<span className="text-sm font-medium text-slate-400">/100</span></p>
        <p className="mt-1 text-[11px] text-slate-500">Your sending health is excellent this week.</p>
      </div>

      <button className="flex items-center gap-2.5 border-t border-slate-200 px-4 py-3.5 text-left hover:bg-slate-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          JD
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">Jordan Diaz</p>
          <p className="truncate text-xs text-slate-400">jordan@outreachly.io</p>
        </div>
        <ChevronsUpDown size={14} className="text-slate-400" />
      </button>
    </aside>
    </>
  );
}
