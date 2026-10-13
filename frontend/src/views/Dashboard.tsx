import { useState } from "react";
import { Card, SectionTitle, Badge, Button, Progress, Avatar, Tabs, Icon } from "../components/ui";
import { AreaChart, Donut, Sparkline, FunnelBars } from "../components/Charts";
import { campaigns, rangeSeries, funnel, activity, leads } from "../lib/data";
import type { Campaign, CampaignStatus } from "../lib/data";

const statusTone: Record<CampaignStatus, string> = {
  active: "emerald",
  paused: "amber",
  draft: "slate",
  completed: "sky",
};

function pct(n: number, d: number) {
  return d ? ((n / d) * 100).toFixed(1) : "0.0";
}

function KpiTile({ label, value, delta, spark, color, sub }: { label: string; value: string; delta: string; spark: number[]; color: string; sub: string }) {
  return (
    <Card className="group relative overflow-hidden">
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition group-hover:opacity-20" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <Badge tone={delta.startsWith("+") ? "emerald" : "rose"}>{delta}</Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[26px] font-semibold leading-none tracking-tight text-white">{value}</p>
          <p className="mt-2 text-[11px] text-slate-500">{sub}</p>
        </div>
        <Sparkline values={spark} color={color} />
      </div>
    </Card>
  );
}

function CampaignRow({ c, onOpen }: { c: Campaign; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="group cursor-pointer border-t border-ink-700/60 transition hover:bg-white/[0.025]">
      <td className="py-3 pl-5 pr-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-500/20">
            <Icon name="send" className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white group-hover:text-brand-200">{c.name}</p>
            <p className="truncate text-[11px] text-slate-500">{c.accounts.length || 0} accounts · limit {c.dailyLimit}/day</p>
          </div>
        </div>
      </td>
      <td className="px-3"><Badge tone={statusTone[c.status]} dot>{c.status}</Badge></td>
      <td className="px-3 text-[13px] tabular-nums text-slate-300">{c.leads.toLocaleString()}</td>
      <td className="px-3 text-[13px] tabular-nums text-slate-300">{c.sent.toLocaleString()}</td>
      <td className="px-3 text-[13px] tabular-nums text-slate-300">
        {pct(c.opened, c.sent)}%
        <div className="mt-1.5 w-16"><Progress value={pct(c.opened, c.sent) as unknown as number} tone="sky" /></div>
      </td>
      <td className="px-3 text-[13px] tabular-nums font-medium text-emerald-300">{pct(c.replied, c.sent)}%</td>
      <td className="px-3 text-[13px] tabular-nums text-violet-300">{c.meetings}</td>
      <td className="px-3 text-[13px] tabular-nums text-rose-300/80">{pct(c.bounced, c.sent)}%</td>
      <td className="py-3 pl-3 pr-5 text-right">
        <div className="flex -space-x-1.5">
          {c.accounts.slice(0, 3).map((a) => (
            <Avatar key={a} name={a.split("@")[0]} hue={(a.charCodeAt(0) * 7) % 360} size={22} ring />
          ))}
        </div>
      </td>
    </tr>
  );
}

