import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Clock,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
  Variable,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, SecondaryButton, StatCard, StatusBadge, Pill } from "../components/ui";
import { campaigns, leads } from "../data/mock";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type Tab = "sequence" | "leads" | "schedule" | "analytics";

interface Step {
  id: number;
  type: "email" | "wait";
  subject?: string;
  body?: string;
  waitDays?: number;
}

const initialSteps: Step[] = [
  {
    id: 1,
    type: "email",
    subject: "Quick question about {{company}}'s outbound",
    body: "Hi {{firstName}},\n\nNoticed {{company}} has been scaling the GTM team recently — curious how you're currently handling cold outbound personalization at volume?\n\nWorth a quick chat?\n\nBest,\n{{senderName}}",
  },
  { id: 2, type: "wait", waitDays: 3 },
  {
    id: 3,
    type: "email",
    subject: "Re: Quick question about {{company}}'s outbound",
    body: "Hi {{firstName}}, just floating this back to the top of your inbox in case it got buried. Happy to share a quick case study if useful.",
  },
  { id: 4, type: "wait", waitDays: 4 },
  {
    id: 5,
    type: "email",
    subject: "Should I close the loop?",
    body: "Hi {{firstName}}, haven't heard back so I'll assume now isn't the right time. If priorities shift, I'm happy to reconnect down the line!",
  },
];

