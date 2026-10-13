import { useCallback, useEffect, useState } from "react";
import { Sidebar, Topbar, CommandPalette } from "./components/Shell";
import type { NavKey } from "./components/Shell";
import { Dashboard } from "./views/Dashboard";
import { Campaigns } from "./views/Campaigns";
import { CampaignDetail } from "./views/CampaignDetail";
import { Leads } from "./views/Leads";
import { Inbox } from "./views/Inbox";
import { Analytics } from "./views/Analytics";
import { Accounts } from "./views/Accounts";
import { Templates } from "./views/Templates";
import { Settings } from "./views/Settings";
import { Icon } from "./components/ui";

type Toast = { id: number; msg: string; tone: string };

const META: Record<NavKey, { title: string; subtitle: string; crumb: string[] }> = {
  dashboard: { title: "Dashboard", subtitle: "Monday, Feb 23 · 4 campaigns sending today", crumb: ["Workspace", "Dashboard"] },
  campaigns: { title: "Campaigns", subtitle: "5 campaigns · 9,840 leads · 41,720 emails sent", crumb: ["Workspace", "Campaigns"] },
  leads: { title: "Leads", subtitle: "9,840 leads across 5 lists", crumb: ["Workspace", "Leads"] },
  inbox: { title: "Unified Inbox", subtitle: "2 unread replies across 3 inboxes", crumb: ["Workspace", "Inbox"] },
  analytics: { title: "Analytics", subtitle: "Account-wide performance and deliverability", crumb: ["Workspace", "Analytics"] },
  accounts: { title: "Email Accounts", subtitle: "7 connected inboxes · 5 warming", crumb: ["Workspace", "Email Accounts"] },
  templates: { title: "Templates", subtitle: "6 saved templates · avg. 10.5% reply rate", crumb: ["Workspace", "Templates"] },
  settings: { title: "Settings", subtitle: "Workspace configuration", crumb: ["Workspace", "Settings"] },
};

export default function App() {
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, tone = "brand") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const openCampaign = (id: string) => {
    setCampaignId(id);
    setNav("campaigns");
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const meta = META[nav];
  const isDetail = nav === "campaigns" && campaignId;

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950">
      {/* mobile sidebar scrim */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileNav(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:static lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar
          active={nav}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onNavigate={(k) => { setNav(k); setCampaignId(null); setMobileNav(false); }}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <Topbar
          title={isDetail ? "Campaign" : meta.title}
          subtitle={isDetail ? "Sequence, schedule and performance" : meta.subtitle}
          breadcrumb={isDetail ? ["Campaigns", "Detail"] : meta.crumb}
          onCommand={() => setPalette(true)}
          onMobileNav={() => setMobileNav(true)}
        />

        <div className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] p-4 md:p-6">
            {nav === "dashboard" && <Dashboard onOpenCampaign={openCampaign} />}
            {nav === "campaigns" && !campaignId && <Campaigns onOpenCampaign={openCampaign} toast={toast} />}
            {nav === "campaigns" && campaignId && <CampaignDetail id={campaignId} onBack={() => setCampaignId(null)} toast={toast} />}
            {nav === "leads" && <Leads toast={toast} />}
            {nav === "inbox" && <Inbox toast={toast} />}
            {nav === "analytics" && <Analytics />}
            {nav === "accounts" && <Accounts toast={toast} />}
            {nav === "templates" && <Templates toast={toast} />}
            {nav === "settings" && <Settings toast={toast} />}

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-5 text-[11px] text-slate-600">
              <span>© 2026 Northwind Outbound · UI prototype · no data leaves this page</span>
              <span className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />All systems operational</span>
                <span className="flex items-center gap-1.5"><Icon name="command" className="h-3 w-3" />K to search</span>
              </span>
            </footer>
          </div>
        </div>
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      {/* toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-70 flex w-[300px] flex-col gap-2">
        {toasts.map((t) => {
          const tones: Record<string, string> = {
            emerald: "border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-100",
            rose: "border-rose-500/30 bg-rose-500/[0.12] text-rose-100",
            amber: "border-amber-500/30 bg-amber-500/[0.12] text-amber-100",
            violet: "border-violet-500/30 bg-violet-500/[0.12] text-violet-100",
            sky: "border-sky-500/30 bg-sky-500/[0.12] text-sky-100",
            brand: "border-brand-500/30 bg-brand-500/[0.12] text-brand-100",
          };
          const icons: Record<string, string> = {
            emerald: "check", rose: "trash", amber: "bell", violet: "sparkles", sky: "clock", brand: "zap",
          };
          return (
            <div key={t.id} className={`pointer-events-auto flex animate-slide-up items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] shadow-xl shadow-black/40 backdrop-blur-xl ${tones[t.tone] ?? tones.brand}`}>
              <Icon name={icons[t.tone] ?? "zap"} className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t.msg}</span>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="opacity-50 hover:opacity-100"><Icon name="x" className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
