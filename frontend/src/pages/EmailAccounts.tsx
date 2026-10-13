import { useCallback, useEffect, useState } from "react";
import { Plus, Mail, Flame, ShieldCheck, Settings2, Pause, Play, PlugZap, X } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, SecondaryButton, StatCard } from "../components/ui";
import type { EmailAccount } from "../data/mock";
import * as api from "../lib/api";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelClass = "text-xs font-semibold text-slate-500";
const rowButtonClass = "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700";

interface EditorState {
  id?: string;
  label: string;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string; // blank on edit = keep the stored password (never sent, never shown)
  smtpSecurity: "starttls" | "ssl" | "none";
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPassword: string;
  dailyCap: string;
  senderAddress: string;
  signature: string;
  active: boolean;
  hasSmtpPassword: boolean;
  hasImapPassword: boolean;
}

const emptyEditor = (): EditorState => ({
  label: "",
  fromName: "",
  fromEmail: "",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  smtpSecurity: "starttls",
  imapHost: "",
  imapPort: "993",
  imapUser: "",
  imapPassword: "",
  dailyCap: "30",
  senderAddress: "",
  signature: "",
  active: true,
  hasSmtpPassword: false,
  hasImapPassword: false,
});

const editorFrom = (account: EmailAccount): EditorState => ({
  ...emptyEditor(),
  id: account.id,
  label: account.label ?? "",
  fromName: account.fromName ?? "",
  fromEmail: account.fromEmail ?? account.email,
  smtpHost: account.smtpHost ?? "",
  smtpPort: String(account.smtpPort ?? 587),
  smtpUser: account.smtpUser ?? "",
  smtpSecurity: account.smtpSecurity ?? "starttls",
  imapHost: account.imapHost ?? "",
  imapPort: String(account.imapPort ?? 993),
  imapUser: account.imapUser ?? "",
  dailyCap: String(account.dailyLimit),
  senderAddress: account.senderAddress ?? "",
  signature: account.signature ?? "",
  active: account.active ?? true,
  hasSmtpPassword: !!account.hasSmtpPassword,
  hasImapPassword: !!account.hasImapPassword,
});

