import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import { Card, StatCard } from "../components/ui";
import { Send, Reply } from "lucide-react";
import * as api from "../lib/api";

export default function Analytics() {
  const [stats, setStats] = useState<api.StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load stats."))
      .finally(() => setLoading(false));
  }, []);

  const total = stats?.total;
  const replyRate = total && total.sent ? ((total.replied / total.sent) * 100).toFixed(1) : "0.0";

  return (
    <>
      <Topbar title="Analytics" subtitle="Campaign performance reported by the ColdLane API" />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        {loading && <p className="text-sm text-slate-400">Loading stats…</p>}
        {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Sent" value={(total?.sent ?? 0).toLocaleString()} icon={Send} accent="indigo" />
          {/* TODO(feature): average open rate — ColdLane tracks no opens */}
          <StatCard label="Reply Rate" value={`${replyRate}%`} icon={Reply} accent="amber" />
          {/* TODO(feature): positive reply rate — sentiment is per thread, not an aggregate */}
        </div>

        {/* TODO(feature): campaign comparison chart — built on open rates, which do not exist */}
        {/* TODO(feature): inbox placement pie — no deliverability breakdown in the API */}
        {/* TODO(feature): weekly volume chart — no time-series in the API */}
        {/* TODO(feature): conversion funnel — no funnel data in the API */}

        {!loading && !error && stats && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Campaign</th>
                    <th className="px-3 py-3 font-semibold text-right">Sent</th>
                    <th className="px-3 py-3 font-semibold text-right">Replied</th>
                    <th className="px-3 py-3 font-semibold text-right">Bounced</th>
                    <th className="px-3 py-3 font-semibold text-right">Unsubscribed</th>
                    <th className="px-3 py-3 font-semibold text-right">Meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.campaigns.map((c) => (
                    <tr key={c.campaign_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{c.sent.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{c.replied}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{c.bounced}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{c.unsubscribed}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">{c.meetings}</td>
                    </tr>
                  ))}
                  {stats.campaigns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                        No campaigns yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
