import { useState } from "react";
import { Avatar, Badge, Button, Icon, Card, Tabs } from "../components/ui";
import { conversations as seed } from "../lib/data";
import type { Conversation } from "../lib/data";

const sentimentTone = { positive: "emerald", neutral: "slate", negative: "rose" } as const;

export function Inbox({ toast }: { toast: (m: string, t?: string) => void }) {
  const [list, setList] = useState(seed);
  const [activeId, setActiveId] = useState(seed[0].id);
  const [folder, setFolder] = useState("All");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const active = list.find((c) => c.id === activeId) ?? list[0];
  const shown = list.filter((c) => {
    if (folder === "Unread") return c.unread;
    if (folder === "Pos") return c.sentiment === "positive";
    if (folder === "Neg") return c.sentiment === "negative";
    return (c.from + c.subject).toLowerCase().includes(query.toLowerCase());
  });

  const open = (c: Conversation) => {
    setActiveId(c.id);
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, unread: false } : x)));
  };

  return (
    <div className="grid min-h-[560px] gap-4 lg:h-[calc(100vh-8.5rem)] lg:grid-cols-[220px_290px_minmax(0,1fr)]">
      {/* folder rail */}
      <Card pad={false} className="hidden flex-col overflow-hidden lg:flex">
        <div className="border-b border-ink-700 p-3">
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox…"
              className="h-9 w-full rounded-lg border border-ink-700 bg-ink-900/70 pl-9 pr-3 text-[12.5px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-brand-500/60"
            />
          </div>
        </div>
        <div className="p-2.5">
          {([
            { label: "All", icon: "inbox", count: list.length },
            { label: "Unread", icon: "mail", count: list.filter((c) => c.unread).length },
            { label: "Positive", icon: "smile", count: list.filter((c) => c.sentiment === "positive").length },
            { label: "Negative", icon: "x", count: list.filter((c) => c.sentiment === "negative").length },
          ] as { label: string; icon: string; count: number }[]).map((f) => (
            <button
              key={f.label}
              onClick={() => setFolder(f.label)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] transition ${
                folder === f.label ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25" : "text-slate-400 hover:bg-white/[0.04]"
              }`}
            >
              <Icon name={f.icon} className={`h-[15px] w-[15px] ${folder === f.label ? "text-brand-300" : "text-slate-500"}`} />
              <span className="flex-1 text-left">{f.label}</span>
              {f.count > 0 && <span className="text-[10.5px] tabular-nums text-slate-500">{f.count}</span>}
            </button>
          ))}
        </div>
        <div className="border-t border-ink-700 px-2.5 py-2.5">
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Connected inboxes</p>
          {["alex@northwind.io", "sdr2@northwind.io", "maya@northwind.io"].map((m) => (
            <button key={m} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] text-slate-400 hover:bg-white/[0.04] hover:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="truncate">{m}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto border-t border-ink-700 p-3">
          <Button variant="default" icon="refresh" size="sm" className="w-full" onClick={() => toast("Inbox synced · 2 new replies", "emerald")}>Sync now</Button>
        </div>
      </Card>

      {/* conversation list */}
      <Card pad={false} className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-ink-700 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-white">Replies</h3>
            <p className="text-[11px] text-slate-500">{shown.length} conversations</p>
          </div>
          <Tabs tabs={["All", "Unread", "Pos", "Neg"]} active={folder} onChange={setFolder} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {shown.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c)}
              className={`flex w-full gap-3 border-b border-ink-700/50 px-4 py-3 text-left transition ${
                activeId === c.id ? "bg-brand-500/[0.08]" : "hover:bg-white/[0.025]"
              }`}
            >
              <Avatar name={c.from} hue={(c.email.charCodeAt(0) * 9) % 360} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className={`flex-1 truncate text-[13px] ${c.unread ? "font-semibold text-white" : "font-medium text-slate-300"}`}>{c.from}</p>
                  <span className="shrink-0 text-[10.5px] text-slate-500">{c.time}</span>
                </div>
                <p className="truncate text-[12px] text-slate-400">{c.subject}</p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-slate-600">{c.preview}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone={sentimentTone[c.sentiment]}>{c.sentiment}</Badge>
                  <span className="truncate text-[10.5px] text-slate-600">{c.campaign}</span>
                </div>
              </div>
              {c.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
            </button>
          ))}
        </div>
      </Card>

      {/* thread */}
      <Card pad={false} className="flex flex-col overflow-hidden">
        {active ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-700 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold tracking-tight text-white">{active.subject}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
                  <Avatar name={active.from} hue={(active.email.charCodeAt(0) * 9) % 360} size={20} />
                  <span className="text-slate-300">{active.from}</span>
                  <span>&lt;{active.email}&gt;</span>
                  <Badge tone={sentimentTone[active.sentiment]}>{active.sentiment}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="default" icon="clock" onClick={() => toast("Snoozed until tomorrow 9 AM", "sky")}>Snooze</Button>
                <Button size="sm" variant="default" icon="archive" />
                <Button size="sm" variant="default" icon="trash" />
                <Button size="sm" variant="default" icon="more" />
              </div>
            </div>

            {/* lead context strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-ink-700 bg-ink-850/40 px-5 py-2.5 text-[11.5px]">
              <span className="text-slate-500">Campaign: <b className="text-slate-300">{active.campaign}</b></span>
              <span className="text-slate-500">Step: <b className="text-slate-300">3 of 7</b></span>
              <span className="text-slate-500">Opens: <b className="text-slate-300">6</b></span>
              <span className="text-slate-500">Clicks: <b className="text-slate-300">2</b></span>
              <button className="ml-auto flex items-center gap-1 text-brand-300 hover:text-brand-200">View full profile <Icon name="chevronRight" className="h-3 w-3" /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {active.messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.me ? "flex-row-reverse" : ""}`}>
                  <Avatar name={m.author} hue={m.me ? 255 : (active.email.charCodeAt(0) * 9) % 360} size={30} />
                  <div className={`max-w-[76%] ${m.me ? "items-end text-right" : ""}`}>
                    <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      m.me
                        ? "rounded-tr-sm bg-brand-600/25 text-slate-100 ring-1 ring-inset ring-brand-500/30"
                        : "rounded-tl-sm bg-ink-850 text-slate-300 ring-1 ring-inset ring-ink-700"
                    }`}>
                      {m.body.split("\n").map((line, i) => <p key={i} className="min-h-[1em]">{line || "\u00A0"}</p>)}
                    </div>
                    <p className="mt-1 px-1 text-[10.5px] text-slate-600">{m.author} · {m.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {active.sentiment === "positive" && (
              <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-2.5">
                <Icon name="sparkles" className="h-4 w-4 text-emerald-300" />
                <p className="flex-1 text-[11.5px] text-emerald-200">Positive intent detected. Suggested reply ready and meeting slots prepared.</p>
                <Button size="sm" variant="success" icon="zap" onClick={() => setDraft("Thursday 2pm ET works great. Here's my calendar link — I'll bring the teardown for Lumenstack specifically.\n\nAlex")}>Use AI reply</Button>
              </div>
            )}

            <div className="border-t border-ink-700 p-4">
              <div className="rounded-xl border border-ink-700 bg-ink-850/60">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={`Reply to ${active.from.split(" ")[0]}…`}
                  className="w-full resize-none bg-transparent p-3.5 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none"
                />
                <div className="flex flex-wrap items-center gap-1.5 border-t border-ink-700 px-3 py-2">
                  {["bold", "italic", "link", "image", "paperclip"].map((t) => (
                    <button key={t} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-white/[0.07] hover:text-white"><Icon name={t} className="h-3.5 w-3.5" /></button>
                  ))}
                  <select className="ml-1 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-[11.5px] text-slate-400 outline-none">
                    {["alex@northwind.io", "sdr2@northwind.io"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" icon="sparkles" onClick={() => toast("AI is drafting…", "violet")}>AI assist</Button>
                    <Button size="sm" variant="primary" icon="send" onClick={() => { setDraft(""); toast("Reply sent · sequence stopped for this lead", "emerald") }}>Send</Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-slate-600">No conversation selected</div>
        )}
      </Card>
    </div>
  );
}