export function Dashboard({ onOpenCampaign }: { onOpenCampaign: (id: string) => void }) {
  const [range, setRange] = useState("30d");
  const [tab, setTab] = useState("All");

  const data = rangeSeries[range];
  const filtered = campaigns.filter((c) => (tab === "All" ? true : c.status === tab.toLowerCase()));
  const totals = campaigns.reduce(
    (a, c) => ({
      sent: a.sent + c.sent,
      opened: a.opened + c.opened,
      replied: a.replied + c.replied,
      meetings: a.meetings + c.meetings,
      leads: a.leads + c.leads,
    }),
    { sent: 0, opened: 0, replied: 0, meetings: 0, leads: 0 }
  );

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Emails sent" value={totals.sent.toLocaleString()} delta="+12.4%" sub={`${totals.leads.toLocaleString()} leads in rotation`} color="#6366f1" spark={[38, 42, 40, 51, 48, 61, 66]} />
        <KpiTile label="Open rate" value={`${pct(totals.opened, totals.sent)}%`} delta="+3.1%" sub="Above 52% benchmark" color="#22d3ee" spark={[50, 54, 53, 58, 61, 60, 65]} />
        <KpiTile label="Reply rate" value={`${pct(totals.replied, totals.sent)}%`} delta="+0.8%" sub={`${totals.replied.toLocaleString()} total replies`} color="#34d399" spark={[6, 7, 6.5, 8, 8.4, 8.1, 9]} />
        <KpiTile label="Meetings booked" value={totals.meetings.toString()} delta="+22%" sub="From 646 positive replies" color="#a78bfa" spark={[4, 6, 5, 9, 11, 12, 15]} />
      </div>

      {/* chart + right column */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">Sending performance</h3>
              <p className="mt-0.5 text-xs text-slate-500">Deliverability-weighted volume across all connected inboxes</p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs tabs={["7d", "14d", "30d", "90d"]} active={range} onChange={setRange} />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4">
            {[
              { k: "sent", n: "Sent", c: "#6366f1" },
              { k: "opened", n: "Opened", c: "#22d3ee" },
              { k: "replied", n: "Replied", c: "#34d399" },
            ].map((l) => (
              <div key={l.k} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                <span className="text-[11px] text-slate-400">{l.n}</span>
                <span className="text-[11px] font-semibold text-white">
                  {data.reduce((a, d) => a + d[l.k as "sent"], 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <AreaChart
            data={data}
            series={[
              { key: "sent", color: "#6366f1", name: "Sent" },
              { key: "opened", color: "#22d3ee", name: "Opened" },
              { key: "replied", color: "#34d399", name: "Replied" },
            ]}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Sequence funnel" sub="Last 30 days" />
            <FunnelBars steps={funnel} />
          </Card>
          <Card>
            <div className="flex items-center gap-5">
              <Donut
                segments={[
                  { label: "Positive", value: 646, color: "#34d399" },
                  { label: "Neutral", value: 1511, color: "#64748b" },
                  { label: "Objection", value: 640, color: "#fbbf24" },
                  { label: "Unsub", value: 360, color: "#f43f5e" },
                ]}
                center={{ top: "3.2k", bottom: "replies" }}
              />
              <div className="flex-1 space-y-2.5">
                {[
                  ["Positive", "646", "#34d399"],
                  ["Neutral", "1,511", "#64748b"],
                  ["Objection", "640", "#fbbf24"],
                  ["Unsubscribe", "360", "#f43f5e"],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                      {l}
                    </span>
                    <span className="font-medium text-slate-200">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* campaigns table + activity */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card pad={false} className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-white">Campaign performance</h3>
              <p className="mt-0.5 text-xs text-slate-500">Click a row to open the sequence builder</p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs tabs={["All", "Active", "Paused", "Draft"]} active={tab} onChange={setTab} />
              <Button variant="default" size="sm" icon="download" className="hidden sm:inline-flex">Export</Button>
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
                  <th className="px-3 pb-2 font-medium">Open</th>
                  <th className="px-3 pb-2 font-medium">Reply</th>
                  <th className="px-3 pb-2 font-medium">Mtgs</th>
                  <th className="px-3 pb-2 font-medium">Bounce</th>
                  <th className="pb-2 pl-3 pr-5 text-right font-medium">Inbox</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <CampaignRow key={c.id} c={c} onOpen={() => onOpenCampaign(c.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Live activity" sub="Realtime feed" right={<Badge tone="emerald" dot>Live</Badge>} />
            <div className="relative space-y-4 pl-1">
              <div className="absolute bottom-2 left-[13px] top-2 w-px bg-ink-700" />
              {activity.map((a) => {
                const tone: Record<string, string> = {
                  emerald: "bg-emerald-500 text-ink-950",
                  violet: "bg-violet-500 text-ink-950",
                  sky: "bg-sky-500 text-ink-950",
                  rose: "bg-rose-500 text-ink-950",
                  amber: "bg-amber-500 text-ink-950",
                  brand: "bg-brand-500 text-white",
                };
                const icon: Record<string, string> = {
                  reply: "reply", meeting: "clock", open: "eye", bounce: "x", account: "at", lead: "upload",
                };
                return (
                  <div key={a.id} className="relative flex gap-3">
                    <span className={`z-10 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ring-2 ring-ink-900 ${tone[a.tone] ?? tone.brand}`}>
                      <Icon name={icon[a.type] ?? "zap"} className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[12px] leading-snug text-slate-300">{a.text}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{a.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle title="Hottest leads" sub="Highest engagement score" right={<Button size="sm" variant="ghost" icon="chevronRight">All</Button>} />
            <div className="space-y-1">
              {[...leads].sort((a, b) => b.score - a.score).slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl px-1.5 py-2 transition hover:bg-white/[0.04]">
                  <Avatar name={l.name} hue={l.avatarHue} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white">{l.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{l.title} · {l.company}</p>
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
