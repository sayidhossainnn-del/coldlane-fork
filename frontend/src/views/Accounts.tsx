import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Badge, Button, Progress, Icon, Modal, Field, inputCls, Toggle, Avatar } from "../components/ui";
import * as api from "../lib/api";
import type { RawMailboxFull } from "../lib/api";
import type { Mailbox } from "../lib/data";

const statusTone: Record<string, string> = { healthy: "emerald", warming: "amber", paused: "slate", error: "rose" };
const statusLabel: Record<string, string> = { healthy: "Sending", warming: "Warming up", paused: "Paused", error: "Action needed" };

const SECURITY_LABEL: Record<string, string> = { starttls: "STARTTLS", ssl: "SSL", none: "None" };

export function Accounts({ toast }: { toast: (m: string, t?: string) => void }) {
  const [rows, setRows] = useState<RawMailboxFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", host: "", port: "587", password: "" });

  const boxes = useMemo<Mailbox[]>(() => rows.map(api.toMailbox), [rows]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api
      .listMailboxRows()
      .then((data) => {
        setRows(data);
        setExpanded((cur) => cur ?? (data[0] ? String(data[0].id) : null));
        return data;
      })
      .catch((err) => {
        setLoadError(api.errorMessage(err));
        return [] as RawMailboxFull[];
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalSent = boxes.reduce((a, b) => a + b.sentToday, 0);
  const totalLimit = boxes.reduce((a, b) => a + b.dailyLimit, 0);
  const sendingCount = boxes.filter((b) => b.status === "healthy" || b.status === "warming").length;
  const errorCount = boxes.filter((b) => b.status === "error").length;

  const toggle = (row: RawMailboxFull) => {
    const id = String(row.id);
    const call = row.paused_reason || !row.active ? api.resumeMailbox(id) : api.pauseMailbox(id);
    call
      .then((updated) => {
        setRows((prev) => prev.map((r) => (String(r.id) === id ? { ...r, ...updated } : r)));
        toast(updated.paused_reason || !updated.active ? "Mailbox paused" : "Mailbox active", "brand");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"));
  };

  const test = (row: RawMailboxFull) => {
    const id = String(row.id);
    if (testingId) return;
    setTestingId(id);
    api
      .testMailbox(id)
      .then(({ ok, results }) => {
        const failures = results.filter((r) => r.includes("FAILED"));
        toast(ok ? `Connection OK · ${results.join(" · ")}` : failures.join(" · ") || "Connection failed", ok ? "emerald" : "rose");
        load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setTestingId(null));
  };

  const connect = () => {
    const email = form.email.trim().toLowerCase();
    const host = form.host.trim();
    if (!email || !host) {
      toast("Email address and SMTP host are required.", "rose");
      return;
    }
    if (!form.password) {
      toast("App password is required to connect this mailbox.", "rose");
      return;
    }
    api
      .createMailbox({
        from_email: email,
        smtp_host: host,
        smtp_port: Number(form.port) || 587,
        smtp_user: email,
        smtp_password: form.password,
      })
      .then((created) => {
        setConnectOpen(false);
        setForm({ email: "", host: "", port: "587", password: "" });
        toast("Account connected", "emerald");
        load().then(() => setExpanded(created.id));
      })
      .catch((err) => toast(api.errorMessage(err), "rose"));
  };

  const summary = [
    { l: "Connected inboxes", v: boxes.length.toString(), s: `${sendingCount} sending now`, i: "at", c: "text-brand-300 bg-brand-500/10" },
    { l: "Sent today", v: `${totalSent}/${totalLimit}`, s: `${totalLimit ? Math.round((totalSent / totalLimit) * 100) : 0}% of daily cap`, i: "send", c: "text-sky-300 bg-sky-500/10" },
    // No health score exists in the API: that summary card is hidden.
    { l: "Needs attention", v: errorCount.toString(), s: "Recent send failures", i: "bell", c: "text-rose-300 bg-rose-500/10" },
  ];

  return (
    <div className="space-y-5">
      {loading && (
        <Card className="grid place-items-center py-16">
          <p className="text-[12px] text-slate-500">Loading accounts…</p>
        </Card>
      )}
      {loadError && (
        <Card className="grid place-items-center py-16 text-center">
          <p className="text-[12px] text-slate-400">{loadError}</p>
          <button onClick={() => load()} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
        </Card>
      )}

      {!loading && !loadError && (
        <>
          {/* summary */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map((k) => (
              <Card key={k.l} className="flex items-center gap-3.5">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${k.c}`}><Icon name={k.i} className="h-5 w-5" /></span>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{k.l}</p>
                  <p className="text-xl font-semibold leading-tight tracking-tight text-white">{k.v}</p>
                  <p className="text-[11px] text-slate-500">{k.s}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-white">Sending accounts</h3>
                <p className="mt-0.5 text-xs text-slate-500">Rotating volume across inboxes protects your domain reputation</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="default" icon="refresh" onClick={() => load().then(() => toast("Accounts refreshed", "sky"))}>Sync all</Button>
                <Button variant="primary" icon="plus" onClick={() => setConnectOpen(true)}>Connect account</Button>
              </div>
            </div>

            <div className="space-y-2.5">
              {boxes.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-[12.5px] text-slate-500">
                  No sending accounts connected yet. Connect one to start warming up.
                </p>
              )}
              {boxes.map((b, i) => {
                const row = rows[i];
                return (
                <div key={b.id} className={`rounded-xl border transition ${expanded === b.id ? "border-brand-500/40 bg-brand-500/[0.04]" : "border-ink-700/70 bg-ink-850/40 hover:border-ink-600"}`}>
                  {/* div, not button: it contains the Toggle button (nested buttons are invalid HTML). */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(expanded === b.id ? null : b.id); } }}
                    className="flex w-full cursor-pointer items-center gap-4 p-4 text-left focus-visible:outline-2 focus-visible:outline-brand-400"
                  >
                    <Avatar name={b.email.split("@")[0]} hue={(b.email.charCodeAt(1) * 11) % 360} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13.5px] font-medium text-white">{b.email}</p>
                        <Badge tone={statusTone[b.status]} dot>{statusLabel[b.status]}</Badge>
                      </div>
                      {/* No per-mailbox campaign count or warmup-day counter exists: hidden. */}
                      <p className="mt-0.5 text-[11px] text-slate-500">{b.provider}</p>
                    </div>

                    <div className="hidden w-40 shrink-0 md:block">
                      <div className="mb-1 flex justify-between text-[10.5px]"><span className="text-slate-500">Today</span><span className="text-slate-300">{b.sentToday}/{b.dailyLimit}</span></div>
                      <Progress value={b.dailyLimit ? (b.sentToday / b.dailyLimit) * 100 : 0} tone={b.dailyLimit && b.sentToday / b.dailyLimit > 0.85 ? "amber" : "brand"} />
                    </div>
                    {/* No health score or open-rate tracking exists in the API: hidden. */}
                    <div onClick={(e) => { e.stopPropagation(); toggle(row); }}>
                      <Toggle on={b.status === "healthy" || b.status === "warming"} />
                    </div>
                    <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-600 transition ${expanded === b.id ? "rotate-180" : ""}`} />
                  </div>

                  {expanded === b.id && (
                    <div className="animate-fade-in border-t border-ink-700/70 p-4">
                      <div className="grid gap-4 lg:grid-cols-4">
                        <div className="space-y-3 lg:col-span-3">
                          <div className="grid gap-2.5 sm:grid-cols-3">
                            {([
                              ["SMTP", row.smtp_host && row.smtp_port ? `${row.smtp_host}:${row.smtp_port}` : "Not configured", row.smtp_host ? "brand" : "emerald"],
                              ["IMAP", row.imap_host && row.imap_port ? `${row.imap_host}:${row.imap_port}` : "Not configured", row.imap_host ? "brand" : "emerald"],
                              ["SMTP security", SECURITY_LABEL[row.smtp_security] ?? row.smtp_security, "emerald"],
                              ["Daily cap", `${row.daily_cap}/day`, "emerald"],
                              ["Sent today", String(row.today_sent), "emerald"],
                              ["Sender address", row.sender_address || "Not set", row.sender_address ? "emerald" : "brand"],
                              ...(row.last_error ? [["Last error", row.last_error, "brand"] as [string, string, string]] : []),
                            ]).map(([k, v, t]) => (
                              <div key={k} className="rounded-lg border border-ink-700/70 bg-ink-900/50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                                <p className="mt-0.5 flex items-start gap-1.5 text-[12.5px] font-medium text-slate-200">
                                  <Icon name={t === "emerald" ? "check" : "link"} className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${t === "emerald" ? "text-emerald-400" : "text-brand-300"}`} />
                                  <span className="min-w-0 break-words">{v}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                          {/* DNS records, warmup ramp and pool settings have no API: hidden. */}
                        </div>

                        <div className="space-y-2">
                          <Button variant="default" icon="refresh" size="sm" className="w-full justify-start" disabled={testingId === b.id} onClick={() => test(row)}>
                            {testingId === b.id ? "Testing…" : "Test connection"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </Card>

          {/* Domain setup checklist and warmup settings cards: no API backs them — hidden. */}

          <Modal
            open={connectOpen}
            onClose={() => setConnectOpen(false)}
            title="Connect an email account"
            footer={
              <>
                <Button variant="default" onClick={() => setConnectOpen(false)}>Cancel</Button>
                <Button variant="primary" icon="link" onClick={connect}>Connect</Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  ["Google Workspace", "smtp.gmail.com", "587", "globe"],
                  ["Microsoft 365", "smtp.office365.com", "587", "mail"],
                  ["IMAP / SMTP", "", "", "code"],
                ] as [string, string, string, string][]).map(([n, h, p, icon]) => (
                  <button
                    key={n}
                    onClick={() => setForm((f) => ({ ...f, host: h, port: p || f.port }))}
                    className="flex flex-col items-start gap-1.5 rounded-xl border border-ink-600 bg-ink-900/60 p-3.5 text-left transition hover:border-brand-500/50 hover:bg-brand-500/[0.06]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-slate-300"><Icon name={icon} className="h-4 w-4" /></span>
                    <p className="text-[12.5px] font-medium text-white">{n}</p>
                    <p className="text-[10.5px] text-slate-500">{h || "Enter host below"}</p>
                  </button>
                ))}
              </div>
              <Field label="Email address"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@yourdomain.com" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SMTP host"><input className={inputCls} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.gmail.com" /></Field>
                <Field label="Port"><input className={inputCls} value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="587" /></Field>
              </div>
              <Field label="App password">
                <input className={inputCls} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••••••" />
              </Field>
              <div className="rounded-lg bg-brand-500/[0.07] p-3 text-[11.5px] text-brand-100 ring-1 ring-inset ring-brand-500/20">
                <b>Tip:</b> Start warmup immediately after connecting and wait 14 days before sending campaigns from this inbox.
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
