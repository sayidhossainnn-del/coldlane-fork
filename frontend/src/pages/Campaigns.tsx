import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  Copy,
  ArrowUpRight,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, ProgressBar, StatusBadge } from "../components/ui";
import { campaigns as initialCampaigns, type CampaignStatus } from "../data/mock";
import NewCampaignModal from "../components/NewCampaignModal";

const tabs: ("All" | CampaignStatus)[] = ["All", "Active", "Paused", "Draft", "Completed"];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesTab = tab === "All" || c.status === tab;
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [campaigns, tab, query]);

  function toggleStatus(id: string) {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === "Active" ? "Paused" : c.status === "Paused" ? "Active" : c.status } : c
      )
    );
    setOpenMenu(null);
  }

  function duplicate(id: string) {
    const original = campaigns.find((c) => c.id === id);
    if (!original) return;
    setCampaigns((prev) => [
      { ...original, id: `${id}-copy-${Date.now()}`, name: `${original.name} (Copy)`, status: "Draft" },
      ...prev,
    ]);
    setOpenMenu(null);
  }

  function remove(id: string) {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setOpenMenu(null);
  }

  return (
    <>
      <Topbar
        title="Campaigns"
        subtitle={`${campaigns.length} campaigns · ${campaigns.filter((c) => c.status === "Active").length} active`}
        actions={
          <PrimaryButton icon={Plus} onClick={() => setShowNew(true)}>
            New Campaign
          </PrimaryButton>
        }
      />
      <main className="flex-1 space-y-5 p-4 sm:p-8">
        <Card className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    tab === t ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:w-64"
              />
            </div>
          </div>
        </Card>

        <Card className="overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Campaign</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Progress</th>
                  <th className="px-3 py-3 font-semibold text-right">Sent</th>
                  <th className="px-3 py-3 font-semibold text-right">Opens</th>
                  <th className="px-3 py-3 font-semibold text-right">Replies</th>
                  <th className="px-3 py-3 font-semibold text-right">Interested</th>
                  <th className="px-3 py-3 font-semibold text-right">Created</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <Link to={`/campaigns/${c.id}`} className="flex items-center gap-1 font-semibold text-slate-800 hover:text-indigo-600">
                        {c.name}
                        <ArrowUpRight size={13} className="text-slate-300" />
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">{c.leads.toLocaleString()} leads &middot; {c.accounts.length} sender{c.accounts.length > 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar value={c.progress} />
                        </div>
                        <span className="text-xs text-slate-400">{c.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right font-medium text-slate-700">{c.sent.toLocaleString()}</td>
                    <td className="px-3 py-4 text-right text-slate-500">
                      {c.sent ? `${((c.opens / c.sent) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-4 text-right text-slate-500">
                      {c.sent ? `${((c.replies / c.sent) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-4 text-right font-medium text-emerald-600">{c.interested}</td>
                    <td className="px-3 py-4 text-right text-xs text-slate-400">{c.createdAt}</td>
                    <td className="relative px-3 py-4 text-right">
                      <button
                        onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenu === c.id && (
                        <div className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                          {c.status !== "Draft" && c.status !== "Completed" && (
                            <button
                              onClick={() => toggleStatus(c.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                              {c.status === "Active" ? <Pause size={14} /> : <Play size={14} />}
                              {c.status === "Active" ? "Pause" : "Resume"}
                            </button>
                          )}
                          <button
                            onClick={() => duplicate(c.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            <Copy size={14} />
                            Duplicate
                          </button>
                          <button
                            onClick={() => remove(c.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-14 text-center text-sm text-slate-400">
                      No campaigns match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} />}
    </>
  );
}
