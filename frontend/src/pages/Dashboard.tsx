import { useEffect, useState } from "react";
import { Send, Reply, UserCheck, Plus, ArrowUpRight } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, ProgressBar, StatCard, StatusBadge } from "../components/ui";
import type { Campaign, EmailAccount, InboxThread } from "../data/mock";
import * as api from "../lib/api";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [stats, setStats] = useState<api.StatsResponse | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [replies, setReplies] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getStats(), api.listCampaigns(), api.listMailboxes(), api.listThreads("all", 4)])
      .then(([s, c, m, t]) => {
        setStats(s);
        setCampaigns(c);
        setAccounts(m);
        setReplies(t);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load the dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const total = stats?.total;
  const replyRate = total && total.sent ? ((total.replied / total.sent) * 100).toFixed(1) : "0.0";
  const activeCampaigns = campaigns.filter((c) => c.status === "Active");

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Here's what's happening across your campaigns today."
        actions={
          <Link to="/campaigns">
            <PrimaryButton icon={Plus}>New Campaign</PrimaryButton>
          </Link>
        }
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        {loading && <p className="text-sm text-slate-400">Loading stats…</p>}
        {loadError && (
          <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Emails Sent" value={(total?.sent ?? 0).toLocaleString()} icon={Send} accent="indigo" />
          {/* TODO(feature): open rate and week-over-week deltas — ColdLane tracks no opens and keeps no history */}
          <StatCard label="Reply Rate" value={`${replyRate}%`} icon={Reply} accent="amber" />
          <StatCard label="Meetings Booked" value={String(total?.meetings ?? 0)} icon={UserCheck} accent="emerald" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* TODO(feature): sent vs opens vs replies over the last 7 days — no time-series in GET /api/stats */}
          <Card className="p-5 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Campaigns</h3>
                <p className="text-sm text-slate-500">Reply and bounce totals per campaign</p>
              </div>
              <Link to="/campaigns" className="text-xs font-semibold text-indigo-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {(stats?.campaigns ?? []).map((c) => (
                <Link
                  to={`/campaigns/${c.campaign_id}`}
                  key={c.campaign_id}
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {c.sent.toLocaleString()} sent · {c.replied} replies · {c.meetings} meetings
                    </p>
                  </div>
                  <StatusBadge status={api.campaignStatusLabel(c.status)} />
                </Link>
              ))}
              {stats && stats.campaigns.length === 0 && (
                <p className="py-3.5 text-sm text-slate-400">No campaigns yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Mailbox Daily Usage</h3>
              <Link to="/accounts" className="text-xs font-semibold text-indigo-600 hover:underline">
                Manage
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {accounts.slice(0, 4).map((acc) => {
                const cap = acc.dailyLimit || 1;
                const used = Math.min(100, Math.round(((acc.sentToday || 0) / cap) * 100));
                return (
                  <div key={acc.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-slate-700">{acc.email}</span>
                      <span className="text-xs font-semibold text-slate-500">
                        {acc.sentToday}/{acc.dailyLimit}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={used} color={used > 90 ? "amber" : "indigo"} />
                    </div>
                  </div>
                );
              })}
              {accounts.length === 0 && <p className="text-sm text-slate-400">No mailboxes connected yet.</p>}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Active Campaigns</h3>
              <Link to="/campaigns" className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {activeCampaigns.map((c) => (
                <Link
                  to={`/campaigns/${c.id}`}
                  key={c.id}
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={c.progress} />
                      <span className="shrink-0 text-xs text-slate-400">{c.progress}%</span>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
              {!loading && activeCampaigns.length === 0 && (
                <p className="py-3.5 text-sm text-slate-400">No active campaigns.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Recent Replies</h3>
              <Link to="/inbox" className="text-xs font-semibold text-indigo-600 hover:underline">
                Open Unibox
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {replies.slice(0, 4).map((t) => (
                <Link to="/inbox" key={t.id} className="flex items-start gap-3 -mx-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                    {t.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{t.time}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{t.preview}</p>
                  </div>
                </Link>
              ))}
              {replies.length === 0 && <p className="text-sm text-slate-400">No replies yet.</p>}
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
