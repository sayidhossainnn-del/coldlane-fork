import { useState } from "react";
import { Card, SectionTitle, Badge, Button, Progress, Icon, Modal, Field, inputCls, Toggle, Ring, Avatar } from "../components/ui";
import { mailboxes } from "../lib/data";

const statusTone: Record<string, string> = { healthy: "emerald", warming: "amber", paused: "slate", error: "rose" };
const statusLabel: Record<string, string> = { healthy: "Sending", warming: "Warming up", paused: "Paused", error: "Action needed" };

export function Accounts({ toast }: { toast: (m: string, t?: string) => void }) {
  const [boxes, setBoxes] = useState(mailboxes);
  const [connectOpen, setConnectOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(mailboxes[0].id);

  const totalSent = boxes.reduce((a, b) => a + b.sentToday, 0);
  const totalLimit = boxes.reduce((a, b) => a + b.dailyLimit, 0);
  const avgHealth = Math.round(boxes.reduce((a, b) => a + b.health, 0) / boxes.length);

  const toggle = (id: string) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, status: b.status === "paused" ? "healthy" : "paused" } : b)));
    toast("Mailbox status updated", "brand");
  };

  return (
    <div className="space-y-5">
      {/* summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Connected inboxes", v: boxes.length.toString(), s: `${boxes.filter((b) => b.status === "healthy").length} sending now`, i: "at", c: "text-brand-300 bg-brand-500/10" },
          { l: "Sent today", v: `${totalSent}/${totalLimit}`, s: `${Math.round((totalSent / totalLimit) * 100)}% of daily cap`, i: "send", c: "text-sky-300 bg-sky-500/10" },
          { l: "Avg. health score", v: `${avgHealth}`, s: "Seed-list verified hourly", i: "shield", c: "text-emerald-300 bg-emerald-500/10" },
          { l: "Needs attention", v: boxes.filter((b) => b.status === "error").length.toString(), s: "Reconnect required", i: "bell", c: "text-rose-300 bg-rose-500/10" },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-3.5">
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${k.c}`}><Icon name={k.i} className="h-5 w-5" /></span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{k.l}</p>
              <p className="text-xl font-semibold leading-tight tracking-tight text-white">{k.v}</p>
              <p className="text-[11px] text-slate-500">{k.s}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-white">Sending accounts</h3>
            <p className="mt-0.5 text-xs text-slate-500">Rotating volume across inboxes protects your domain reputation</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" icon="refresh" onClick={() => toast("Warmup emails re-synced", "sky")}>Sync all</Button>
            <Button variant="primary" icon="plus" onClick={() => setConnectOpen(true)}>Connect account</Button>
          </div>
        </div>

        <div className="space-y-2.5">
          {boxes.map((b) => (
            <div key={b.id} className={`rounded-xl border transition ${expanded === b.id ? "border-brand-500/40 bg-brand-500/[0.04]" : "border-ink-700/70 bg-ink-850/40 hover:border-ink-600"}`}>
              <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="flex w-full items-center gap-4 p-4 text-left">
                <Avatar name={b.email.split("@")[0]} hue={(b.email.charCodeAt(1) * 11) % 360} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-medium text-white">{b.email}</p>
                    <Badge tone={statusTone[b.status]} dot>{statusLabel[b.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{b.provider} · {b.campaigns} campaigns · warmup day {b.warmupDays}</p>
                </div>

                <div className="hidden w-40 shrink-0 md:block">
                  <div className="mb-1 flex justify-between text-[10.5px]"><span className="text-slate-500">Today</span><span className="text-slate-300">{b.sentToday}/{b.dailyLimit}</span></div>
                  <Progress value={(b.sentToday / b.dailyLimit) * 100} tone={b.sentToday / b.dailyLimit > 0.85 ? "amber" : "brand"} />
                </div>
                <div className="hidden shrink-0 items-center gap-3 lg:flex">
                  <Ring value={b.health} size={44} tone={b.health > 85 ? "#34d399" : b.health > 60 ? "#fbbf24" : "#f43f5e"} />
                  <div className="text-[10.5px] leading-tight">
                    <p className="text-slate-500">Open rate</p>
                    <p className="font-semibold text-slate-200">{b.openedRate}%</p>
                  </div>
                </div>
                <div onClick={(e) => { e.stopPropagation(); toggle(b.id); }}>
                  <Toggle on={b.status === "healthy" || b.status === "warming"} />
                </div>
                <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-600 transition ${expanded === b.id ? "rotate-180" : ""}`} />
              </button>

              {expanded === b.id && (
                <div className="animate-fade-in border-t border-ink-700/70 p-4">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div className="space-y-3 lg:col-span-3">
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {[
                          ["SMTP / IMAP", "Connected", "emerald"],
                          ["SPF record", "Valid", "emerald"],
                          ["DKIM", "Valid", "emerald"],
                          ["DMARC policy", "p=quarantine", "sky"],
                          ["Custom tracking domain", "t.northwind.io", "brand"],
                          ["Warmup pool", "Enabled", "emerald"],
                        ].map(([k, v, t]) => (
                          <div key={k} className="rounded-lg border border-ink-700/70 bg-ink-900/50 px-3 py-2.5">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-200">
                              <Icon name={t === "emerald" ? "check" : "link"} className={`h-3.5 w-3.5 ${t === "emerald" ? "text-emerald-400" : "text-brand-300"}`} />
                              {v}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
                        <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Warmup ramp (last 14 days)</p>
                        <div className="flex h-14 items-end gap-1">
                          {Array.from({ length: 14 }, (_, i) => Math.round(6 + i * (b.dailyLimit / 220))).map((v, i) => (
                            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-600/40 to-brand-400 transition-all hover:opacity-70" style={{ height: `${(v / (b.dailyLimit / 4)) * 100}%` }} title={`${v} warmup emails`} />
                          ))}
                        </div>
                        <p className="mt-2 text-[10.5px] text-slate-600">Warmup increases ~2 emails/day. Full deliverability typically reached by day 21.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button variant="default" icon="settings" size="sm" className="w-full justify-start">Account settings</Button>
                      <Button variant="default" icon="clock" size="sm" className="w-full justify-start">Sending window</Button>
                      <Button variant="default" icon="refresh" size="sm" className="w-full justify-start" onClick={() => toast("Re-authentication email sent", "brand")}>Re-authenticate</Button>
                      <Button variant="danger" icon="trash" size="sm" className="w-full justify-start" onClick={() => { setBoxes((p) => p.filter((x) => x.id !== b.id)); toast("Mailbox disconnected", "rose"); }}>Disconnect</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Domain setup checklist" sub="Finish these to maximise inbox placement" />
          <div className="space-y-2.5">
            {[
              ["Buy 2–3 secondary sending domains", true],
              ["Add SPF, DKIM and DMARC records", true],
              ["Set up custom tracking domain", true],
              ["Enable warmup on all inboxes", true],
              ["Warm up for 14+ days before scaling", false],
              ["Create inbox redirection rule", false],
            ].map(([l, done]) => (
              <div key={l as string} className="flex items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-850/40 px-3 py-2.5">
                <span className={`grid h-5 w-5 place-items-center rounded-full ${done ? "bg-emerald-500 text-ink-950" : "border border-ink-600"}`}>
                  {done ? <Icon name="check" className="h-3 w-3" /> : null}
                </span>
                <span className={`flex-1 text-[12.5px] ${done ? "text-slate-400 line-through decoration-slate-700" : "text-slate-200"}`}>{l}</span>
                {!done && <Badge tone="amber">todo</Badge>}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[11.5px]"><span className="text-slate-400">Setup progress</span><span className="text-white">4 of 6</span></div>
            <Progress value={67} tone="emerald" />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Warmup settings" sub="Applied to all connected inboxes" />
          <div className="space-y-3">
            {[["Warmup enabled", true], ["Warm inside existing threads", true], ["Save warmup emails to label", true], ["Hide warmup from analytics", true], ["Slow ramp on new inboxes", true], ["Auto-pause warmup on weekend", false]].map(([l, v]) => (
              <div key={l as string} className="flex items-center justify-between rounded-lg border border-ink-700/70 px-3 py-2.5">
                <span className="text-[12.5px] text-slate-300">{l}</span>
                <Toggle on={v as boolean} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Warmup emails / day"><input className={inputCls} defaultValue="18" /></Field>
              <Field label="Max ramp"><input className={inputCls} defaultValue="40" /></Field>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect an email account"
        footer={
          <>
            <Button variant="default" onClick={() => setConnectOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="link" onClick={() => { setConnectOpen(false); toast("Account connected · warmup started", "emerald"); }}>Connect</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            {[["Google Workspace", "Recommended", "globe"], ["Microsoft 365", "OAuth", "mail"], ["IMAP / SMTP", "Advanced", "code"], ["Bulk upload", "10+ inboxes", "upload"]].map(([n, s, i]) => (
              <button key={n} className="flex flex-col items-start gap-1.5 rounded-xl border border-ink-600 bg-ink-900/60 p-3.5 text-left transition hover:border-brand-500/50 hover:bg-brand-500/[0.06]">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-slate-300"><Icon name={i} className="h-4 w-4" /></span>
                <p className="text-[12.5px] font-medium text-white">{n}</p>
                <p className="text-[10.5px] text-slate-500">{s}</p>
              </button>
            ))}
          </div>
          <Field label="Email address"><input className={inputCls} placeholder="you@yourdomain.com" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP host"><input className={inputCls} placeholder="smtp.gmail.com" /></Field>
            <Field label="Port"><input className={inputCls} placeholder="587" /></Field>
          </div>
          <Field label="App password"><input className={inputCls} type="password" placeholder="••••••••••••" /></Field>
          <div className="rounded-lg bg-brand-500/[0.07] p-3 text-[11.5px] text-brand-100 ring-1 ring-inset ring-brand-500/20">
            <b>Tip:</b> Start warmup immediately after connecting and wait 14 days before sending campaigns from this inbox.
          </div>
        </div>
      </Modal>
    </div>
  );
}
