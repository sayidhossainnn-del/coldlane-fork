import { useState } from "react";
import { Card, SectionTitle, Badge, Button, Icon, Toggle, Field, inputCls, Avatar, Progress, Divider, Ring } from "../components/ui";
import { senders } from "../lib/data";

const SECTIONS: { label: string; icon: string }[] = [
  { label: "Profile", icon: "users" },
  { label: "Team", icon: "layout" },
  { label: "Deliverability", icon: "shield" },
  { label: "Notifications", icon: "bell" },
  { label: "Integrations", icon: "link" },
  { label: "Billing", icon: "wallet" },
  { label: "API", icon: "code" },
];

export function Settings({ toast }: { toast: (m: string, t?: string) => void }) {
  const [tab, setTab] = useState("Profile");
  const [notif, setNotif] = useState<Record<string, boolean>>({
    replies: true, positive: true, bounces: true, daily: false, weekly: true, mentions: true,
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)]">
      <Card pad={false} className="h-fit p-2.5">
        {SECTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => setTab(s.label)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] transition ${
              tab === s.label ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
            }`}
          >
            <Icon name={s.icon} className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </Card>

      <div className="space-y-4">
        {tab === "Profile" && (
          <>
            <Card>
              <SectionTitle title="Your profile" sub="Used across campaigns and shared inboxes" />
              <div className="mb-5 flex flex-wrap items-center gap-4">
                <Avatar name="Alex Rivera" hue={255} size={64} />
                <div>
                  <p className="text-[15px] font-semibold text-white">Alex Rivera</p>
                  <p className="text-[12px] text-slate-500">Growth Lead · Northwind</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="default" icon="upload">Upload photo</Button>
                    <Button size="sm" variant="ghost" icon="trash">Remove</Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="First name"><input className={inputCls} defaultValue="Alex" /></Field>
                <Field label="Last name"><input className={inputCls} defaultValue="Rivera" /></Field>
                <Field label="Email"><input className={inputCls} defaultValue="alex@northwind.io" /></Field>
                <Field label="Role"><select className={inputCls}><option>Growth Lead</option><option>Founder</option><option>SDR</option></select></Field>
                <Field label="Timezone"><select className={inputCls}><option>America/Chicago (CST)</option><option>America/New_York</option><option>Europe/Berlin</option></select></Field>
                <Field label="Signature"><input className={inputCls} defaultValue="— Alex | Northwind" /></Field>
              </div>
              <div className="mt-4 flex justify-end"><Button variant="primary" icon="check" onClick={() => toast("Profile updated", "emerald")}>Save profile</Button></div>
            </Card>

            <Card>
              <SectionTitle title="Workspace" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Workspace name"><input className={inputCls} defaultValue="Northwind Outbound" /></Field>
                <Field label="Workspace URL"><input className={inputCls} defaultValue="northwind.getlemlist.io" /></Field>
              </div>
              <Divider className="my-4" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-200">Danger zone</p>
                  <p className="text-[11.5px] text-slate-500">Deleting the workspace removes all campaigns, leads and analytics.</p>
                </div>
                <Button variant="danger" icon="trash" onClick={() => toast("Deletion requires 2 owner confirmations", "rose")}>Delete workspace</Button>
              </div>
            </Card>
          </>
        )}

        {tab === "Team" && (
          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h3 className="text-[15px] font-semibold text-white">Team members</h3>
                <p className="mt-0.5 text-xs text-slate-500">3 of 10 seats used on the Pro plan</p>
              </div>
              <Button variant="primary" icon="plus" onClick={() => toast("Invitation sent", "emerald")}>Invite member</Button>
            </div>
            <div className="divide-y divide-ink-700/60">
              {senders.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={s.name} hue={s.hue} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{s.name}</p>
                    <p className="truncate text-[11.5px] text-slate-500">{s.email}</p>
                  </div>
                  <Badge tone={i === 0 ? "brand" : "slate"}>{i === 0 ? "Owner" : i === 1 ? "Admin" : "Member"}</Badge>
                  <Badge tone={s.online ? "emerald" : "slate"} dot>{s.online ? "online" : "away"}</Badge>
                  <div className="hidden w-28 md:block"><Progress value={[92, 74, 51][i]} tone="brand" /></div>
                  <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="more" /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-ink-700/60 p-5">
              <Field label="Invite by email"><input className={inputCls} placeholder="teammate@northwind.io" /></Field>
            </div>
          </Card>
        )}

        {tab === "Deliverability" && (
          <>
            <Card>
              <SectionTitle title="Deliverability engine" sub="Global rules applied before every send" right={<Badge tone="emerald" dot>Healthy</Badge>} />
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {[["Spintax on every campaign", true], ["Randomise send intervals", true], ["Auto-pause above 3% bounce", true], ["Throttle on reputation drop", true], ["Remove auto-replies from sequence", true], ["Plain-text only (no HTML)", false], ["Link tracking (wrapped URLs)", true], ["Open tracking pixel", true]].map(([l, v]) => (
                    <div key={l as string} className="flex items-center justify-between rounded-lg border border-ink-700/70 px-3 py-2.5">
                      <span className="text-[12.5px] text-slate-300">{l}</span>
                      <Toggle on={v as boolean} />
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-850/50 p-4">
                    <Ring value={94} size={64} stroke={6} tone="#34d399" label="94%" />
                    <div>
                      <p className="text-[13px] font-semibold text-white">Inbox placement</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">Measured with 40 seed accounts across Gmail, Outlook and Yahoo every 6 hours.</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-ink-700 bg-ink-850/50 p-4">
                    <p className="mb-3 text-[10.5px] uppercase tracking-wider text-slate-500">Weekly placement trend</p>
                    <div className="flex h-16 items-end gap-1.5">
                      {[82, 85, 84, 88, 90, 91, 93, 92, 94, 94].map((v, i) => (
                        <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-emerald-600/40 to-emerald-400" style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>
                  <Button variant="default" icon="download" className="w-full">Download DNS setup guide (PDF)</Button>
                </div>
              </div>
            </Card>
            <Card>
              <SectionTitle title="Custom tracking domain" />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Tracking domain" hint="Add a CNAME record pointing to track.northwind.io"><input className={inputCls} defaultValue="t.northwind.io" /></Field>
                <Button variant="default" icon="refresh" onClick={() => toast("DNS re-checked · CNAME valid", "emerald")}>Verify DNS</Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[["CNAME", "Valid"], ["SSL certificate", "Issued"], ["Redirect", "200 OK"]].map(([k, v]) => (
                  <Badge key={k} tone="emerald" dot>{k}: {v}</Badge>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === "Notifications" && (
          <Card>
            <SectionTitle title="Notifications" sub="Choose what lands in your inbox" />
            <div className="space-y-3">
              {[
                ["replies", "Every reply", "Instant email when a lead replies"],
                ["positive", "Positive replies only", "Only when AI detects buying intent"],
                ["bounces", "Bounce alerts", "When an inbox crosses the bounce threshold"],
                ["daily", "Daily digest", "Summary at 8:00 AM in your timezone"],
                ["weekly", "Weekly report", "Monday morning performance recap"],
                ["mentions", "Team mentions", "When a teammate mentions you in notes"],
              ].map(([k, l, h]) => (
                <div key={k} className="flex items-center justify-between gap-4 rounded-xl border border-ink-700/70 bg-ink-850/40 px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-slate-200">{l}</p>
                    <p className="text-[11.5px] text-slate-500">{h}</p>
                  </div>
                  <Toggle on={notif[k]} onChange={(v) => setNotif({ ...notif, [k]: v })} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === "Integrations" && (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["HubSpot", "Two-way lead sync", "link", true, "#ff7a59"],
              ["Salesforce", "Push meetings & status", "globe", false, "#00a1e0"],
              ["Slack", "Reply alerts to #sales", "inbox", true, "#611f69"],
              ["Zapier", "5,000+ automations", "zap", false, "#ff4a00"],
              ["Clay", "Waterfall enrichment", "target", true, "#f97316"],
              ["Calendly", "Meeting attribution", "clock", true, "#006bff"],
              ["Webhooks", "Custom events", "code", false, "#a78bfa"],
              ["Google Sheets", "Export campaigns", "template", true, "#0f9d58"],
            ].map(([n, d, i, on, c]) => (
              <Card key={n as string} className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: c as string }}>
                  <Icon name={i as string} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-white">{n}</p>
                  <p className="truncate text-[11.5px] text-slate-500">{d}</p>
                </div>
                <Toggle on={on as boolean} />
              </Card>
            ))}
          </div>
        )}

        {tab === "Billing" && (
          <>
            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand-500/15 blur-3xl" />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge tone="brand">Current plan</Badge>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Pro · $97/mo</h3>
                  <p className="mt-1 text-[12.5px] text-slate-500">Billed annually · renews Jan 14, 2027</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="default">Change plan</Button>
                  <Button variant="primary" icon="star">Upgrade to Enterprise</Button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 border-t border-ink-700/60 pt-4 sm:grid-cols-4">
                {[["Seats", "3 / 10"], ["Email accounts", "7 / 25"], ["Leads", "9,840 / 25,000"], ["Email credits", "48,120 / 100,000"]].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[10.5px] uppercase tracking-wider text-slate-500">{l}</p>
                    <p className="mt-0.5 text-[15px] font-semibold text-white">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4"><Progress value={48} tone="brand" /></div>
            </Card>
            <Card pad={false}>
              <div className="p-5 pb-3"><SectionTitle title="Invoices" /></div>
              {[["Feb 01, 2026", "$97.00", "Paid"], ["Jan 01, 2026", "$97.00", "Paid"], ["Dec 01, 2025", "$97.00", "Paid"], ["Nov 01, 2025", "$291.00", "Paid"]].map(([d, a, s]) => (
                <div key={d} className="flex items-center gap-4 border-t border-ink-700/60 px-5 py-3">
                  <Icon name="wallet" className="h-4 w-4 text-slate-500" />
                  <span className="flex-1 text-[12.5px] text-slate-300">{d}</span>
                  <span className="text-[12.5px] tabular-nums text-slate-200">{a}</span>
                  <Badge tone="emerald">{s}</Badge>
                  <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="download" className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </Card>
          </>
        )}

        {tab === "API" && (
          <>
            <Card>
              <SectionTitle title="API keys" sub="Programmatic access to campaigns, leads and events" right={<Badge tone="violet">v2</Badge>} />
              <div className="space-y-2.5">
                {[["Production key", "nw_live_9f2c…a71b", "Created 3 months ago"], ["Test key", "nw_test_4ad1…02ce", "Created 3 months ago"]].map(([n, k, m]) => (
                  <div key={n} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-850/50 px-4 py-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500/12 text-brand-300"><Icon name="code" className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-white">{n}</p>
                      <p className="truncate font-mono text-[11px] text-slate-500">{k}</p>
                    </div>
                    <span className="text-[11px] text-slate-600">{m}</span>
                    <Button size="sm" variant="default" icon="copy" onClick={() => toast("API key copied to clipboard", "brand")}>Copy</Button>
                    <Button size="sm" variant="ghost" icon="refresh" onClick={() => toast("Key rotated · old key valid for 24h", "amber")}>Rotate</Button>
                  </div>
                ))}
              </div>
              <Button variant="primary" icon="plus" className="mt-3">Create new key</Button>
            </Card>
            <Card>
              <SectionTitle title="Example request" />
              <pre className="overflow-x-auto rounded-xl border border-ink-700 bg-ink-950/80 p-4 font-mono text-[11.5px] leading-relaxed text-slate-400">
{`curl -X POST https://api.northwind.io/v2/campaigns \\
  -H "Authorization: Bearer nw_live_9f2c…a71b" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Fintech CTOs — Q2",
    "daily_limit": 450,
    "sequence": [
      { "type": "email", "subject": "Hi {{first_name}}", "offset_days": 0 },
      { "type": "wait", "wait_days": 3 },
      { "type": "email", "subject": "Following up", "offset_days": 3 }
    ]
  }'`}
              </pre>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
