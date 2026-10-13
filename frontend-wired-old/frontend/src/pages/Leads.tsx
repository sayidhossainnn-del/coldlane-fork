import { useCallback, useEffect, useState } from "react";
import { Search, Upload, CheckSquare, Square, ListChecks } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, SecondaryButton, Pill } from "../components/ui";
import type { Campaign, Lead } from "../data/mock";
import * as api from "../lib/api";

const statusColors: Record<string, string> = {
  "Not Contacted": "bg-slate-100 text-slate-600",
  Contacted: "bg-indigo-50 text-indigo-700",
  Replied: "bg-amber-50 text-amber-700",
  Bounced: "bg-rose-50 text-rose-700",
  Unsubscribed: "bg-rose-50 text-rose-700",
  Suppressed: "bg-slate-100 text-slate-600",
  "Merge Error": "bg-amber-50 text-amber-700",
  Error: "bg-rose-50 text-rose-700",
  Completed: "bg-emerald-50 text-emerald-700",
};

const sentimentColors: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-rose-50 text-rose-700",
};

const STATUS_OPTIONS = [
  "queued",
  "active",
  "replied",
  "bounced",
  "unsubscribed",
  "suppressed",
  "merge_error",
  "error",
  "completed",
  "waiting_cap",
];

interface ImportState {
  campaignId: string;
  filename: string;
  csvText: string;
  agreed: boolean;
  result: api.RawImportResult | null;
}

