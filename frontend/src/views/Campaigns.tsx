import { useState } from "react";
import { Card, Badge, Button, Progress, Avatar, Modal, Field, inputCls, Icon, Toggle, Tabs } from "../components/ui";
import { campaigns as seed } from "../lib/data";
import type { Campaign, CampaignStatus } from "../lib/data";

const tone: Record<CampaignStatus, string> = { active: "emerald", paused: "amber", draft: "slate", completed: "sky" };

function MiniStat({ label, value, tone: t }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-850/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${t}`}>{value}</p>
    </div>
  );
}

export function CampaignCard({ c, onOpen, view }: { c: Campaign; onOpen: () => void; view: "grid" | "list" }) {
  const p = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0");
  if (view === "list") {
    return (
      <div onClick={onOpen} className="group flex cursor-pointer items-center gap-4 border-b border-ink-700/60 px-5 py-3.5 transition hover:bg-white/[0.025]">
        <input type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-850 accent-brand-500" onClick={(e) => e.stopPropagation()} />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={c.name} hue={(c.name.charCodeAt(0) * 11) % 360} size={34} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white group-hover:text-brand-200">{c.name}</p>
            <p className="truncate text-[11px] text-slate-500">{c.sequence.length} steps · {c.tags.join(", ")}</p>
          </div>
        </div>
        <div className="hidden w-28 shrink-0 sm:block"><Badge tone={tone[c.status]} dot>{c.status}</Badge></div>
        <div className="hidden w-20 text-right text-[13px] tabular-nums text-slate-300 md:block">{c.sent.toLocaleString()}</div>
        <div className="hidden w-20 text-right text-[13px] tabular-nums text-emerald-300 md:block">{p(c.replied, c.sent)}%</div>
        <div className="w-24 shrink-0"><Progress value={c.progress} tone={c.status === "paused" ? "amber" : "brand"} /></div>
        <button className="rounded-md p-1.5 text-slate-600 hover:bg-white/5 hover:text-white"><Icon name="more" /></button>
      </div>
    );
  }
  return (
    <Card className="group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-xl hover:shadow-black/40">
      <div onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={c.name} hue={(c.name.charCodeAt(0) * 11) % 360} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-tight text-white group-hover:text-brand-200">{c.name}</p>
              <p className="text-[11px] text-slate-500">{c.owner} · {c.createdAt}</p>
            </div>
          </div>
          <Badge tone={tone[c.status]} dot>{c.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Sent" value={c.sent.toLocaleString()} tone="text-white" />
          <MiniStat label="Reply rate" value={`${p(c.replied, c.sent)}%`} tone="text-emerald-300" />
          <MiniStat label="Open rate" value={`${p(c.opened, c.sent)}%`} tone="text-sky-300" />
          <MiniStat label="Meetings" value={c.meetings.toString()} tone="text-violet-300" />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{c.leads.toLocaleString()} leads · {c.progress}% through sequence</span>
            <span className="text-slate-400">{c.dailyLimit}/day</span>
          </div>
          <Progress value={c.progress} tone={c.status === "paused" ? "amber" : c.status === "draft" ? "sky" : "brand"} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-ink-700/60 pt-3.5">
          <div className="flex -space-x-1.5">
            {(c.accounts.length ? c.accounts : ["unassigned"]).slice(0, 4).map((a) => (
              <Avatar key={a} name={a.split("@")[0]} hue={(a.charCodeAt(0) * 7) % 360} size={24} ring />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="copy" /></button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="pause" /></button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="more" /></button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function Campaigns({ onOpenCampaign, toast }: { onOpenCampaign: (id: string) => void; toast: (m: string, t?: string) => void }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [list, setList] = useState(seed);
  const [form, setForm] = useState({ name: "", accounts: "alex@northwind.io", daily: "450", stop: "on reply", personalize: true, ai: true });

  const shown = list.filter(
    (c) =>
      (filter === "All" || c.status === filter.toLowerCase()) &&
      c.name.toLowerCase().includes(query.toLowerCase())
  );

  const create = () => {
    const id = `cmp_${Math.random().toString(36).slice(2, 7)}`;
    setList([
      {
        id,
        name: form.name || "Untitled campaign",
        status: "draft",
        leads: 0, sent: 0, opened: 0, replied: 0, positive: 0, bounced: 0, unsubscribed: 0, meetings: 0,
        dailyLimit: Number(form.daily) || 100,
        accounts: form.accounts ? [form.accounts] : [],
        createdAt: "Just now",
        owner: "Alex Rivera",
        tags: ["new"],
        progress: 0,
        sequence: [{ id: "n1", type: "email", title: "Step 1 — Email", dayOffset: 0, subject: "", body: "", enabled: true }],
      },
      ...list,
    ]);
    setCreateOpen(false);
    setStep(0);
    setForm({ name: "", accounts: "alex@northwind.io", daily: "450", stop: "on reply", personalize: true, ai: true });
    toast("Campaign created as draft", "emerald");
    setFilter("All");
    setQuery("");
  };

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns…"
            className="h-9 w-56 rounded-lg border border-ink-700 bg-ink-900/70 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <Tabs tabs={["All", "Active", "Paused", "Draft", "Completed"]} active={filter} onChange={setFilter} />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/70 p-1">
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`grid h-7 w-7 place-items-center rounded-md transition ${view === v ? "bg-white/[0.09] text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <Icon name={v === "grid" ? "layout" : "folder"} className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button variant="default" icon="upload">Import leads</Button>
          <Button variant="primary" icon="plus" onClick={() => { setCreateOpen(true); setStep(0); }}>New campaign</Button>
        </div>
      </div>

      {/* summary strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Active campaigns", v: list.filter((c) => c.status === "active").length.toString(), s: "of 5 total", i: "send", c: "text-brand-300 bg-brand-500/10" },
          { l: "Emails in queue", v: "1,284", s: "next send window 9:00 AM", i: "clock", c: "text-sky-300 bg-sky-500/10" },
          { l: "Leads engaged", v: "1,842", s: "+184 this week", i: "zap", c: "text-emerald-300 bg-emerald-500/10" },
          { l: "Needs attention", v: "3", s: "auth error, high bounce", i: "shield", c: "text-amber-300 bg-amber-500/10" },
        ].map((k) => (
          <Card key={k.l} className="flex items-center gap-3.5">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${k.c}`}><Icon name={k.i} className="h-4 w-4" /></span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{k.l}</p>
              <p className="text-lg font-semibold leading-tight tracking-tight text-white">{k.v}</p>
              <p className="text-[11px] text-slate-500">{k.s}</p>
            </div>
          </Card>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="grid place-items-center py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-slate-500"><Icon name="send" className="h-6 w-6" /></div>
          <p className="mt-4 text-sm font-medium text-white">No campaigns match “{query}”</p>
          <p className="mt-1 text-xs text-slate-500">Try a different search or create a new campaign.</p>
          <Button variant="primary" icon="plus" className="mt-4" onClick={() => setCreateOpen(true)}>New campaign</Button>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => <CampaignCard key={c.id} c={c} onOpen={() => onOpenCampaign(c.id)} view="grid" />)}
        </div>
      ) : (
        <Card pad={false}>
          <div className="flex items-center gap-4 px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500">
            <span className="w-4" />
            <span className="flex-1">Campaign</span>
            <span className="hidden w-28 sm:block">Status</span>
            <span className="hidden w-20 text-right md:block">Sent</span>
            <span className="hidden w-20 text-right md:block">Reply</span>
            <span className="w-24">Progress</span>
            <span className="w-6" />
          </div>
          {shown.map((c) => <CampaignCard key={c.id} c={c} onOpen={() => onOpenCampaign(c.id)} view="list" />)}
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New campaign"
        width="max-w-2xl"
        footer={
          <>
            {step === 1 && <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>}
            <Button variant="default" onClick={() => setCreateOpen(false)}>Cancel</Button>
            {step === 0 ? (
              <Button variant="primary" icon="chevronRight" onClick={() => setStep(1)}>Continue</Button>
            ) : (
              <Button variant="primary" icon="check" onClick={create}>Create campaign</Button>
            )}
          </>
        }
      >
        <div className="mb-5 flex items-center gap-2">
          {["Basics", "Sending"].map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${i <= step ? "bg-brand-500 text-white" : "bg-white/[0.06] text-slate-500"}`}>
                {i + 1}
              </span>
              <span className={`text-[12px] ${i <= step ? "text-white" : "text-slate-500"}`}>{s}</span>
              {i === 0 && <div className="h-px flex-1 bg-ink-700" />}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-4">
            <Field label="Campaign name">
              <input className={inputCls} placeholder="e.g. Fintech CTOs — Q2 outbound" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Lead list" hint="Upload a CSV or pull from a saved segment.">
              <div className="flex items-center gap-2">
                <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 bg-ink-900/50 px-3 py-6 text-[12px] text-slate-500 transition hover:border-brand-500/50 hover:text-slate-300">
                  <Icon name="upload" className="h-4 w-4" /> Drop CSV here or browse
                </button>
                <button className="rounded-lg border border-ink-600 px-3 text-[12px] text-slate-300 hover:bg-white/5">Use segment</button>
              </div>
            </Field>
            <Field label="Campaign goal">
              <div className="grid grid-cols-3 gap-2">
                {["Book meetings", "Generate replies", "Drive traffic"].map((g, i) => (
                  <button key={g} className={`rounded-lg border px-3 py-2.5 text-[12px] transition ${i === 0 ? "border-brand-500/60 bg-brand-500/10 text-brand-200" : "border-ink-600 text-slate-400 hover:bg-white/5"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Sending accounts">
              <select className={inputCls} value={form.accounts} onChange={(e) => setForm({ ...form, accounts: e.target.value })}>
                {["alex@northwind.io", "sdr2@northwind.io", "maya@northwind.io", "leo@northwind.io"].map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily limit per account">
                <input className={inputCls} value={form.daily} onChange={(e) => setForm({ ...form, daily: e.target.value })} />
              </Field>
              <Field label="Stop sending">
                <select className={inputCls} value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })}>
                  <option>on reply</option>
                  <option>on positive reply</option>
                  <option>never</option>
                </select>
              </Field>
            </div>
            {[
              ["Personalize with lead variables", "Auto-insert {{first_name}}, {{company}} etc.", "personalize"],
              ["AI optimize send times", "Per-lead mailbox-level send windows", "ai"],
            ].map(([l, h, k]) => (
              <div key={k} className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/50 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-200">{l}</p>
                  <p className="text-[11px] text-slate-500">{h}</p>
                </div>
                <Toggle on={form[k as "personalize"]} onChange={(v) => setForm({ ...form, [k]: v })} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
