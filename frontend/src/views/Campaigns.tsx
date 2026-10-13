import { useCallback, useEffect, useState } from "react";
import { Card, Badge, Button, Progress, Avatar, Modal, Field, inputCls, Icon, Tabs } from "../components/ui";
import * as api from "../lib/api";
import type { RawCampaign } from "../lib/api";
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={c.name} hue={(c.name.charCodeAt(0) * 11) % 360} size={34} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white group-hover:text-brand-200">{c.name}</p>
            {/* Steps/tags are not part of the list API: show the real lead count instead. */}
            <p className="truncate text-[11px] text-slate-500">{c.leads.toLocaleString()} leads</p>
          </div>
        </div>
        <div className="hidden w-28 shrink-0 sm:block"><Badge tone={tone[c.status]} dot>{c.status}</Badge></div>
        <div className="hidden w-20 text-right text-[13px] tabular-nums text-slate-300 md:block">{c.sent.toLocaleString()}</div>
        <div className="hidden w-20 text-right text-[13px] tabular-nums text-emerald-300 md:block">{p(c.replied, c.sent)}%</div>
        <div className="w-24 shrink-0"><Progress value={c.progress} tone={c.status === "paused" ? "amber" : "brand"} /></div>
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
              {/* No owner column exists in the API: show only the real creation date. */}
              <p className="text-[11px] text-slate-500">{c.createdAt}</p>
            </div>
          </div>
          <Badge tone={tone[c.status]} dot>{c.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat label="Sent" value={c.sent.toLocaleString()} tone="text-white" />
          <MiniStat label="Reply rate" value={`${p(c.replied, c.sent)}%`} tone="text-emerald-300" />
          {/* No open tracking exists in the API: the "Open rate" stat is hidden. */}
          <MiniStat label="Meetings" value={c.meetings.toString()} tone="text-violet-300" />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{c.leads.toLocaleString()} leads · {c.progress}% through sequence</span>
            {/* No campaign-level daily limit exists: hidden. */}
          </div>
          <Progress value={c.progress} tone={c.status === "paused" ? "amber" : c.status === "draft" ? "sky" : "brand"} />
        </div>

        {/* Assigned mailboxes are only returned by the detail API, and copy/pause/more have no
            wiring here: the footer row is hidden. */}
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
  const [list, setList] = useState<Campaign[]>([]);
  const [raw, setRaw] = useState<RawCampaign[]>([]);
  const [accounts, setAccounts] = useState<api.RawMailboxFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", accounts: "", daily: "" });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api.http
      .get<{ campaigns: RawCampaign[] }>("/campaigns")
      .then((res) => {
        setRaw(res.campaigns);
        setList(res.campaigns.map(api.toCampaign));
      })
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.listMailboxRows().then(setAccounts).catch(() => undefined);
  }, [load]);

  const activeCount = raw.filter((c) => c.status === "active").length;
  const queued = raw.reduce((a, c) => a + (c.stats?.queued ?? 0), 0);
  const autoPaused = raw.filter((c) => (c.paused_reason ?? "").startsWith("Auto-paused")).length;

  const shown = list.filter(
    (c) =>
      (filter === "All" || c.status === filter.toLowerCase()) &&
      c.name.toLowerCase().includes(query.toLowerCase())
  );

  const create = () => {
    if (creating) return;
    setCreating(true);
    const selected = accounts.find((a) => a.from_email === form.accounts);
    const daily = Number(form.daily);
    api
      .createCampaign({
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
        // The API requires at least one send day: use the product default (weekdays).
        days: [0, 1, 2, 3, 4],
        ...(selected ? { mailbox_ids: [selected.id] } : {}),
      })
      .then((res) => {
        const id = String(res.campaign.id);
        setCreateOpen(false);
        setStep(0);
        setForm({ name: "", accounts: "", daily: "" });
        toast("Campaign created as draft", "emerald");
        // Optional: apply the per-account daily limit chosen in the wizard.
        if (selected && form.daily.trim() && daily >= 1) {
          api.updateMailbox(String(selected.id), { daily_cap: daily }).catch((err) => toast(api.errorMessage(err), "rose"));
        }
        onOpenCampaign(id);
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setCreating(false));
  };

  const summary = [
    { l: "Active campaigns", v: activeCount.toString(), s: `of ${raw.length} total`, i: "send", c: "text-brand-300 bg-brand-500/10" },
    { l: "Emails in queue", v: queued.toLocaleString(), s: "waiting for their send window", i: "clock", c: "text-sky-300 bg-sky-500/10" },
    // "Leads engaged" has no API definition — hidden.
    { l: "Needs attention", v: autoPaused.toString(), s: "auto-paused campaigns", i: "shield", c: "text-amber-300 bg-amber-500/10" },
  ];

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
          {/* Toolbar "Import leads": imports belong to a campaign — hidden here (see Campaign detail). */}
          <Button variant="primary" icon="plus" onClick={() => { setCreateOpen(true); setStep(0); }}>New campaign</Button>
        </div>
      </div>

      {loading && (
        <Card className="grid place-items-center py-16">
          <p className="text-[12px] text-slate-500">Loading campaigns…</p>
        </Card>
      )}
      {loadError && (
        <Card className="grid place-items-center py-16 text-center">
          <p className="text-[12px] text-slate-400">{loadError}</p>
          <button onClick={load} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
        </Card>
      )}

      {!loading && !loadError && (
        <>
          {/* summary strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((k) => (
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
              <p className="mt-4 text-sm font-medium text-white">
                {list.length === 0 ? "No campaigns yet" : `No campaigns match “${query}”`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {list.length === 0 ? "Create your first campaign to start a sequence." : "Try a different search or create a new campaign."}
              </p>
              <Button variant="primary" icon="plus" className="mt-4" onClick={() => setCreateOpen(true)}>New campaign</Button>
            </Card>
          ) : view === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((c) => <CampaignCard key={c.id} c={c} onOpen={() => onOpenCampaign(c.id)} view="grid" />)}
            </div>
          ) : (
            <Card pad={false}>
              <div className="flex items-center gap-4 px-5 py-2.5 text-[10px] uppercase tracking-wider text-slate-500">
                <span className="flex-1">Campaign</span>
                <span className="hidden w-28 sm:block">Status</span>
                <span className="hidden w-20 text-right md:block">Sent</span>
                <span className="hidden w-20 text-right md:block">Reply</span>
                <span className="w-24">Progress</span>
              </div>
              {shown.map((c) => <CampaignCard key={c.id} c={c} onOpen={() => onOpenCampaign(c.id)} view="list" />)}
            </Card>
          )}
        </>
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
              <Button variant="primary" icon="check" disabled={creating} onClick={create}>{creating ? "Creating…" : "Create campaign"}</Button>
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
            {/* Lead-list upload and "campaign goal": leads are imported after the campaign
                exists (Campaign → Leads → Add leads), and goals have no API — hidden. */}
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Sending accounts" hint={accounts.length ? undefined : "No sending accounts connected yet."}>
              <select className={inputCls} value={form.accounts} onChange={(e) => setForm({ ...form, accounts: e.target.value })}>
                <option value="">No account selected</option>
                {accounts.map((a) => <option key={a.id} value={a.from_email}>{a.from_email}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily limit per account" hint="Leave blank to keep each account's current cap.">
                <input className={inputCls} value={form.daily} onChange={(e) => setForm({ ...form, daily: e.target.value })} placeholder="e.g. 40" />
              </Field>
              {/* "Stop sending" rule and the personalization/AI toggles have no API — hidden. */}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