export default function EmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .listMailboxes()
      .then(setAccounts)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load mailboxes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function save() {
    if (!editor || saving) return;
    setSaving(true);
    // Passwords are write-only: only sent when the user actually typed a new one.
    const base = {
      label: editor.label,
      from_name: editor.fromName,
      from_email: editor.fromEmail,
      smtp_host: editor.smtpHost,
      smtp_port: Number(editor.smtpPort) || 0,
      smtp_user: editor.smtpUser,
      smtp_security: editor.smtpSecurity,
      imap_host: editor.imapHost,
      imap_port: Number(editor.imapPort) || 0,
      imap_user: editor.imapUser,
      daily_cap: Number(editor.dailyCap) || 0,
      sender_address: editor.senderAddress,
      signature: editor.signature,
      active: editor.active,
    };
    const withPasswords = {
      ...base,
      ...(editor.smtpPassword ? { smtp_password: editor.smtpPassword } : {}),
      ...(editor.imapPassword ? { imap_password: editor.imapPassword } : {}),
    };
    const request = editor.id
      ? api.updateMailbox(editor.id, withPasswords)
      : api.createMailbox(withPasswords);
    request
      .then((saved) => {
        setAccounts((prev) => (editor.id ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved]));
        api.toast(editor.id ? "Mailbox saved." : "Mailbox connected.", "success");
        setEditor(null);
      })
      .catch((err) => api.toastError(err))
      .finally(() => setSaving(false));
  }

  function test(id: string) {
    setBusyId(id);
    api
      .testMailbox(id)
      .then(({ ok, results, mailbox }) => {
        api.toast(results.join("\n") || (ok ? "Connection OK." : "Connection failed."), ok ? "success" : "error");
        setAccounts((prev) => prev.map((a) => (a.id === id ? api.toMailbox(mailbox) : a)));
      })
      .catch((err) => api.toastError(err))
      .finally(() => setBusyId(null));
  }

  function togglePause(account: EmailAccount) {
    const paused = !!account.pausedReason || !account.active;
    setBusyId(account.id);
    const request = paused ? api.resumeMailbox(account.id) : api.pauseMailbox(account.id);
    request
      .then((updated) => {
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        api.toast(paused ? "Mailbox resumed." : "Mailbox paused.", "success");
      })
      .catch((err) => api.toastError(err))
      .finally(() => setBusyId(null));
  }

  const sentToday = accounts.reduce((sum, a) => sum + (a.sentToday || 0), 0);
  const capacity = accounts.reduce((sum, a) => sum + (a.effectiveCap ?? a.dailyLimit ?? 0), 0);

  return (
    <>
      <Topbar
        title="Email Accounts"
        subtitle="Connect and warm up sending accounts to protect deliverability"
        actions={<PrimaryButton icon={Plus} onClick={() => setEditor(emptyEditor())}>Connect Account</PrimaryButton>}
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        {/* TODO(feature): average warmup score and inbox placement — ColdLane reports neither */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Connected Accounts" value={String(accounts.length)} icon={Mail} accent="indigo" />
          <StatCard label="Sent Today" value={String(sentToday)} icon={Flame} accent="amber" />
          <StatCard label="Daily Capacity" value={String(capacity)} icon={ShieldCheck} accent="emerald" />
        </div>

        {/* TODO(feature): warmup progress chart — ColdLane has no warmup */}

        {loading && <p className="text-sm text-slate-400">Loading mailboxes…</p>}
        {loadError && (
          <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{loadError}</p>
            <button onClick={load} className="mt-1 font-semibold underline">Retry</button>
          </Card>
        )}
        {!loading && !loadError && accounts.length === 0 && (
          <p className="text-sm text-slate-400">No sending accounts yet — connect your first mailbox.</p>
        )}

        {!loadError && accounts.length > 0 && (
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
                        <div>
                          <span className="font-semibold text-slate-800">{a.email}</span>
                          <p className="text-xs text-slate-400">{a.label}{a.pausedReason ? ` · ${a.pausedReason}` : ""}{!a.active ? " · inactive" : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-slate-500">{a.provider}</td>
                    <td className="px-3 py-4 text-slate-400">
                      {/* TODO(feature): health score — the API reports active/paused/fail_count only */}
                      —
                    </td>
                    <td className="px-3 py-4 text-slate-400">
                      {/* TODO(feature): warmup score — ColdLane has no warmup */}
                      —
                    </td>
                    <td className="px-3 py-4 text-slate-500">
                      {a.sentToday}/{a.dailyLimit} sent
                    </td>
                    <td className="px-3 py-4 text-slate-400">
                      {/* TODO(feature): warmup toggle — ColdLane has no warmup */}
                      —
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => test(a.id)}
                          disabled={busyId === a.id}
                          title="Test connection"
                          className={rowButtonClass}
                        >
                          <PlugZap size={15} />
                        </button>
                        <button
                          onClick={() => togglePause(a)}
                          disabled={busyId === a.id}
                          title={a.pausedReason || !a.active ? "Resume" : "Pause"}
                          className={rowButtonClass}
                        >
                          {a.pausedReason || !a.active ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                        <button
                          onClick={() => setEditor(editorFrom(a))}
                          title="Edit mailbox"
                          className={rowButtonClass}
                        >
                          <Settings2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        )}
      </main>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">{editor.id ? "Edit Mailbox" : "Connect Account"}</h3>
              <button onClick={() => setEditor(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Label</label>
                  <input value={editor.label} onChange={(e) => setEditor({ ...editor, label: e.target.value })}
                    placeholder="Sales mailbox" className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>From name</label>
                  <input value={editor.fromName} onChange={(e) => setEditor({ ...editor, fromName: e.target.value })}
                    placeholder="Sam Sender" className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>From email</label>
                  <input value={editor.fromEmail} onChange={(e) => setEditor({ ...editor, fromEmail: e.target.value })}
                    placeholder="sam@agency.com" className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>Daily cap</label>
                  <input type="number" value={editor.dailyCap} onChange={(e) => setEditor({ ...editor, dailyCap: e.target.value })}
                    className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>SMTP host</label>
                  <input value={editor.smtpHost} onChange={(e) => setEditor({ ...editor, smtpHost: e.target.value })}
                    placeholder="smtp.mailgun.org" className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>SMTP port</label>
                  <input type="number" value={editor.smtpPort} onChange={(e) => setEditor({ ...editor, smtpPort: e.target.value })}
                    className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>SMTP security</label>
                  <select value={editor.smtpSecurity}
                    onChange={(e) => setEditor({ ...editor, smtpSecurity: e.target.value as EditorState["smtpSecurity"] })}
                    className={`mt-1 ${inputClass}`}>
                    <option value="starttls">STARTTLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>SMTP user</label>
                  <input value={editor.smtpUser} onChange={(e) => setEditor({ ...editor, smtpUser: e.target.value })}
                    className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>SMTP password</label>
                  <input type="password" autoComplete="new-password" value={editor.smtpPassword}
                    onChange={(e) => setEditor({ ...editor, smtpPassword: e.target.value })}
                    placeholder={editor.hasSmtpPassword ? "•••••••• (saved)" : "Required"}
                    className={`mt-1 ${inputClass}`} />
                  {editor.id && <p className="mt-1 text-xs text-slate-400">Leave blank to keep the saved password.</p>}
                </div>
                <div>
                  <label className={labelClass}>IMAP host</label>
                  <input value={editor.imapHost} onChange={(e) => setEditor({ ...editor, imapHost: e.target.value })}
                    placeholder="Defaults to the SMTP host" className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>IMAP port</label>
                  <input type="number" value={editor.imapPort} onChange={(e) => setEditor({ ...editor, imapPort: e.target.value })}
                    className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>IMAP user</label>
                  <input value={editor.imapUser} onChange={(e) => setEditor({ ...editor, imapUser: e.target.value })}
                    placeholder="Defaults to the SMTP user" className={`mt-1 ${inputClass}`} />
                </div>
                <div>
                  <label className={labelClass}>IMAP password</label>
                  <input type="password" autoComplete="new-password" value={editor.imapPassword}
                    onChange={(e) => setEditor({ ...editor, imapPassword: e.target.value })}
                    placeholder={editor.hasImapPassword ? "Leave blank to keep" : "Required"}
                    className={`mt-1 ${inputClass}`} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Sender postal address (footer)</label>
                  <input value={editor.senderAddress} onChange={(e) => setEditor({ ...editor, senderAddress: e.target.value })}
                    placeholder="12 Test Street, Testville, CA 90000, USA" className={`mt-1 ${inputClass}`} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Signature</label>
                  <textarea rows={3} value={editor.signature} onChange={(e) => setEditor({ ...editor, signature: e.target.value })}
                    className={`mt-1 ${inputClass}`} />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={editor.active} onChange={(e) => setEditor({ ...editor, active: e.target.checked })}
                    className="h-4 w-4 accent-indigo-600" />
                  Active (may send)
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <SecondaryButton onClick={() => setEditor(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={save}>{saving ? "Saving…" : editor.id ? "Save Mailbox" : "Connect Account"}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
