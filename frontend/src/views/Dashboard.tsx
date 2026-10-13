import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, SectionTitle, Badge, Avatar, Tabs, Icon } from "../components/ui";
import { Donut, FunnelBars, Sparkline } from "../components/Charts";
import * as api from "../lib/api";
import type { RawCampaign } from "../lib/api";
import type { Campaign, CampaignStatus, Lead } from "../lib/data";

const statusTone: Record<CampaignStatus, string> = {
  active: "emerald",
  paused: "amber",
  draft: "slate",
  completed: "sky",
};

function pct(n: number, d: number) {
  return d ? ((n / d) * 100).toFixed(1) : "0.0";
}

function KpiTile({ label, value, delta, spark, color, sub }: { label: string; value: string; delta?: string; spark?: number[]; color: string; sub: string }) {
  return (
    <Card className="group relative overflow-hidden">
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition group-hover:opacity-20" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {/* Deltas/sparklines need a time series, which the API does not provide: hidden. */}
        {delta && <Badge tone={delta.startsWith("+") ? "emerald" : "rose"}>{delta}</Badge>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[26px] font-semibold leading-none tracking-tight text-white">{value}</p>
          <p className="mt-2 text-[11px] text-slate-500">{sub}</p>
        </div>
        {spark && <Sparkline values={spark} color={color} />}
      </div>
    </Card>
  );
}

function CampaignRow({ c, onOpen, showInbox }: { c: Campaign; onOpen: () => void; showInbox: boolean }) {
  return (
    <tr onClick={onOpen} className="group cursor-pointer border-t border-ink-700/60 transition hover:bg-white/[0.025]">
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-500/20">
            <Icon name="send" className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white group-hover:text-brand-200">{c.name}</p>
            {/* Accounts/daily limit are detail-only fields: show real sequence progress. */}
            <p className="truncate text-[11px] text-slate-500">{c.progress}% through sequence</p>
          </div>
        </div>
      </td>
      <td className="px-3"><Badge tone={statusTone[c.status]} dot>{c.status}</Badge></td>
      <td className="px-3 text-[13px] tabular-nums text-slate-300">{c.leads.toLocaleString()}</td>
      <td className="px-3 text-[13px] tabular-nums text-slate-300">{c.sent.toLocaleString()}</td>
      {/* "Open" column: no open tracking exists — hidden. */}
      <td className="px-3 text-[13px] tabular-nums font-medium text-emerald-300">{pct(c.replied, c.sent)}%</td>
      <td className="px-3 text-[13px] tabular-nums text-violet-300">{c.meetings}</td>
      <td className="px-3 text-[13px] tabular-nums text-rose-300/80">{pct(c.bounced, c.sent)}%</td>
      {showInbox && (
        <td className="py-3 pl-3 pr-5 text-right">
          <div className="flex -space-x-1.5">
            {c.accounts.slice(0, 3).map((a) => (
              <Avatar key={a} name={a.split("@")[0]} hue={(a.charCodeAt(0) * 7) % 360} size={22} ring />
            ))}
          </div>
        </td>
      )}
    </tr>
  );
}

export function Dashboard({ onOpenCampaign }: { onOpenCampaign: (id: string) => void }) {
  const [tab, setTab] = useState("All");
  const [rawCampaigns, setRawCampaigns] = useState<RawCampaign[]>([]);
  const [topLeads, setTopLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api.http
      .get<{ campaigns: RawCampaign[] }>("/campaigns")
      .then((res) => setRawCampaigns(res.campaigns))
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api
      .listAllLeads()
      .then((rows) => setTopLeads(rows.map(api.toLead).sort((a, b) => b.score - a.score).slice(0, 5)))
      .catch(() => setTopLeads([]));
  }, [load]);

  const campaigns = useMemo(() => rawCampaigns.map(api.toCampaign), [rawCampaigns]);
  const filtered = campaigns.filter((c) => (tab === "All" ? true : c.status === tab.toLowerCase()));

  const totals = rawCampaigns.reduce(
    (a, c) => {
      const s = c.stats;
      if (!s) return a;
      return {
        sent: a.sent + s.sent,
        replied: a.replied + s.replied,
        meetings: a.meetings + s.meetings,
        leads: a.leads + s.total,
        contacted: a.contacted + s.contacted,
        goneOut: a.goneOut + s.gone_out,
        bounced: a.bounced + s.bounced,
        unsubscribed: a.unsubscribed + s.unsubscribed,
      };
    },
    { sent: 0, replied: 0, meetings: 0, leads: 0, contacted: 0, goneOut: 0, bounced: 0, unsubscribed: 0 },
  );
  const delivered = Math.max(0, totals.goneOut - totals.bounced);
  const noReply = Math.max(0, totals.contacted - totals.replied);
  const showInbox = filtered.some((c) => c.accounts.length > 0);

  if (loading) {
    return (
      <div className="space-y-5">
        <Card className="grid place-items-center py-16">
          <p className="text-[12px] text-slate-500">Loading dashboard…</p>
        </Card>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-5">
        <Card className="grid place-items-center py-16 text-center">
          <p className="text-[12px] text-slate-400">{loadError}</p>
          <button onClick={load} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI row — values are real totals; the "Open rate" tile is hidden (no open tracking). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Emails sent" value={totals.sent.toLocaleString()} sub={`${totals.leads.toLocaleString()} leads in rotation`} color="#6366f1" />
        <KpiTile label="Reply rate" value={`${pct(totals.replied, totals.sent)}%`} sub={`${totals.replied.toLocaleString()} total replies`} color="#34d399" />
        <KpiTile label="Meetings booked" value={totals.meetings.toString()} sub="" color="#a78bfa" />
      </div>

      {/* "Sending performance" chart: the API has no time series — hidden. Funnel and reply
          split below use real counters. */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <SectionTitle title="Sequence funnel" sub="Whole account" />
            <FunnelBars
              steps={[
                { label: "Delivered", value: delivered, color: "#6366f1" },
                // "Opened" and "Positive" steps: no data in the API — hidden.
                { label: "Replied", value: totals.replied, color: "#34d399" },
                { label: "Meeting", value: totals.meetings, color: "#fbbf24" },
              ]}
            />
          </Card>
          <Card>
            <div className="flex items-center gap-5">
              <Donut
                segments={[
                  { label: "Replied", value: totals.replied, color: "#34d399" },
                  { label: "No reply", value: noReply, color: "#64748b" },
                ]}
                center={{ top: `${pct(totals.replied, totals.contacted)}%`, bottom: "reply rate" }}
              />
              <div className="flex-1 space-y-2.5">
                {[
                  ["Replied", totals.replied, "#34d399"],
                  ["No reply", noReply, "#64748b"],
                  ["Unsubscribed", totals.unsubscribed, "#f43f5e"],
                ].map(([l, v, c]) => (
                  <div key={String(l)} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ background: String(c) }} />
                      {l}
                    </span>
                    <span className="font-medium text-slate-200">{(v as number).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* campaigns table + right column */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card pad={false} className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">Campaign performance</h3>
              <p className="mt-0.5 text-xs text-slate-500">Click a row to open the sequence builder</p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs tabs={["All", "Active", "Paused", "Draft"]} active={tab} onChange={setTab} />
              {/* Export: no export API — hidden. */}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pl-5 pr-3 font-medium">Campaign</th>
                  <th className="px-3 pb-2 font-medium">Status</th>
                  <th className="px-3 pb-2 font-medium">Leads</th>
                  <th className="px-3 pb-2 font-medium">Sent</th>
                  {/* Open column: no open tracking — hidden. */}
                  <th className="px-3 pb-2 font-medium">Reply</th>
                  <th className="px-3 pb-2 font-medium">Mtgs</th>
                  <th className="px-3 pb-2 font-medium">Bounce</th>
                  {showInbox && <th className="pb-2 pl-3 pr-5 text-right font-medium">Inbox</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showInbox ? 8 : 7} className="px-5 py-10 text-center text-[12px] text-slate-500">
                      No campaigns match this filter.
                    </td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <CampaignRow key={c.id} c={c} onOpen={() => onOpenCampaign(c.id)} showInbox={showInbox} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          {/* "Live activity": no events feed in the API — hidden. */}
          <Card>
            <SectionTitle title="Hottest leads" sub="Highest engagement score" />
            <div className="space-y-1">
              {topLeads.length === 0 && (
                <p className="py-6 text-center text-[12px] text-slate-500">No leads yet.</p>
              )}
              {topLeads.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-white/[0.04]">
                  <Avatar name={l.name} hue={l.avatarHue} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white">{l.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{[l.title, l.company].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-white">{l.score}</p>
                    <p className="text-[10px] text-slate-600">score</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