export default function CampaignDetail() {
  const { id } = useParams();
  const campaign = campaigns.find((c) => c.id === id) ?? campaigns[0];
  const [tab, setTab] = useState<Tab>("sequence");
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [activeStep, setActiveStep] = useState<number>(1);

  const campaignLeads = leads.filter((l) => l.campaign === campaign.name).concat(leads.slice(0, 6));

  function addEmailStep() {
    const newId = Math.max(...steps.map((s) => s.id)) + 1;
    setSteps([...steps, { id: newId, type: "email", subject: "New follow-up", body: "Write your message..." }]);
  }
  function addWaitStep() {
    const newId = Math.max(...steps.map((s) => s.id)) + 1;
    setSteps([...steps, { id: newId, type: "wait", waitDays: 2 }]);
  }
  function removeStep(id: number) {
    setSteps(steps.filter((s) => s.id !== id));
  }

  const activeEmail = steps.find((s) => s.id === activeStep && s.type === "email");

  return (
    <>
      <Topbar
        title={campaign.name}
        subtitle={`Created ${campaign.createdAt} · ${campaign.leads.toLocaleString()} leads`}
        actions={<StatusBadge status={campaign.status} />}
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600">
          <ArrowLeft size={14} /> Back to campaigns
        </Link>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Sent" value={campaign.sent.toLocaleString()} icon={Mail} accent="indigo" />
          <StatCard label="Open Rate" value={campaign.sent ? `${((campaign.opens / campaign.sent) * 100).toFixed(1)}%` : "0%"} icon={Mail} accent="violet" />
          <StatCard label="Reply Rate" value={campaign.sent ? `${((campaign.replies / campaign.sent) * 100).toFixed(1)}%` : "0%"} icon={Mail} accent="amber" />
          <StatCard label="Interested" value={String(campaign.interested)} icon={Mail} accent="emerald" />
        </div>

        <div className="flex gap-1.5 border-b border-slate-200">
          {([
            ["sequence", "Sequence"],
            ["leads", "Leads"],
            ["schedule", "Schedule & Settings"],
            ["analytics", "Analytics"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "sequence" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Sequence Steps</h4>
                <Pill>{steps.filter((s) => s.type === "email").length} emails</Pill>
              </div>
              <div className="mt-4 space-y-2">
                {steps.map((s, i) =>
                  s.type === "email" ? (
                    <button
                      key={s.id}
                      onClick={() => setActiveStep(s.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${
                        activeStep === s.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <GripVertical size={14} className="shrink-0 text-slate-300" />
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{s.subject}</p>
                        <p className="text-xs text-slate-400">Email step</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStep(s.id);
                        }}
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </button>
                  ) : (
                    <div key={s.id} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500">
                      <Clock size={13} />
                      Wait {s.waitDays} day{s.waitDays !== 1 ? "s" : ""}
                      <button onClick={() => removeStep(s.id)} className="ml-auto text-slate-300 hover:text-rose-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <SecondaryButton icon={Plus} onClick={addEmailStep} className="justify-center">
                  Email
                </SecondaryButton>
                <SecondaryButton icon={Clock} onClick={addWaitStep} className="justify-center">
                  Delay
                </SecondaryButton>
              </div>
            </Card>

            <Card className="p-5">
              {activeEmail ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">Editing step {steps.findIndex((s) => s.id === activeEmail.id) + 1}</h4>
                    <button className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                      <Sparkles size={13} /> AI Rewrite
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Subject line</label>
                      <input
                        value={activeEmail.subject}
                        onChange={(e) =>
                          setSteps(steps.map((s) => (s.id === activeEmail.id ? { ...s, subject: e.target.value } : s)))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
                        {[Bold, Italic, Link2, ImageIcon].map((Icon, idx) => (
                          <button key={idx} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Icon size={14} />
                          </button>
                        ))}
                        <span className="mx-1 h-4 w-px bg-slate-200" />
                        <button className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                          <Variable size={13} /> Insert variable
                        </button>
                      </div>
                      <textarea
                        value={activeEmail.body}
                        onChange={(e) =>
                          setSteps(steps.map((s) => (s.id === activeEmail.id ? { ...s, body: e.target.value } : s)))
                        }
                        rows={12}
                        className="w-full resize-none px-3 py-3 text-sm text-slate-700 outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["{{firstName}}", "{{lastName}}", "{{company}}", "{{title}}", "{{senderName}}"].map((v) => (
                        <Pill key={v} className="font-mono text-[11px]">{v}</Pill>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-slate-400">
                  Select an email step to edit its content
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === "leads" && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Email</th>
                    <th className="px-3 py-3 font-semibold">Company</th>
                    <th className="px-3 py-3 font-semibold">Title</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignLeads.slice(0, 10).map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-800">{l.name}</td>
                      <td className="px-3 py-3 text-slate-500">{l.email}</td>
                      <td className="px-3 py-3 text-slate-500">{l.company}</td>
                      <td className="px-3 py-3 text-slate-500">{l.title}</td>
                      <td className="px-3 py-3">
                        <LeadStatusPill status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "schedule" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h4 className="font-semibold text-slate-800">Sending Schedule</h4>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Start time</label>
                    <input type="time" defaultValue="08:00" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">End time</label>
                    <input type="time" defaultValue="17:30" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Active days</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => (
                      <button
                        key={d}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          idx < 5 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Timezone</label>
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400">
                    <option>America/New_York (EST)</option>
                    <option>America/Los_Angeles (PST)</option>
                    <option>Europe/London (GMT)</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h4 className="font-semibold text-slate-800">Sending Options</h4>
              <div className="mt-4 space-y-4">
                <ToggleRow label="Stop on reply" desc="Automatically stop sequence when a lead replies" defaultChecked />
                <ToggleRow label="Auto-pause on bounce threshold" desc="Pause campaign if bounce rate exceeds 5%" defaultChecked />
                <ToggleRow label="Open tracking" desc="Track email opens using a tracking pixel" defaultChecked />
                <ToggleRow label="Click tracking" desc="Track link clicks within emails" />
                <ToggleRow label="Text-only mode" desc="Send as plain text to improve deliverability" />
                <div>
                  <label className="text-xs font-semibold text-slate-500">Daily sending limit per account</label>
                  <input type="number" defaultValue={40} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "analytics" && (
          <Card className="p-5">
            <h4 className="font-semibold text-slate-800">Engagement Over Time</h4>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { day: "W1", opens: 120, replies: 12 },
                    { day: "W2", opens: 240, replies: 28 },
                    { day: "W3", opens: 410, replies: 45 },
                    { day: "W4", opens: 580, replies: 61 },
                    { day: "W5", opens: 690, replies: 80 },
                  ]}
                  margin={{ left: -20, right: 10 }}
                >
                  <defs>
                    <linearGradient id="o2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="opens" stroke="#6366f1" fill="url(#o2)" strokeWidth={2} />
                  <Area type="monotone" dataKey="replies" stroke="#34d399" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}

function LeadStatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "Not Contacted": "bg-slate-100 text-slate-600",
    Contacted: "bg-indigo-50 text-indigo-700",
    Opened: "bg-violet-50 text-violet-700",
    Replied: "bg-amber-50 text-amber-700",
    Interested: "bg-emerald-50 text-emerald-700",
    Bounced: "bg-rose-50 text-rose-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{status}</span>;
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}
