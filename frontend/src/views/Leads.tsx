import { useState } from "react";
import { Card, Badge, Button, Avatar, Icon, Tabs, Progress, inputCls, Field, Divider, Ring } from "../components/ui";
import { leads as seed, campaigns } from "../lib/data";
import type { Lead } from "../lib/data";

const statusTone: Record<string, string> = {
  active: "sky", replied: "emerald", paused: "amber", completed: "violet", bounced: "rose", new: "slate",
};

const FILTERS = [
  { label: "All leads", icon: "users", count: 9840 },
  { label: "Engaged", icon: "zap", count: 1842 },
  { label: "Replied", icon: "reply", count: 3157 },
  { label: "Opened 3+ times", icon: "eye", count: 964 },
  { label: "Bounced", icon: "x", count: 475 },
  { label: "Unsubscribed", icon: "archive", count: 204 },
  { label: "Not started", icon: "clock", count: 2210 },
];

export function Leads({ toast }: { toast: (m: string, t?: string) => void }) {
  const [rows, setRows] = useState(seed);
  const [sel, setSel] = useState<string[]>([]);
  const [filter, setFilter] = useState("All leads");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof Lead>("score");
  const [asc, setAsc] = useState(false);
  const [drawer, setDrawer] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const shown = rows
    .filter((l) => {
      if (filter === "All leads") return true;
      if (filter === "Replied") return l.status === "replied";
      if (filter === "Bounced") return l.status === "bounced";
      if (filter === "Engaged") return l.score >= 80;
      if (filter === "Opened 3+ times") return l.score >= 85;
      if (filter === "Not started") return l.status === "new";
      if (filter === "Unsubscribed") return l.status === "paused";
      return true;
    })
    .filter((l) => (l.name + l.email + l.company + l.title).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });

  const allSel = shown.length > 0 && sel.length === shown.length;
  const toggleAll = () => setSel(allSel ? [] : shown.map((l) => l.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const th = (label: string, key: keyof Lead, cls = "") => (
    <th className={`px-4 pb-2.5 font-medium ${cls}`}>
      <button
        onClick={() => { setSortKey(key); setAsc(sortKey === key ? !asc : false); }}
        className={`inline-flex items-center gap-1 transition hover:text-slate-200 ${sortKey === key ? "text-slate-200" : ""}`}
      >
        {label}
        {sortKey === key && <Icon name="chevronDown" className={`h-3 w-3 transition ${asc ? "rotate-180" : ""}`} />}
      </button>
    </th>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      {/* filter rail */}
      <div className="space-y-4">
        <Card className="space-y-0.5 p-2.5">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.label)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] transition ${
                filter === f.label ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              <Icon name={f.icon} className={`h-[15px] w-[15px] ${filter === f.label ? "text-brand-300" : "text-slate-500"}`} />
              <span className="flex-1 text-left">{f.label}</span>
              <span className="text-[10.5px] tabular-nums text-slate-500">{f.count.toLocaleString()}</span>
            </button>
          ))}
        </Card>

        <Card>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Lists</p>
          <div className="space-y-1">
            {[["Series B SaaS", 4210, "brand"], ["E-comm Founders", 2870, "sky"], ["Reactivation", 1180, "violet"], ["Agencies", 640, "emerald"], ["FinServ", 940, "amber"]].map(([n, c, t]) => (
              <button key={n as string} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-slate-400 transition hover:bg-white/[0.04] hover:text-white">
                <span className="h-2 w-2 rounded-sm" style={{ background: { brand: "#6366f1", sky: "#22d3ee", violet: "#a78bfa", emerald: "#34d399", amber: "#fbbf24" }[t as string] }} />
                <span className="flex-1 truncate">{n}</span>
                <span className="text-[10px] tabular-nums text-slate-600">{(c as number).toLocaleString()}</span>
              </button>
            ))}
          </div>
          <Divider className="my-3" />
          <Button size="sm" variant="default" icon="plus" className="w-full">New list</Button>
        </Card>

        <Card>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Verification</p>
          <div className="flex items-center gap-3">
            <Ring value={94} size={54} stroke={5} tone="#34d399" label="94%" />
            <p className="text-[11.5px] leading-snug text-slate-400">94% of your list is verified. 475 invalid emails will be excluded automatically.</p>
          </div>
          <Button size="sm" variant="default" icon="shield" className="mt-3 w-full">Re-verify list</Button>
        </Card>
      </div>

      {/* table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, company…"
              className="h-9 w-64 rounded-lg border border-ink-700 bg-ink-900/70 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <Tabs tabs={["Score", "Name", "Company"]} active={sortKey === "score" ? "Score" : sortKey === "name" ? "Name" : "Company"} onChange={(t) => { setSortKey(t.toLowerCase() as keyof Lead); setAsc(false); }} />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="default" icon="filter">More filters</Button>
            <Button variant="default" icon="download">Export</Button>
            <Button variant="primary" icon="upload" onClick={() => setImportOpen(true)}>Import leads</Button>
          </div>
        </div>

        <Card pad={false} className="overflow-hidden">
          {/* bulk bar */}
          {sel.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-brand-500/25 bg-brand-500/[0.08] px-4 py-2.5">
              <span className="text-[12.5px] font-medium text-brand-100">{sel.length} selected</span>
              <div className="ml-2 flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="default" icon="send" onClick={() => { toast(`${sel.length} leads added to campaign`, "emerald"); setSel([]); }}>Add to campaign</Button>
                <Button size="sm" variant="default" icon="pause">Pause</Button>
                <Button size="sm" variant="default" icon="archive">Archive</Button>
                <Button size="sm" variant="danger" icon="trash" onClick={() => { setRows((r) => r.filter((l) => !sel.includes(l.id))); setSel([]); toast("Leads deleted", "rose"); }}>Delete</Button>
              </div>
              <button onClick={() => setSel([])} className="ml-auto text-[12px] text-slate-400 hover:text-white">Clear</button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={allSel} onChange={toggleAll} className="h-4 w-4 rounded accent-brand-500" />
                <span className="text-[12.5px] text-slate-400">Select all · <b className="text-slate-200">{shown.length}</b> shown</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone="slate">Dedupe on</Badge>
                <Badge tone="emerald">Verified</Badge>
                <Badge tone="brand">Timezone aware</Badge>
              </div>
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
                {shown.map((l) => (
                  <tr key={l.id} className={`border-b border-ink-700/40 transition hover:bg-white/[0.025] ${sel.includes(l.id) ? "bg-brand-500/[0.05]" : ""}`}>
                    <td className="px-4"><input type="checkbox" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 rounded accent-brand-500" /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDrawer(l)} className="flex items-center gap-2.5 text-left">
                        <Avatar name={l.name} hue={l.avatarHue} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-white hover:text-brand-200">{l.name}</p>
                          <p className="truncate text-[11px] text-slate-500">{l.email}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4">
                      <p className="text-[12.5px] text-slate-200">{l.company}</p>
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
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-[11.5px] text-slate-500">Showing 1–{shown.length} of 9,840 leads</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" icon="chevronLeft">Prev</Button>
              {["1", "2", "3", "…", "164"].map((n, i) => (
                <button key={i} className={`h-7 min-w-7 rounded-md px-1.5 text-[12px] transition ${i === 0 ? "bg-brand-500/20 text-brand-100" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>{n}</button>
              ))}
              <Button size="sm" variant="ghost">Next</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDrawer(null)} />
          <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-ink-700 bg-ink-900 shadow-2xl animate-slide-up">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-700 bg-ink-900/95 px-5 py-4 backdrop-blur">
              <Avatar name={drawer.name} hue={drawer.avatarHue} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-white">{drawer.name}</p>
                <p className="truncate text-[11.5px] text-slate-500">{drawer.title} · {drawer.company}</p>
              </div>
              <button onClick={() => setDrawer(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="x" /></button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-3 gap-2">
                {[["Score", drawer.score.toString()], ["Stage", drawer.stage.split(" ")[0]], ["Status", drawer.status]].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-ink-700 bg-ink-850/60 p-2.5 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p>
                    <p className="mt-0.5 text-[13px] font-semibold capitalize text-white">{v}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="primary" icon="mail" className="flex-1">Send email</Button>
                <Button variant="default" icon="phone" />
                <Button variant="default" icon="linkedin" />
                <Button variant="default" icon="star" />
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Contact details</p>
                <div className="space-y-2 rounded-xl border border-ink-700 bg-ink-850/50 p-3.5">
                  {[
                    ["Email", drawer.email],
                    ["Location", drawer.location],
                    ["Company", drawer.company],
                    ["Campaign", drawer.campaign],
                    ["Timezone", "UTC-6 · America/Chicago"],
                    ["Source", "CSV import · LinkedIn scrape"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4 text-[12px]">
                      <span className="shrink-0 text-slate-500">{k}</span>
                      <span className="text-right text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Sequence progress</p>
                <div className="rounded-xl border border-ink-700 bg-ink-850/50 p-3.5">
                  <div className="mb-2 flex justify-between text-[12px]"><span className="text-slate-400">Step 3 of 7</span><span className="text-white">43%</span></div>
                  <Progress value={43} tone="brand" />
                  <div className="mt-3 space-y-2">
                    {[["Email 1 — Intro", "opened", "emerald"], ["Email 2 — Case study", "opened 3x", "emerald"], ["Email 3 — Breakup", "scheduled Feb 28", "sky"]].map(([s, st, t]) => (
                      <div key={s} className="flex items-center gap-2 text-[11.5px]">
                        <Icon name={t === "emerald" ? "check" : "clock"} className={`h-3.5 w-3.5 ${t === "emerald" ? "text-emerald-400" : "text-sky-400"}`} />
                        <span className="flex-1 text-slate-300">{s}</span>
                        <span className="text-slate-600">{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Activity</p>
                <div className="space-y-2.5 rounded-xl border border-ink-700 bg-ink-850/50 p-3.5">
                  {[["Reply received", "12m ago"], ["Email opened", "1h ago"], ["Email delivered", "1d ago"], ["Lead added to campaign", "3d ago"]].map(([e, t]) => (
                    <div key={e} className="flex items-center gap-2 text-[11.5px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                      <span className="flex-1 text-slate-300">{e}</span>
                      <span className="text-slate-600">{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="default" icon="pause" className="flex-1">Pause lead</Button>
                <Button variant="danger" icon="trash" className="flex-1">Remove</Button>
              </div>
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
              <div className="grid place-items-center rounded-xl border border-dashed border-ink-600 bg-ink-900/50 px-4 py-10 text-center transition hover:border-brand-500/50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-300"><Icon name="upload" className="h-5 w-5" /></div>
                <p className="mt-3 text-[13px] font-medium text-white">Drop your CSV here</p>
                <p className="mt-1 text-[11.5px] text-slate-500">or click to browse · max 50,000 rows</p>
                <Button variant="default" size="sm" className="mt-3">Choose file</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Add to campaign">
                  <select className={inputCls}>{campaigns.map((c) => <option key={c.id}>{c.name}</option>)}</select>
                </Field>
                <Field label="Deduplicate by">
                  <select className={inputCls}><option>Email (recommended)</option><option>Domain + name</option><option>Do not dedupe</option></select>
                </Field>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-slate-500">
                Required column: <code className="font-mono text-brand-200">email</code>. Optional: first_name, last_name, company, title, linkedin_url, custom variables.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
              <Button variant="default" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={() => { setImportOpen(false); toast("1,240 leads queued for verification", "emerald"); }}>Start import</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
