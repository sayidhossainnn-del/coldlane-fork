import { useState } from "react";
import { Plus, Mail, Flame, ShieldCheck, Settings2 } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, ProgressBar, StatCard } from "../components/ui";
import { emailAccounts as initialAccounts } from "../data/mock";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip,
} from "recharts";

const warmupSeries = [
  { day: "D1", score: 10 },
  { day: "D5", score: 28 },
  { day: "D10", score: 45 },
  { day: "D15", score: 58 },
  { day: "D20", score: 71 },
  { day: "D25", score: 83 },
  { day: "D30", score: 92 },
];

const healthColors: Record<string, string> = {
  Excellent: "text-emerald-600 bg-emerald-50 ring-emerald-200",
  Good: "text-indigo-600 bg-indigo-50 ring-indigo-200",
  "At risk": "text-amber-600 bg-amber-50 ring-amber-200",
  Paused: "text-slate-500 bg-slate-100 ring-slate-200",
};

export default function EmailAccounts() {
  const [accounts, setAccounts] = useState(initialAccounts);

  function toggleWarmup(id: string) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, warmupEnabled: !a.warmupEnabled } : a)));
  }

  const avgScore = Math.round(accounts.reduce((sum, a) => sum + a.warmupScore, 0) / accounts.length);

  return (
    <>
      <Topbar
        title="Email Accounts"
        subtitle="Connect and warm up sending accounts to protect deliverability"
        actions={<PrimaryButton icon={Plus}>Connect Account</PrimaryButton>}
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Connected Accounts" value={String(accounts.length)} icon={Mail} accent="indigo" />
          <StatCard label="Avg. Warmup Score" value={`${avgScore}%`} icon={Flame} accent="amber" />
          <StatCard label="Inbox Placement" value="98.2%" delta="+1.2%" icon={ShieldCheck} accent="emerald" />
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Warmup Progress (Team Average)</h3>
              <p className="text-sm text-slate-500">Score improves as accounts build positive sender reputation</p>
            </div>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={warmupSeries} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="warmup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="score" stroke="#f59e0b" fill="url(#warmup)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Account</th>
                  <th className="px-3 py-3 font-semibold">Provider</th>
                  <th className="px-3 py-3 font-semibold">Health</th>
                  <th className="px-3 py-3 font-semibold">Warmup Score</th>
                  <th className="px-3 py-3 font-semibold">Daily Usage</th>
                  <th className="px-3 py-3 font-semibold">Warmup</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {a.email[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{a.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-slate-500">{a.provider}</td>
                    <td className="px-3 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${healthColors[a.health]}`}>
                        {a.health}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar value={a.warmupScore} color={a.warmupScore > 80 ? "emerald" : a.warmupScore > 50 ? "indigo" : "amber"} />
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{a.warmupScore}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-slate-500">
                      {a.sentToday}/{a.dailyLimit} sent
                    </td>
                    <td className="px-3 py-4">
                      <button
                        onClick={() => toggleWarmup(a.id)}
                        className={`relative h-6 w-11 rounded-full transition ${a.warmupEnabled ? "bg-indigo-600" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${a.warmupEnabled ? "left-5" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Settings2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
