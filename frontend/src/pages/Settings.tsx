import { useState } from "react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, SecondaryButton, Pill } from "../components/ui";
import { User, CreditCard, Users, Webhook, Shield, Bell, Check } from "lucide-react";

const tabs = [
  { key: "profile", label: "Profile", icon: User },
  { key: "team", label: "Team", icon: Users },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "integrations", label: "Integrations", icon: Webhook },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
];

const plans = [
  { name: "Starter", price: "$37", seats: "1 seat", features: ["1,000 contacted leads/mo", "2 email accounts", "Basic analytics"] },
  { name: "Growth", price: "$97", seats: "3 seats", features: ["25,000 contacted leads/mo", "Unlimited email accounts", "AI email writer", "Warmup included"], highlight: true },
  { name: "Scale", price: "$249", seats: "10 seats", features: ["Unlimited leads", "Dedicated IP pool", "Advanced analytics", "Priority support"] },
];

const integrations = [
  { name: "HubSpot", desc: "Sync leads and replies to your CRM", connected: true },
  { name: "Salesforce", desc: "Two-way contact and opportunity sync", connected: false },
  { name: "Slack", desc: "Get notified of replies in real time", connected: true },
  { name: "Zapier", desc: "Connect to 5,000+ apps", connected: false },
  { name: "Webhooks", desc: "Send events to a custom endpoint", connected: false },
];

const team = [
  { name: "Jordan Diaz", email: "jordan@outreachly.io", role: "Owner" },
  { name: "Amy Nolan", email: "amy@outreachly.io", role: "Admin" },
  { name: "Sam Ortiz", email: "sam@outreachly.io", role: "Member" },
];

export default function Settings() {
  const [tab, setTab] = useState("profile");

  return (
    <>
      <Topbar title="Settings" subtitle="Manage your workspace, team, and billing" />
      <main className="flex-1 p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  tab === t.key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {tab === "profile" && (
              <Card className="p-6">
                <h3 className="font-semibold text-slate-900">Profile</h3>
                <div className="mt-5 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-xl font-semibold text-white">JD</div>
                  <SecondaryButton>Change photo</SecondaryButton>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name" defaultValue="Jordan Diaz" />
                  <Field label="Email" defaultValue="jordan@outreachly.io" />
                  <Field label="Company" defaultValue="Outreachly Inc." />
                  <Field label="Timezone" defaultValue="America/New_York" />
                </div>
                <div className="mt-6 flex justify-end">
                  <PrimaryButton>Save Changes</PrimaryButton>
                </div>
              </Card>
            )}

            {tab === "team" && (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h3 className="font-semibold text-slate-900">Team Members</h3>
                  <PrimaryButton>Invite Member</PrimaryButton>
                </div>
                <div className="divide-y divide-slate-50">
                  {team.map((m) => (
                    <div key={m.email} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {m.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.email}</p>
                        </div>
                      </div>
                      <Pill>{m.role}</Pill>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {tab === "billing" && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {plans.map((p) => (
                  <Card
                    key={p.name}
                    className={`p-6 ${p.highlight ? "ring-2 ring-indigo-500" : ""}`}
                  >
                    {p.highlight && <Pill className="mb-3 bg-indigo-100 text-indigo-700">Most popular</Pill>}
                    <h4 className="text-lg font-bold text-slate-900">{p.name}</h4>
                    <p className="mt-1 text-3xl font-bold text-slate-900">{p.price}<span className="text-sm font-medium text-slate-400">/mo</span></p>
                    <p className="text-xs text-slate-400">{p.seats}</p>
                    <ul className="mt-4 space-y-2">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                          <Check size={14} className="text-emerald-500" /> {f}
                        </li>
                      ))}
                    </ul>
                    {p.highlight ? (
                      <PrimaryButton className="mt-5 w-full justify-center">Current Plan</PrimaryButton>
                    ) : (
                      <SecondaryButton className="mt-5 w-full justify-center">Choose Plan</SecondaryButton>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {tab === "integrations" && (
              <Card className="divide-y divide-slate-50">
                {integrations.map((i) => (
                  <div key={i.name} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{i.name}</p>
                      <p className="text-xs text-slate-400">{i.desc}</p>
                    </div>
                    {i.connected ? (
                      <SecondaryButton>Connected</SecondaryButton>
                    ) : (
                      <PrimaryButton>Connect</PrimaryButton>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {tab === "security" && (
              <Card className="p-6 space-y-5">
                <h3 className="font-semibold text-slate-900">Security</h3>
                <Field label="Current password" type="password" defaultValue="" />
                <Field label="New password" type="password" defaultValue="" />
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Two-factor authentication</p>
                    <p className="text-xs text-slate-400">Add an extra layer of security to your account</p>
                  </div>
                  <SecondaryButton>Enable</SecondaryButton>
                </div>
                <div className="flex justify-end">
                  <PrimaryButton>Update Security</PrimaryButton>
                </div>
              </Card>
            )}

            {tab === "notifications" && (
              <Card className="divide-y divide-slate-50">
                {[
                  "Email me when a lead replies",
                  "Email me when a campaign finishes",
                  "Notify me on account health drops",
                  "Weekly performance summary",
                ].map((label, idx) => (
                  <div key={label} className="flex items-center justify-between px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <button className={`relative h-6 w-11 rounded-full transition ${idx !== 2 ? "bg-indigo-600" : "bg-slate-200"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${idx !== 2 ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Field({ label, defaultValue, type = "text" }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}
