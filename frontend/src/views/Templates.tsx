import { useEffect, useState } from "react";
import { Card, SectionTitle, Button, Icon, Field, inputCls, Avatar } from "../components/ui";
import * as api from "../lib/api";
import { firstNameVars } from "../lib/data";
import type { Template } from "../lib/data";

const emptyTemplate = (): Template => ({ id: "new", name: "", category: "", subject: "", body: "", used: 0, replyRate: 0, updated: "now" });

function wordStats(body: string) {
  const words = body.trim() ? body.trim().split(/\s+/).filter(Boolean).length : 0;
  const links = (body.match(/https?:\/\//g) ?? []).length;
  return `${words} words · ${links} link${links === 1 ? "" : "s"}`;
}

export function Templates({ toast }: { toast: (m: string, t?: string) => void }) {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sender, setSender] = useState<{ name: string; email: string } | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api
      .listTemplates()
      .then(setList)
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // The preview header shows a real connected mailbox as sender (never a fake person).
    api
      .listMailboxRows()
      .then((rows) => {
        const first = rows[0];
        if (first) setSender({ name: first.from_name || first.from_email.split("@")[0], email: first.from_email });
      })
      .catch(() => undefined);
  }, []);

  const shown = list.filter((t) => (t.name + t.subject).toLowerCase().includes(query.toLowerCase()));

  const save = () => {
    if (!editor || saving) return;
    const name = editor.name.trim();
    if (!name) {
      toast("Template name is required.", "rose");
      return;
    }
    setSaving(true);
    const payload = { name, subject: editor.subject, body: editor.body };
    const call = editor.id === "new" ? api.createTemplate(payload) : api.updateTemplate(editor.id, payload);
    call
      .then((saved) => {
        setList((l) => (editor.id === "new" ? [saved, ...l] : l.map((x) => (x.id === saved.id ? saved : x))));
        setEditor(null);
        toast("Template saved", "emerald");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSaving(false));
  };

  const duplicate = (t: Template) => {
    api
      .createTemplate({ name: `${t.name} (copy)`, subject: t.subject, body: t.body })
      .then((copy) => {
        setList((l) => [copy, ...l]);
        toast("Template duplicated", "brand");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"));
  };

  const remove = (t: Template) => {
    api
      .deleteTemplate(t.id)
      .then(() => {
        setList((l) => l.filter((x) => x.id !== t.id));
        toast("Template deleted", "rose");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…"
            className="h-9 w-60 rounded-lg border border-ink-700 bg-ink-900/70 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-brand-500/60" />
        </div>
        {/* Category filter tabs: the API has no template categories — hidden. */}
        <div className="ml-auto flex gap-2">
          {/* "Generate with AI": no template-generation endpoint — hidden. */}
          <Button variant="primary" icon="plus" onClick={() => setEditor(emptyTemplate())}>New template</Button>
        </div>
      </div>

      {loading && (
        <Card className="grid place-items-center py-16">
          <p className="text-[12px] text-slate-500">Loading templates…</p>
        </Card>
      )}
      {loadError && (
        <Card className="grid place-items-center py-16 text-center">
          <p className="text-[12px] text-slate-400">{loadError}</p>
          <button onClick={load} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
        </Card>
      )}
      {!loading && !loadError && shown.length === 0 && (
        <Card className="grid place-items-center py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-slate-500"><Icon name="template" className="h-6 w-6" /></div>
          <p className="mt-4 text-sm font-medium text-white">{list.length === 0 ? "No templates yet" : `No templates match “${query}”`}</p>
          <p className="mt-1 text-xs text-slate-500">{list.length === 0 ? "Create your first reusable email template." : "Try a different search."}</p>
        </Card>
      )}

      {!loading && !loadError && shown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <Card key={t.id} className="group flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-500/20"><Icon name="template" className="h-4 w-4" /></span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-white group-hover:text-brand-200">{t.name}</p>
                    {/* No category column exists: hidden. */}
                    <p className="text-[11px] text-slate-500">updated {t.updated}</p>
                  </div>
                </div>
                {/* No per-template reply rate exists: badge hidden. */}
              </div>

              <div className="mt-3.5 rounded-xl border border-ink-700/70 bg-ink-850/50 p-3">
                <p className="mb-1.5 text-[11px] font-medium text-slate-300">Subject</p>
                <p className="mb-2.5 font-mono text-[11.5px] text-brand-200">{t.subject || "(no subject)"}</p>
                <p className="mb-1.5 text-[11px] font-medium text-slate-300">Preview</p>
                <p className="line-clamp-4 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-500">{t.body}</p>
              </div>

              {/* Send count and reply rate have no API: stats row hidden. */}

              <div className="mt-3.5 flex gap-2 border-t border-ink-700/60 pt-3">
                <Button size="sm" variant="default" icon="edit" className="flex-1 justify-center" onClick={() => setEditor(t)}>Edit</Button>
                <Button size="sm" variant="ghost" icon="copy" onClick={() => duplicate(t)} />
                <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(t)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <SectionTitle title="Spam-word scan" sub="Avoid these to protect deliverability" />
        <div className="flex flex-wrap gap-2">
          {[["free", "rose"], ["guarantee", "rose"], ["act now", "rose"], ["limited time", "amber"], ["no obligation", "amber"], ["risk-free", "rose"], ["click here", "amber"], ["urgent", "amber"], ["100%", "rose"], ["cash", "amber"], ["offer expires", "rose"], ["dear friend", "rose"]].map(([w, t]) => (
            <span key={w} className={`rounded-lg px-2.5 py-1 text-[11.5px] ring-1 ring-inset ${t === "rose" ? "bg-rose-500/10 text-rose-300 ring-rose-500/25" : "bg-amber-500/10 text-amber-300 ring-amber-500/25"}`}>{w}</span>
          ))}
        </div>
      </Card>

      {/* editor modal */}
      {editor && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setEditor(null)} />
          <div className="relative flex h-[86vh] w-full max-w-6xl animate-pop overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-white">Template editor</h3>
                <button onClick={() => setEditor(null)} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="x" /></button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Template name"><input className={inputCls} value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} /></Field>
                  {/* Category select: no category column in the API — hidden. */}
                </div>
                <Field label="Subject line">
                  <input className={inputCls} value={editor.subject} onChange={(e) => setEditor({ ...editor, subject: e.target.value })} placeholder="{{first_name}}, quick idea for {{company}}" />
                </Field>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Body</span>
                    <div className="flex items-center gap-0.5 rounded-lg border border-ink-700 bg-ink-900 p-0.5">
                      {["bold", "italic", "link", "image", "code", "smile"].map((t) => (
                        <button key={t} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/[0.08] hover:text-white"><Icon name={t} className="h-3 w-3" /></button>
                      ))}
                    </div>
                  </div>
                  <textarea rows={14} value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                    className="w-full resize-y rounded-lg border border-ink-600 bg-ink-900/60 p-3.5 text-[13px] leading-relaxed text-slate-200 outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20" />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Personalisation</p>
                  <div className="flex flex-wrap gap-1.5">
                    {firstNameVars.map((v) => (
                      <button key={v} onClick={() => setEditor({ ...editor, body: editor.body + `{{${v}}}` })}
                        className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10.5px] text-brand-200 ring-1 ring-inset ring-white/10 hover:bg-brand-500/20">{`{{${v}}}`}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-[11.5px] text-slate-500">
                  <b className="text-slate-300">Length:</b> {wordStats(editor.body)}. Best practice is under 90 words for cold outreach.
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
                <Button variant="default" onClick={() => setEditor(null)}>Cancel</Button>
                <Button variant="primary" icon="check" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save template"}</Button>
              </div>
            </div>

            {/* preview side */}
            <div className="hidden w-[380px] shrink-0 flex-col border-l border-ink-700 bg-ink-900/60 lg:flex">
              <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
                <span className="text-[12.5px] font-medium text-white">Live preview</span>
                <div className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-0.5">
                  {(["desktop", "mobile"] as const).map((d) => (
                    <button key={d} onClick={() => setDevice(d)} className={`grid h-6 w-7 place-items-center rounded ${device === d ? "bg-white/[0.09] text-white" : "text-slate-500"}`}>
                      <Icon name={d === "desktop" ? "monitor" : "smartphone"} className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className={`mx-auto rounded-xl border border-ink-600 bg-white/[0.03] transition-all ${device === "mobile" ? "max-w-[260px]" : ""}`}>
                  {sender && (
                    <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2.5">
                      <Avatar name={sender.name} hue={(sender.email.charCodeAt(0) * 11) % 360} size={24} />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-white">{sender.name}</p>
                        <p className="truncate text-[10px] text-slate-500">&lt;{sender.email}&gt;</p>
                      </div>
                    </div>
                  )}
                  <div className="px-3 py-3">
                    <p className="mb-2 text-[12px] font-semibold text-white">{editor.subject || "(no subject)"}</p>
                    {/* Merge tags render as typed: no sample lead exists, so nothing is substituted. */}
                    <div className="text-[12px] leading-relaxed text-slate-400">
                      {editor.body.split("\n").map((l, i) => <p key={i} className="min-h-[1em]">{l || "\u00A0"}</p>)}
                    </div>
                  </div>
                </div>
                {/* "Used in campaigns" and reply-rate blocks: no API links templates to campaigns — hidden. */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
