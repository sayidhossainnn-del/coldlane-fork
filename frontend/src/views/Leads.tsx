import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Badge, Button, Avatar, Icon, Tabs, Progress, inputCls, Field } from "../components/ui";
import * as api from "../lib/api";
import type { RawLeadFull } from "../lib/api";
import type { Campaign, Lead } from "../lib/data";

const statusTone: Record<string, string> = {
  active: "sky", replied: "emerald", paused: "amber", completed: "violet", bounced: "rose", new: "slate",
};

type Row = { raw: RawLeadFull; lead: Lead };

// "Opened 3+ times" is gone: the API has no open tracking.
const FILTERS: { label: string; icon: string; match: (r: Row) => boolean }[] = [
  { label: "All leads", icon: "users", match: () => true },
  { label: "Engaged", icon: "zap", match: (r) => r.lead.score >= 80 },
  { label: "Replied", icon: "reply", match: (r) => r.raw.status === "replied" },
  { label: "Bounced", icon: "x", match: (r) => r.raw.status === "bounced" },
  { label: "Unsubscribed", icon: "archive", match: (r) => r.raw.status === "unsubscribed" },
  { label: "Not started", icon: "clock", match: (r) => r.raw.status === "queued" },
];

const PAGE_SIZE = 50;

export function Leads({ toast }: { toast: (m: string, t?: string) => void }) {
  const [rawRows, setRawRows] = useState<RawLeadFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [filter, setFilter] = useState("All leads");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof Lead>("score");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [drawerSteps, setDrawerSteps] = useState<{ title: string; done: boolean }[] | null>(null);
  const [drawerStepsLoading, setDrawerStepsLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCampaign, setImportCampaign] = useState("");
  const [importFile, setImportFile] = useState<{ name: string; text: string } | null>(null);
  const [lawful, setLawful] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = useMemo<Row[]>(() => rawRows.map((raw) => ({ raw, lead: api.toLead(raw) })), [rawRows]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    api
      .listAllLeads()
      .then((rows) => setRawRows(rows))
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  useEffect(() => {
    api.listCampaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    if (!drawer) {
      setDrawerSteps(null);
      return;
    }
    setDrawerStepsLoading(true);
    api
      .getCampaign(String(drawer.raw.campaign_id))
      .then((d) =>
        setDrawerSteps(
          d.steps.map((s) => ({ title: s.subject || `Step ${s.position}`, done: s.position <= drawer.raw.current_step })),
        ),
      )
      .catch(() => setDrawerSteps(null))
      .finally(() => setDrawerStepsLoading(false));
  }, [drawer]);

  const activeFilter = FILTERS.find((f) => f.label === filter) ?? FILTERS[0];
  const filtered = items
    .filter((r) => (campaignFilter ? String(r.raw.campaign_id) === campaignFilter : true))
    .filter(activeFilter.match)
    .filter((r) => (r.lead.name + r.lead.email + r.lead.company + r.lead.title).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const av = a.lead[sortKey];
      const bv = b.lead[sortKey];
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages - 1);
  const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const allSel = shown.length > 0 && shown.every((r) => sel.includes(r.lead.id));
  const toggleAll = () => setSel(allSel ? [] : shown.map((r) => r.lead.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const th = (label: string, key: keyof Lead, cls = "") => (
    <th className={`px-4 pb-2.5 font-medium ${cls}`}>
      <button
        onClick={() => { setSortKey(key); setAsc(sortKey === key ? !asc : false); setPage(0); }}
        className={`inline-flex items-center gap-1 transition hover:text-slate-200 ${sortKey === key ? "text-slate-200" : ""}`}
      >
        {label}
        {sortKey === key && <Icon name="chevronDown" className={`h-3 w-3 transition ${asc ? "rotate-180" : ""}`} />}
      </button>
    </th>
  );

  const readCsv = (file: File | undefined) => {
    if (!file) return;
    file
      .text()
      .then((text) => setImportFile({ name: file.name, text }))
      .catch(() => toast("Could not read that file.", "rose"));
  };

  const startImport = () => {
    if (importing) return;
    if (!importCampaign) {
      toast("Choose a campaign to import into.", "rose");
      return;
    }
    if (!importFile) {
      toast("Choose a CSV file first.", "rose");
      return;
    }
    if (!lawful) {
      toast("Confirm you have a lawful basis to email these contacts.", "rose");
      return;
    }
    setImporting(true);
    api
      .importLeads(importCampaign, { csv_text: importFile.text, filename: importFile.name, lawful_basis_confirmed: true })
      .then((res) => {
        const c = res.counts;
        setImportOpen(false);
        setImportFile(null);
        setLawful(false);
        toast(`${c.imported} imported · ${c.duplicates} duplicates · ${c.invalid} invalid · ${c.suppressed} suppressed`, "emerald");
        setReloadKey((k) => k + 1);
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setImporting(false));
  };

  const pageItems: (number | "…")[] = [];
  {
    const candidates = [...new Set([1, 2, 3, current, current + 1, current + 2, totalPages]
      .filter((n) => n >= 1 && n <= totalPages))]
      .sort((a, b) => a - b);
    let last = 0;
    for (const n of candidates) {
      if (last && n > last + 1) pageItems.push("…");
      pageItems.push(n);
      last = n;
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      {/* filter rail */}
      <div className="space-y-4">
        <Card className="space-y-0.5 p-2.5">
          {FILTERS.map((f) => {
            const count = items.filter(f.match).length;
            return (
              <button
                key={f.label}
                onClick={() => { setFilter(f.label); setPage(0); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] transition ${
                  filter === f.label ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                <Icon name={f.icon} className={`h-[15px] w-[15px] ${filter === f.label ? "text-brand-300" : "text-slate-500"}`} />
                <span className="flex-1 text-left">{f.label}</span>
                <span className="text-[10.5px] tabular-nums text-slate-500">{count.toLocaleString()}</span>
              </button>
            );
          })}
        </Card>

        {campaigns.length > 0 && (
          <Card>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Lists</p>
            <div className="space-y-1">
              {campaigns.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => { setCampaignFilter((cur) => (cur === c.id ? null : c.id)); setPage(0); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition hover:bg-white/[0.04] hover:text-white ${
                    campaignFilter === c.id ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25" : "text-slate-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-sm" style={{ background: ["#6366f1", "#22d3ee", "#a78bfa", "#34d399", "#fbbf24"][i % 5] }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] tabular-nums text-slate-600">{c.leads.toLocaleString()}</span>
                </button>
              ))}
            </div>
            {/* "New list": no list API — hidden. */}
          </Card>
        )}

        {/* Verification card: no list-verification API — hidden. */}
      </div>

      {/* table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="Search name, email, company…"
              className="h-9 w-64 rounded-lg border border-ink-700 bg-ink-900/70 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <Tabs tabs={["Score", "Name", "Company"]} active={sortKey === "score" ? "Score" : sortKey === "name" ? "Name" : "Company"} onChange={(t) => { setSortKey(t.toLowerCase() as keyof Lead); setAsc(false); setPage(0); }} />
          <div className="ml-auto flex items-center gap-2">
            {/* "More filters" and "Export": no API — hidden. */}
            {campaigns.length > 0 && (
              <Button variant="primary" icon="upload" onClick={() => setImportOpen(true)}>Import leads</Button>
            )}
          </div>
        </div>

        {loading && (
          <Card className="grid place-items-center py-16">
            <p className="text-[12px] text-slate-500">Loading leads…</p>
          </Card>
        )}
        {loadError && (
          <Card className="grid place-items-center py-16 text-center">
            <p className="text-[12px] text-slate-400">{loadError}</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
          </Card>
        )}

        {!loading && !loadError && (
          <Card pad={false} className="overflow-hidden">
            {/* bulk bar */}
            {sel.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-brand-500/25 bg-brand-500/[0.08] px-4 py-2.5">
                <span className="text-[12.5px] font-medium text-brand-100">{sel.length} selected</span>
                {/* Add-to-campaign / pause / archive / delete have no APIs: actions hidden. */}
                <button onClick={() => setSel([])} className="ml-auto text-[12px] text-slate-400 hover:text-white">Clear</button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={allSel} onChange={toggleAll} className="h-4 w-4 rounded accent-brand-500" />
                  <span className="text-[12.5px] text-slate-400">Select all · <b className="text-slate-200">{shown.length}</b> shown</span>
                </div>
                {/* Dedupe/verified/timezone badges: no backing data — hidden. */}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-ink-700/70 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="w-10 px-4 pb-2.5"><input type="checkbox" checked={allSel} onChange={toggleAll} className="h-4 w-4 rounded accent-brand-500" /></th>
                    {th("Lead", "name")}
                    {th("Company", "company")}
                    {th("Campaign", "campaign")}
                    {th("Status", "status")}
                    {th("Stage", "stage")}
                    {th("Last activity", "lastActivity")}
                    {th("Score", "score")}
                    <th className="w-10 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-[12px] text-slate-500">
                        No leads match this filter.
                      </td>
                    </tr>
                  )}
                  {shown.map((r) => {
                    const l = r.lead;
                    return (
                    <tr key={l.id} className={`border-b border-ink-700/40 transition hover:bg-white/[0.025] ${sel.includes(l.id) ? "bg-brand-500/[0.05]" : ""}`}>
                      <td className="px-4"><input type="checkbox" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 rounded accent-brand-500" /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDrawer(r)} className="flex items-center gap-2.5 text-left">
                          <Avatar name={l.name} hue={l.avatarHue} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-white hover:text-brand-200">{l.name}</p>
                            <p className="truncate text-[11px] text-slate-500">{l.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4">
                        <p className="text-[12.5px] text-slate-200">{l.company || "—"}</p>
                        <p className="text-[11px] text-slate-500">{l.title}</p>
                      </td>
                      <td className="max-w-[190px] px-4">
                        <p className="truncate text-[12px] text-slate-400">{l.campaign}</p>
                      </td>
                      <td className="px-4"><Badge tone={statusTone[l.status]} dot>{l.status}</Badge></td>
                      <td className="px-4 text-[12px] text-slate-400">{l.stage}</td>
                      <td className="px-4 text-[12px] text-slate-500">{l.lastActivity}</td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-semibold tabular-nums ${l.score >= 80 ? "text-emerald-300" : l.score >= 50 ? "text-slate-200" : "text-slate-500"}`}>{l.score}</span>
                          <div className="w-10"><Progress value={l.score} tone={l.score >= 80 ? "emerald" : "brand"} /></div>
                        </div>
                      </td>
                      <td className="px-4"><button className="rounded p-1 text-slate-600 hover:bg-white/5 hover:text-white"><Icon name="more" className="h-3.5 w-3.5" /></button></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-[11.5px] text-slate-500">
                {filtered.length === 0
                  ? "No leads"
                  : `Showing ${(current * PAGE_SIZE + 1).toLocaleString()}–${Math.min(filtered.length, (current + 1) * PAGE_SIZE).toLocaleString()} of ${filtered.length.toLocaleString()} leads`}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" icon="chevronLeft" disabled={current === 0} onClick={() => setPage(current - 1)}>Prev</Button>
                {pageItems.map((n, i) =>
                  n === "…" ? (
                    <span key={`gap-${i}`} className="px-1 text-[12px] text-slate-600">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n - 1)}
                      className={`h-7 min-w-7 rounded-md px-1.5 text-[12px] transition ${n === current + 1 ? "bg-brand-500/20 text-brand-100" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <Button size="sm" variant="ghost" disabled={current >= totalPages - 1} onClick={() => setPage(current + 1)}>Next</Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDrawer(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-ink-700 bg-ink-900 shadow-2xl animate-slide-up">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-700 bg-ink-900/95 px-5 py-4 backdrop-blur">
              <Avatar name={drawer.lead.name} hue={drawer.lead.avatarHue} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{drawer.lead.name}</p>
                <p className="truncate text-[11.5px] text-slate-500">{[drawer.lead.title, drawer.lead.company].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => setDrawer(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="x" /></button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Score", drawer.lead.score.toString()],
                  ["Stage", drawer.lead.stage.split(" ")[0]],
                  ["Status", drawer.lead.status],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-ink-700 bg-ink-850/60 p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p>
                    <p className="mt-0.5 text-[13px] font-semibold capitalize text-white">{v}</p>
                  </div>
                ))}
              </div>

              {/* Send email / call / LinkedIn / star: no APIs — hidden. */}

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Contact details</p>
                <div className="space-y-2 rounded-xl border border-ink-700 bg-ink-850/50 p-3.5">
                  {([
                    ["Email", drawer.lead.email],
                    ["Location", drawer.lead.location],
                    ["Company", drawer.lead.company],
                    ["Campaign", drawer.lead.campaign],
                    // Timezone and source: no API — hidden.
                  ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4 text-[12px]">
                      <span className="shrink-0 text-slate-500">{k}</span>
                      <span className="break-all text-right text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Sequence progress</p>
                <div className="rounded-xl border border-ink-700 bg-ink-850/50 p-3.5">
                  {drawerStepsLoading ? (
                    <p className="text-[12px] text-slate-500">Loading sequence…</p>
                  ) : drawerSteps ? (
                    <>
                      <div className="mb-2 flex justify-between text-[12px]">
                        <span className="text-slate-400">
                          {drawer.raw.current_step > 0 ? `Step ${drawer.raw.current_step} of ${drawerSteps.length}` : "Not started"}
                        </span>
                        <span className="text-white">{drawerSteps.length ? Math.min(100, Math.round((drawer.raw.current_step / drawerSteps.length) * 100)) : 0}%</span>
                      </div>
                      <Progress value={drawerSteps.length ? Math.min(100, (drawer.raw.current_step / drawerSteps.length) * 100) : 0} tone="brand" />
                      <div className="mt-3 space-y-2">
                        {drawerSteps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11.5px]">
                            <Icon name={s.done ? "check" : "clock"} className={`h-3.5 w-3.5 ${s.done ? "text-emerald-400" : "text-sky-400"}`} />
                            <span className="flex-1 truncate text-slate-300">{s.title}</span>
                            <span className="text-slate-600">{s.done ? "sent" : "pending"}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] text-slate-500">Sequence unavailable.</p>
                  )}
                </div>
              </div>

              {/* Activity feed and Pause/Remove actions: no APIs — hidden. */}
            </div>
          </div>
        </div>
      )}

      {/* import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setImportOpen(false)} />
          <div className="relative w-full max-w-lg animate-pop rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Import leads</h3>
              <button onClick={() => setImportOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="x" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); readCsv(e.dataTransfer.files?.[0]); }}
                className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-ink-600 bg-ink-900/50 px-4 py-10 text-center transition hover:border-brand-500/50"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-300"><Icon name="upload" className="h-5 w-5" /></div>
                <p className="mt-3 text-[13px] font-medium text-white">{importFile ? importFile.name : "Drop your CSV here"}</p>
                <p className="mt-1 text-[11.5px] text-slate-500">{importFile ? "Ready to import" : "or click to browse"}</p>
                <Button variant="default" size="sm" className="mt-3">{importFile ? "Choose another file" : "Choose file"}</Button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCsv(e.target.files?.[0])} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Add to campaign">
                  <select className={inputCls} value={importCampaign} onChange={(e) => setImportCampaign(e.target.value)}>
                    <option value="">Choose a campaign…</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                {/* "Deduplicate by": the API always dedupes by email — hidden. */}
              </div>
              <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-400">
                <input type="checkbox" checked={lawful} onChange={(e) => setLawful(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-500" />
                I confirm I have a lawful basis to email these contacts and will honor opt-outs.
              </label>
              <div className="rounded-lg bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-slate-500">
                Required column: <code className="font-mono text-brand-200">email</code>. Optional: first_name, last_name, company, title, linkedin_url, custom variables.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
              <Button variant="default" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={importing} onClick={startImport}>{importing ? "Importing…" : "Start import"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
