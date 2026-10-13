import { useState } from "react";
import { Card, SectionTitle, Badge, Button, Icon, Field, inputCls, Tabs, Progress, Avatar } from "../components/ui";
import { templates as seed, campaigns } from "../lib/data";
import type { Template } from "../lib/data";

const CATS = ["All", "Cold intro", "Follow-up", "Breakup", "Warm"];

export function Templates({ toast }: { toast: (m: string, t?: string) => void }) {
  const [list, setList] = useState(seed);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Template | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const shown = list.filter((t) => (cat === "All" || t.category === cat) && (t.name + t.subject).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…"
            className="h-9 w-60 rounded-lg border border-ink-700 bg-ink-900/70 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-brand-500/60" />
        </div>
        <Tabs tabs={CATS} active={cat} onChange={setCat} />
        <div className="ml-auto flex gap-2">
          <Button variant="default" icon="sparkles" onClick={() => toast("AI generated 3 new template drafts", "violet")}>Generate with AI</Button>
          <Button variant="primary" icon="plus" onClick={() => setEditor({ id: "new", name: "Untitled template", category: "Cold intro", subject: "", body: "", used: 0, replyRate: 0, updated: "now" })}>New template</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => (
          <Card key={t.id} className="group flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500/10 text-brand-300 ring-1 ring-inset ring-brand-500/20"><Icon name="template" className="h-4 w-4" /></span>
                <div>
                  <p className="text-[13.5px] font-semibold text-white group-hover:text-brand-200">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{t.category} · updated {t.updated}</p>
                </div>
              </div>
              <Badge tone={t.replyRate > 11 ? "emerald" : t.replyRate > 8 ? "sky" : "slate"}>{t.replyRate}%</Badge>
            </div>

            <div className="mt-3.5 rounded-xl border border-ink-700/70 bg-ink-850/50 p-3">
              <p className="mb-1.5 text-[11px] font-medium text-slate-300">Subject</p>
              <p className="mb-2.5 font-mono text-[11.5px] text-brand-200">{t.subject}</p>
              <p className="mb-1.5 text-[11px] font-medium text-slate-300">Preview</p>
              <p className="line-clamp-4 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-500">{t.body}</p>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><Icon name="send" className="h-3 w-3" />{t.used.toLocaleString()} sends</span>
              <span className="flex items-center gap-1.5"><Icon name="reply" className="h-3 w-3" />{t.replyRate}% reply</span>
            </div>

            <div className="mt-3.5 flex gap-2 border-t border-ink-700/60 pt-3">
              <Button size="sm" variant="default" icon="edit" className="flex-1 justify-center" onClick={() => setEditor(t)}>Edit</Button>
              <Button size="sm" variant="ghost" icon="copy" onClick={() => { setList([{ ...t, id: Math.random().toString(36).slice(2), name: `${t.name} (copy)` }, ...list]); toast("Template duplicated", "brand"); }} />
              <Button size="sm" variant="ghost" icon="trash" onClick={() => { setList(list.filter((x) => x.id !== t.id)); toast("Template deleted", "rose"); }} />
            </div>
          </Card>
        ))}
      </div>

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
                  <Field label="Category">
                    <select className={inputCls} value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })}>
                      {CATS.slice(1).map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
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
                    {["first_name", "last_name", "company", "title", "location", "linkedin_url", "custom_1"].map((v) => (
                      <button key={v} onClick={() => setEditor({ ...editor, body: editor.body + `{{${v}}}` })}
                        className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10.5px] text-brand-200 ring-1 ring-inset ring-white/10 hover:bg-brand-500/20">{`{{${v}}}`}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3 text-[11.5px] text-slate-500">
                  <b className="text-slate-300">Spam score:</b> 1.1 / 5 · 74 words · 0 links. Best practice is under 90 words for cold outreach.
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
                <Button variant="default" onClick={() => setEditor(null)}>Cancel</Button>
                <Button variant="primary" icon="check" onClick={() => { setEditor(null); toast("Template saved", "emerald"); }}>Save template</Button>
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
                  <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2.5">
                    <Avatar name="Alex Rivera" hue={255} size={24} />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-white">Alex Rivera</p>
                      <p className="truncate text-[10px] text-slate-500">to sarah.w@lumenstack.com</p>
                    </div>
                  </div>
                  <div className="px-3 py-3">
                    <p className="mb-2 text-[12px] font-semibold text-white">{(editor.subject || "(no subject)").replace(/\{\{first_name\}\}/g, "Sarah").replace(/\{\{company\}\}/g, "Lumenstack")}</p>
                    <div className="text-[12px] leading-relaxed text-slate-400">
                      {editor.body.split("\n").map((l, i) => <p key={i} className="min-h-[1em]">{l.replace(/\{\{first_name\}\}/g, "Sarah").replace(/\{\{company\}\}/g, "Lumenstack") || "\u00A0"}</p>)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1.5 text-[10.5px] uppercase tracking-wider text-slate-500">Used in campaigns</p>
                    {campaigns.slice(0, 3).map((c) => (
                      <div key={c.id} className="mb-1.5 flex items-center gap-2 rounded-lg border border-ink-700/70 px-2.5 py-2">
                        <Icon name="send" className="h-3.5 w-3.5 text-brand-300" />
                        <span className="truncate text-[11.5px] text-slate-300">{c.name}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-500">Reply rate</span><span className="font-semibold text-emerald-300">{editor.replyRate || 0}%</span></div>
                    <Progress value={(editor.replyRate || 0) * 8} tone="emerald" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
