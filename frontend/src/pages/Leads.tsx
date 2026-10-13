import { useMemo, useState } from "react";
import { Plus, Search, Upload, Filter, CheckSquare, Square, Trash2, Tag, ListChecks } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, SecondaryButton, Pill } from "../components/ui";
import { leadLists, leads as allLeads } from "../data/mock";

export default function Leads() {
  const [activeList, setActiveList] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return allLeads.filter((l) => {
      const matchQuery =
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.company.toLowerCase().includes(query.toLowerCase()) ||
        l.email.toLowerCase().includes(query.toLowerCase());
      return matchQuery;
    });
  }, [query]);

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

  const statusColors: Record<string, string> = {
    "Not Contacted": "bg-slate-100 text-slate-600",
    Contacted: "bg-indigo-50 text-indigo-700",
    Opened: "bg-violet-50 text-violet-700",
    Replied: "bg-amber-50 text-amber-700",
    Interested: "bg-emerald-50 text-emerald-700",
    Bounced: "bg-rose-50 text-rose-700",
  };

  return (
    <>
      <Topbar
        title="Leads"
        subtitle={`${allLeads.length} leads across ${leadLists.length} lists`}
        actions={
          <div className="flex items-center gap-2">
            <SecondaryButton icon={Upload}>Import CSV</SecondaryButton>
            <PrimaryButton icon={Plus}>New List</PrimaryButton>
          </div>
        }
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit p-4">
            <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Lead Lists</h4>
            <div className="mt-3 space-y-1">
              <button
                onClick={() => setActiveList("all")}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                  activeList === "all" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Leads
                <Pill>{allLeads.length}</Pill>
              </button>
              {leadLists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveList(l.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    activeList === l.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate pr-2">{l.name}</span>
                  <Pill className="shrink-0">{l.leads.toLocaleString()}</Pill>
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
                  <SecondaryButton icon={Filter}>Filters</SecondaryButton>
                  {selected.size > 0 && (
                    <>
                      <SecondaryButton icon={ListChecks}>Add to Campaign</SecondaryButton>
                      <SecondaryButton icon={Tag}>Tag</SecondaryButton>
                      <button className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                        <Trash2 size={14} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
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
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 20).map((l) => (
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
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[l.status]}`}>{l.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
                <span>Showing {Math.min(20, filtered.length)} of {filtered.length} leads</span>
                <span>{selected.size} selected</span>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
