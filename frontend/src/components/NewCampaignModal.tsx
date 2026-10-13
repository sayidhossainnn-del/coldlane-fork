import { useState } from "react";
import { X, Upload, Sparkles, Users, Mail } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./ui";
import { leadLists, emailAccounts } from "../data/mock";

export default function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">Create New Campaign</h3>
            <p className="text-xs text-slate-400">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Campaign name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q2 Enterprise Outreach"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5 text-center">
                <Sparkles className="mx-auto mb-2 text-indigo-500" size={22} />
                <p className="text-sm font-semibold text-slate-700">Let AI draft your sequence</p>
                <p className="mt-1 text-xs text-slate-500">Describe your offer and audience — generate a 4-step sequence instantly.</p>
                <textarea
                  rows={2}
                  placeholder="We help B2B SaaS companies automate cold outbound..."
                  className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Users size={15} /> Select a lead list
              </p>
              {leadLists.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-400">{l.leads.toLocaleString()} leads · {l.verified.toLocaleString()} verified</p>
                  </div>
                  <input type="radio" name="list" className="h-4 w-4 accent-indigo-600" />
                </label>
              ))}
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
                <Upload size={15} /> Upload a new CSV list
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail size={15} /> Choose sending accounts
              </p>
              {emailAccounts.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{a.email}</p>
                    <p className="text-xs text-slate-400">Warmup score {a.warmupScore}% · {a.dailyLimit}/day limit</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 accent-indigo-600" defaultChecked={a.health !== "Paused"} disabled={a.health === "Paused"} />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <SecondaryButton onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
            {step > 1 ? "Back" : "Cancel"}
          </SecondaryButton>
          <PrimaryButton onClick={() => (step < 3 ? setStep(step + 1) : onClose())}>
            {step < 3 ? "Continue" : "Create Campaign"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
