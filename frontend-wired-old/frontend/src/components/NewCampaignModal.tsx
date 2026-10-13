import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Users, Mail } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./ui";
import type { EmailAccount } from "../data/mock";
import * as api from "../lib/api";

export default function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listMailboxes()
      .then(setAccounts)
      .catch((err) => api.toastError(err));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function create() {
    if (!name.trim()) {
      api.toast("Campaign name is required.", "error");
      return;
    }
    setSaving(true);
    api
      .createCampaign({
        name: name.trim(),
        // Schedule defaults (the wizard has no schedule step yet).
        timezone: "UTC",
        days: [0, 1, 2, 3, 4],
        window_start: 9,
        window_end: 17,
        mailbox_ids: [...selected].map((id) => api.toId(id)),
        steps: [],
      })
      .then((detail) => {
        api.toast("Draft campaign created.", "success");
        onCreated();
        navigate(`/campaigns/${detail.campaign.id}`);
      })
      .catch((err) => api.toastError(err))
      .finally(() => setSaving(false));
  }

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
              {/* TODO(feature): AI sequence generator — no endpoint drafts whole sequences */}
              <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
                <Users className="mx-auto mb-2 text-slate-400" size={22} />
                <p className="text-sm font-semibold text-slate-700">Add your steps next</p>
                <p className="mt-1 text-xs text-slate-500">
                  The draft opens in the sequence editor, where you write each email and its A/B variants.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {/* TODO(feature): lead lists — leads are imported per campaign from the Leads page */}
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail size={15} /> Add leads after creating
              </p>
              <p className="text-sm text-slate-500">
                Leads are imported per campaign (CSV with a lawful-basis confirmation) from the Leads page, so this
                draft starts empty.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail size={15} /> Choose sending accounts
              </p>
              {accounts.length === 0 && (
                <p className="text-sm text-slate-500">
                  No mailboxes yet — connect one on the Email Accounts page first.
                </p>
              )}
              {accounts.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{a.email}</p>
                    <p className="text-xs text-slate-400">
                      {a.dailyLimit}/day limit{a.pausedReason ? " · paused" : ""}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    disabled={!a.active || !!a.pausedReason}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>
              ))}
              {/* TODO(feature): uploading a list here — CSV import lives on the Leads page */}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <SecondaryButton onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
            {step > 1 ? "Back" : "Cancel"}
          </SecondaryButton>
          <PrimaryButton onClick={() => (step < 3 ? setStep(step + 1) : create())}>
            {saving ? "Creating…" : step < 3 ? "Continue" : "Create Campaign"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