const emptyImport = (): ImportState => ({
  campaignId: "",
  filename: "",
  csvText: "",
  agreed: false,
  result: null,
});

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imp, setImp] = useState<ImportState>(emptyImport());

  useEffect(() => {
    api
      .listCampaigns()
      .then(setCampaigns)
      .catch((err) => api.toastError(err));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .listLeads({
        campaign_id: activeCampaign === "all" ? undefined : api.toId(activeCampaign),
        status: statusFilter || undefined,
      })
      .then((res) => {
        setLeads(res.leads.map(api.toLead));
        setTotal(res.total);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load leads."))
      .finally(() => setLoading(false));
  }, [activeCampaign, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = leads.filter((l) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      l.name.toLowerCase().includes(needle) ||
      l.company.toLowerCase().includes(needle) ||
      l.email.toLowerCase().includes(needle)
    );
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  }

  function toggleMeeting(lead: Lead) {
    setBusyLeadId(lead.id);
    const request = lead.meetingBooked ? api.clearMeeting(lead.id) : api.setMeeting(lead.id);
    request
      .then(({ lead: updated }) => {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? api.toLead(updated) : l)));
        api.toast(lead.meetingBooked ? "Meeting flag cleared." : "Meeting booked.", "success");
      })
      .catch((err) => api.toastError(err))
      .finally(() => setBusyLeadId(null));
  }

  function pickFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImp((prev) => ({ ...prev, filename: file.name, csvText: String(reader.result ?? "") }));
    reader.readAsText(file);
  }

  function runImport() {
    if (!imp.campaignId) {
      api.toast("Choose a campaign to import into.", "error");
      return;
    }
    if (!imp.csvText.trim()) {
      api.toast("Choose a CSV file first.", "error");
      return;
    }
    if (!imp.agreed) {
      api.toast("You must confirm the lawful basis before importing.", "error");
      return;
    }
    setImporting(true);
    api
      .importLeads(imp.campaignId, {
        csv_text: imp.csvText,
        filename: imp.filename || "leads.csv",
        lawful_basis_confirmed: true,
      })
      .then((result) => {
        setImp((prev) => ({ ...prev, result }));
        api.toast(`Imported ${result.counts.imported} lead(s).`, "success");
        if (String(activeCampaign) === String(imp.campaignId)) load();
      })
      .catch((err) => api.toastError(err))
      .finally(() => setImporting(false));
  }

  return (
    <>
      <Topbar
        title="Leads"
        subtitle={`${total} leads${activeCampaign === "all" ? " across all campaigns" : " in this campaign"}`}
        actions={
          <div className="flex items-center gap-2">
            <SecondaryButton
              icon={Upload}
              onClick={() => {
                setImp(emptyImport());
                setImportOpen(true);
              }}
            >
              Import CSV
            </SecondaryButton>
            {/* TODO(feature): lead lists — leads are grouped by campaign, not by list */}
          </div>
        }
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit p-4">
            <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Campaigns</h4>
            <div className="mt-3 space-y-1">
              <button
                onClick={() => setActiveCampaign("all")}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                  activeCampaign === "all" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Leads
                <Pill>{total}</Pill>
              </button>
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCampaign(c.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    activeCampaign === c.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-2">{c.name}</span>
                  {/* TODO(feature): per-campaign lead counts in the sidebar — only the filtered query returns a total */}
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search leads by name, company, or email..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-96"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {api.statusLabel(s)}
                      </option>
                    ))}
                  </select>
                  {/* TODO(feature): advanced filters — the API filters by campaign and status only */}
                  {selected.size > 0 && (
                    <>
                      {/* TODO(feature): add to campaign, tag, bulk delete — no API for bulk lead edits */}
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <ListChecks size={14} /> {selected.size} selected
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {loading && <p className="text-sm text-slate-400">Loading leads…</p>}
            {loadError && (
              <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p>{loadError}</p>
                <button onClick={load} className="mt-1 font-semibold underline">Retry</button>
              </Card>
            )}

            {!loadError && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="w-10 px-5 py-3">
                        <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-600">
                          {selected.size === filtered.length && filtered.length > 0 ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-3 font-semibold">Name</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-3 py-3 font-semibold">Company</th>
                      <th className="px-3 py-3 font-semibold">Title</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold text-right">Score</th>
                      <th className="px-3 py-3 font-semibold">Sentiment</th>
                      <th className="px-3 py-3 font-semibold">Meeting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-5 py-14 text-center text-sm text-slate-400">
                          No leads yet — import a CSV to get started.
                        </td>
                      </tr>
                    )}
                    {filtered.map((l) => (
                      <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <button onClick={() => toggle(l.id)} className="text-slate-400 hover:text-indigo-600">
                            {selected.has(l.id) ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800">{l.name}</td>
                        <td className="px-3 py-3 text-slate-500">{l.email}</td>
                        <td className="px-3 py-3 text-slate-500">{l.company}</td>
                        <td className="px-3 py-3 text-slate-500">{l.title}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-700">{l.score ?? 0}</td>
                        <td className="px-3 py-3">
                          {l.sentiment ? (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sentimentColors[l.sentiment] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {api.sentimentLabel(l.sentiment)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => toggleMeeting(l)}
                            disabled={busyLeadId === l.id}
                            title={l.meetingBooked ? "Clear meeting flag" : "Mark meeting booked"}
                            className={`relative h-6 w-11 rounded-full transition ${l.meetingBooked ? "bg-indigo-600" : "bg-slate-200"} disabled:opacity-60`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${l.meetingBooked ? "left-5" : "left-0.5"}`}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                <span>
                  Showing {filtered.length} of {total} leads
                </span>
                <span>{selected.size} selected</span>
              </div>
            </Card>
            )}
          </div>
        </div>
      </main>

      {importOpen && (
        <ImportModal
          state={imp}
          campaigns={campaigns}
          importing={importing}
          onChange={setImp}
          onFile={pickFile}
          onClose={() => {
            setImp(emptyImport());
            setImportOpen(false);
          }}
          onImport={runImport}
        />
      )}
    </>
  );
}

function ImportModal({
  state,
  campaigns,
  importing,
  onChange,
  onFile,
  onClose,
  onImport,
}: {
  state: ImportState;
  campaigns: Campaign[];
  importing: boolean;
  onChange: (next: ImportState) => void;
  onFile: (file: File | null) => void;
  onClose: () => void;
  onImport: () => void;
}) {
  const counts = state.result?.counts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Import leads from CSV</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <span className="text-lg leading-none">✕</span>
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
          {!state.result ? (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500">Campaign</label>
                <select
                  value={state.campaignId}
                  onChange={(e) => onChange({ ...state, campaignId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Choose a campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">CSV file (needs an email column)</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm text-slate-500"
                />
                {state.filename && <p className="mt-1 text-xs text-slate-400">{state.filename}</p>}
              </div>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={state.agreed}
                  onChange={(e) => onChange({ ...state, agreed: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm text-slate-600">
                  I confirm I have a lawful basis to email these contacts (legitimate interest or consent) and will
                  honor opt-outs.
                </span>
              </label>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Count label="Imported" value={counts?.imported ?? 0} />
                <Count label="Duplicates" value={counts?.duplicates ?? 0} />
                <Count label="Invalid" value={counts?.invalid ?? 0} />
                <Count label="Suppressed" value={counts?.suppressed ?? 0} />
                <Count label="Rows" value={counts?.rows ?? 0} />
              </div>
              {state.result.rejected.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Rejected rows ({state.result.rejected_total}
                    {state.result.rejected_truncated ? `, showing first ${state.result.rejected.length}` : ""})
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {state.result.rejected.map((r) => (
                      <li key={`${r.row}-${r.email}`}>
                        Row {r.row}: {r.email || "(empty)"} — {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <SecondaryButton onClick={onClose}>{state.result ? "Close" : "Cancel"}</SecondaryButton>
          {!state.result && (
            <PrimaryButton onClick={onImport}>{importing ? "Importing…" : "Import leads"}</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
