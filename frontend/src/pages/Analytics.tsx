import Topbar from "../components/Topbar";
import { Card, StatCard } from "../components/ui";
import { campaigns, funnel, performanceSeries } from "../data/mock";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  FunnelChart,
  Funnel,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Send, MailOpen, Reply, TrendingUp } from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444"];

const campaignComparison = campaigns.map((c) => ({
  name: c.name.split(" ").slice(0, 2).join(" "),
  opens: c.sent ? Math.round((c.opens / c.sent) * 100) : 0,
  replies: c.sent ? Math.round((c.replies / c.sent) * 1000) / 10 : 0,
}));

const deliverability = [
  { name: "Inbox", value: 82 },
  { name: "Spam", value: 6 },
  { name: "Promotions", value: 9 },
  { name: "Bounced", value: 3 },
];

export default function Analytics() {
  return (
    <>
      <Topbar title="Analytics" subtitle="Deep dive into deliverability and campaign performance" />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Sent (30d)" value="48,230" delta="+9.2%" icon={Send} accent="indigo" />
          <StatCard label="Avg Open Rate" value="59.4%" delta="+2.8%" icon={MailOpen} accent="violet" />
          <StatCard label="Avg Reply Rate" value="7.9%" delta="+0.6%" icon={Reply} accent="amber" />
          <StatCard label="Positive Reply Rate" value="2.4%" delta="+0.3%" icon={TrendingUp} accent="emerald" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <h3 className="font-semibold text-slate-900">Campaign Comparison</h3>
            <p className="text-sm text-slate-500">Open rate (%) vs reply rate (%) by campaign</p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignComparison} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="opens" fill="#6366f1" radius={[6, 6, 0, 0]} name="Open Rate %" />
                  <Bar dataKey="replies" fill="#34d399" radius={[6, 6, 0, 0]} name="Reply Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">Inbox Placement</h3>
            <p className="text-sm text-slate-500">Where your emails are landing</p>
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deliverability} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {deliverability.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend verticalAlign="bottom" height={30} iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <h3 className="font-semibold text-slate-900">Weekly Volume</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceSeries} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="sent" fill="#c7d2fe" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="clicks" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-slate-900">Conversion Funnel</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Funnel dataKey="value" data={funnel} isAnimationActive>
                    {funnel.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                    <LabelList position="right" dataKey="stage" stroke="none" fill="#475569" fontSize={12} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
