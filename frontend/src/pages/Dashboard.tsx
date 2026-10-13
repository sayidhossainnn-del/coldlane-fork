import { Send, MailOpen, Reply, UserCheck, Plus, ArrowUpRight } from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, ProgressBar, StatCard, StatusBadge } from "../components/ui";
import { campaigns, emailAccounts, performanceSeries, inboxThreads } from "../data/mock";
import { Link } from "react-router-dom";

export default function Dashboard() {
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Emails Sent" value="18,900" delta="+12.4%" icon={Send} accent="indigo" />
          <StatCard label="Open Rate" value="62.1%" delta="+3.1%" icon={MailOpen} accent="violet" />
          <StatCard label="Reply Rate" value="7.7%" delta="-0.4%" positive={false} icon={Reply} accent="amber" />
          <StatCard label="Interested Leads" value="480" delta="+18.9%" icon={UserCheck} accent="emerald" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Campaign Performance</h3>
                <p className="text-sm text-slate-500">Sent vs. opens vs. replies — last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Sent</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" />Opens</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Replies</span>
              </div>
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceSeries} margin={{ left: -20, right: 10 }}>
                  <defs>
                    <linearGradient id="sent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="opens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="replies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="sent" stroke="#6366f1" fill="url(#sent)" strokeWidth={2} />
                  <Area type="monotone" dataKey="opens" stroke="#a78bfa" fill="url(#opens)" strokeWidth={2} />
                  <Area type="monotone" dataKey="replies" stroke="#34d399" fill="url(#replies)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Email Account Health</h3>
              <Link to="/accounts" className="text-xs font-semibold text-indigo-600 hover:underline">
                Manage
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {emailAccounts.slice(0, 4).map((acc) => (
                <div key={acc.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium text-slate-700">{acc.email}</span>
                    <span className="text-xs font-semibold text-slate-500">{acc.warmupScore}%</span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar
                      value={acc.warmupScore}
                      color={acc.warmupScore > 80 ? "emerald" : acc.warmupScore > 50 ? "indigo" : "amber"}
                    />
                  </div>
                </div>
              ))}
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
              {inboxThreads.slice(0, 4).map((t) => (
                <Link to="/inbox" key={t.id} className="flex items-start gap-3 -mx-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                    {t.name.split(" ").map((n) => n[0]).join("")}
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
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
