import { useState } from "react";
import { Card, SectionTitle, Badge, Button, Progress, Tabs, Icon, Avatar } from "../components/ui";
import { AreaChart, BarChart, Donut, FunnelBars, Heatmap, Sparkline } from "../components/Charts";
import { rangeSeries, funnel, heatmap, campaigns } from "../lib/data";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p", "12a", "2a", "4a"];

export function Analytics() {
  const [range, setRange] = useState("30d");
  const data = rangeSeries[range];

  const deliverability = [
    { label: "Inbox placement", value: 94, tone: "emerald", hint: "Google Postmaster · 92% inbox / 6% promotions" },
    { label: "Domain reputation", value: 88, tone: "sky", hint: "High · northwind.io + 2 aliases" },
    { label: "SPF / DKIM / DMARC", value: 100, tone: "brand", hint: "All records valid across 5 domains" },
    { label: "Spam complaint rate", value: 12, tone: "amber", hint: "0.04% — well under 0.1% threshold" },
    { label: "Bounce rate", value: 18, tone: "rose", hint: "1.1% average · auto-paused at 3%" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-white">Outbound analytics</h2>
          <p className="text-[12px] text-slate-500">Everything across campaigns, inboxes and sequences — updated 4 minutes ago</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" icon="download">Export report</Button>
          <Tabs tabs={["7d", "14d", "30d", "90d"]} active={range} onChange={setRange} />
        </div>
      </div>

      {/* headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Delivery rate", v: "98.9%", d: "+0.4%", s: [97, 98, 98.4, 98.2, 98.7, 98.9], c: "#34d399" },
          { l: "Avg. reply time", v: "3h 12m", d: "-38m", s: [5, 4.6, 4.2, 3.9, 3.4, 3.2], c: "#22d3ee" },
          { l: "Cost per meeting", v: "$41", d: "-9%", s: [62, 58, 54, 49, 45, 41], c: "#a78bfa" },
          { l: "Pipeline generated", v: "$486k", d: "+18%", s: [220, 268, 310, 372, 431, 486], c: "#fbbf24" },
        ].map((m) => (
          <Card key={m.l}>
            <div className="flex items-start justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{m.l}</p>
              <Badge tone={m.d.startsWith("+") ? "emerald" : "sky"}>{m.d}</Badge>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-[24px] font-semibold leading-none tracking-tight text-white">{m.v}</p>
              <Sparkline values={m.s} color={m.c} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Volume & engagement trend" sub="Hover the chart for per-period breakdown" right={<Badge tone="brand">{range}</Badge>} />
          <AreaChart
            data={data}
            height={250}
            series={[
              { key: "sent", color: "#6366f1", name: "Sent" },
              { key: "opened", color: "#22d3ee", name: "Opened" },
              { key: "replied", color: "#34d399", name: "Replied" },
            ]}
          />
        </Card>
        <Card>
          <SectionTitle title="Conversion funnel" sub="Whole account" />
          <FunnelBars steps={funnel} />
          <div className="mt-4 rounded-xl border border-ink-700 bg-ink-850/50 p-3">
            <p className="flex items-center gap-2 text-[11.5px] text-slate-400">
              <Icon name="target" className="h-3.5 w-3.5 text-violet-300" />
              Lead → meeting conversion: <b className="text-white">1.6%</b> (benchmark 1.1%)
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle title="Daily send volume" sub="Per weekday" />
          <BarChart data={DAYS.map((d, i) => ({ label: d, value: [620, 704, 688, 742, 611, 218, 186][i] }))} color="#6366f1" />
        </Card>
        <Card>
          <SectionTitle title="Send-time heatmap" sub="Reply likelihood by day & hour" />
          <Heatmap grid={heatmap} rows={DAYS} cols={HOURS} />
          <div className="mt-3 flex items-center justify-between text-[10.5px] text-slate-500">
            <span>Low</span>
            <div className="mx-2 h-2 flex-1 rounded-full" style={{ background: "linear-gradient(90deg, rgba(99,102,241,0.12), rgba(99,102,241,0.97))" }} />
            <span>High</span>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Reply breakdown" sub="Classified by AI" />
          <div className="flex items-center gap-5">
            <Donut
              size={132}
              segments={[
                { label: "Interested", value: 646, color: "#34d399" },
                { label: "Later", value: 742, color: "#fbbf24" },
                { label: "Not a fit", value: 1129, color: "#f43f5e" },
                { label: "OOO", value: 640, color: "#64748b" },
              ]}
              center={{ top: "3.2k", bottom: "replies" }}
            />
            <div className="flex-1 space-y-2 text-[12px]">
              {[["Interested", 646, "#34d399"], ["Later", 742, "#fbbf24"], ["Not a fit", 1129, "#f43f5e"], ["OOO", 640, "#64748b"]].map(([l, v, c]) => (
                <div key={l as string} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l}</span>
                  <span className="font-medium text-slate-200">{(v as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Deliverability health" sub="Signals from seed-list monitoring" right={<Badge tone="emerald" dot>Good</Badge>} />
          <div className="space-y-4">
            {deliverability.map((d) => (
              <div key={d.label}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-slate-300">{d.label}</span>
                  <span className="font-semibold text-white">{d.value}%</span>
                </div>
                <Progress value={d.value} tone={d.tone} />
                <p className="mt-1 text-[10.5px] text-slate-600">{d.hint}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card pad={false}>
          <div className="p-5 pb-3">
            <SectionTitle title="Campaign leaderboard" sub="Ranked by reply rate" />
          </div>
          <div className="space-y-1 px-2.5 pb-3">
            {[...campaigns]
              .filter((c) => c.sent > 0)
              .sort((a, b) => b.replied / b.sent - a.replied / a.sent)
              .map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/[0.04]">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${i === 0 ? "bg-amber-400/20 text-amber-300" : "bg-white/[0.06] text-slate-400"}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white">{c.name}</p>
                    <p className="text-[10.5px] text-slate-500">{c.sent.toLocaleString()} sent</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] font-semibold text-emerald-300">{((c.replied / c.sent) * 100).toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-600">reply</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Inbox-level performance" sub="Which mailboxes are carrying your volume" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                {["Mailbox", "Sent", "Open rate", "Reply rate", "Bounce", "Health"].map((h) => <th key={h} className="pb-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["alex@northwind.io", 5410, 68, 9.8, 0.7, 96],
                ["sdr2@northwind.io", 4980, 61, 8.4, 1.2, 91],
                ["maya@northwind.io", 4720, 57, 7.9, 1.4, 88],
                ["sdr@northwind.io", 3120, 52, 6.8, 1.9, 84],
                ["compliance@northwind.io", 1120, 39, 4.1, 2.6, 71],
              ].map((r) => (
                <tr key={r[0] as string} className="border-t border-ink-700/50">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={(r[0] as string).split("@")[0]} hue={(r[0] as string).charCodeAt(0) * 7} size={26} />
                      <span className="text-[12.5px] text-slate-200">{r[0]}</span>
                    </div>
                  </td>
                  <td className="text-[12.5px] tabular-nums text-slate-300">{(r[1] as number).toLocaleString()}</td>
                  <td className="text-[12.5px] tabular-nums text-sky-300">{r[2]}%</td>
                  <td className="text-[12.5px] tabular-nums text-emerald-300">{r[3]}%</td>
                  <td className="text-[12.5px] tabular-nums text-rose-300/80">{r[4]}%</td>
                  <td className="w-32 pr-4"><div className="flex items-center gap-2"><Progress value={r[5] as number} tone={(r[5] as number) > 85 ? "emerald" : "amber"} /><span className="text-[11px] text-slate-400">{r[5]}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
