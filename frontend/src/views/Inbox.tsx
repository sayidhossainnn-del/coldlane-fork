import { useCallback, useEffect, useState } from "react";
import { Avatar, Badge, Button, Icon, Card, Tabs } from "../components/ui";
import * as api from "../lib/api";
import type { Conversation } from "../lib/data";

const sentimentTone = { positive: "emerald", neutral: "slate", negative: "rose" } as const;

export function Inbox({ toast }: { toast: (m: string, t?: string) => void }) {
  const [list, setList] = useState<Conversation[]>([]);
  const [boxes, setBoxes] = useState<{ email: string; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [folder, setFolder] = useState("All");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return api
      .listThreads("all")
      .then((rows) => {
        setList(rows);
        return rows;
      })
      .catch((err) => {
        setLoadError(api.errorMessage(err));
        return [] as Conversation[];
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.listMailboxes().then(setBoxes).catch(() => undefined);
  }, [load]);

  const active = list.find((c) => c.id === activeId);
  const shown = list.filter((c) => {
    const f = folder.toLowerCase();
    if (f === "unread" && !c.unread) return false;
    if ((f === "pos" || f === "positive") && c.sentiment !== "positive") return false;
    if ((f === "neg" || f === "negative") && c.sentiment !== "negative") return false;
    const q = query.trim().toLowerCase();
    return !q || (c.from + c.subject + c.preview + c.campaign).toLowerCase().includes(q);
  });

  const open = (c: Conversation) => {
    setActiveId(c.id);
    setDraft("");
    api
      .getThread(c.id)
      .then(({ lead, messages }) => {
        const name = api.leadName(lead.fields, lead.email);
        setList((l) =>
          l.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  from: name,
                  unread: false,
                  subject: [...messages].reverse().find((m) => m.subject)?.subject ?? "",
                  messages: messages.map((m) => ({
                    id: String(m.id),
                    author: m.direction === "out" ? "You" : name,
                    me: m.direction === "out",
                    body: m.body ?? "",
                    time: api.formatTimestamp(m.received_at),
                  })),
                }
              : x,
          ),
        );
        api.markThreadRead(c.id).catch(() => undefined);
      })
      .catch((err) => toast(api.errorMessage(err), "rose"));
  };

  const sync = () => {
    load().then((rows) => toast(`Inbox synced · ${rows.length} conversations`, "emerald"));
  };

  const aiDraft = () => {
    if (!active || drafting) return;
    setDrafting(true);
    api
      .draftReply(active.id)
      .then(({ draft: d }) => {
        setDraft(d);
        toast("Draft ready. Review it, nothing was sent.", "emerald");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setDrafting(false));
  };

  const send = () => {
    if (!active || !draft.trim() || sending) return;
    setSending(true);
    api
      .sendReply(active.id, draft.trim())
      .then(() => {
        setDraft("");
        toast("Reply sent", "emerald");
        open(active);
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSending(false));
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
          {boxes.map((m) => (
            <button key={m.email} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] text-slate-400 hover:bg-white/[0.04] hover:text-white">
              <span className={`h-1.5 w-1.5 rounded-full ${m.active ? "bg-emerald-400" : "bg-slate-600"}`} />
              <span className="truncate">{m.email}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto border-t border-ink-700 p-3">
          <Button variant="default" icon="refresh" size="sm" className="w-full" onClick={sync}>Sync now</Button>
        </div>
      </Card>

      {/* conversation list */}
      <Card pad={false} className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-white">Replies</h3>
            <p className="truncate text-[11px] text-slate-500">{shown.length} conversations</p>
          </div>
          <Tabs tabs={["All", "Unread", "Pos", "Neg"]} active={folder} onChange={setFolder} className="shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="px-4 py-6 text-center text-[12px] text-slate-500">Loading replies…</p>}
          {loadError && (
            <div className="px-4 py-6 text-center text-[12px] text-slate-400">
              <p>{loadError}</p>
              <button onClick={load} className="mt-2 text-brand-300 hover:text-brand-200">Retry</button>
            </div>
          )}
          {!loading && !loadError && shown.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-slate-500">No replies match this filter.</p>
          )}
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
                {/* TODO(feature): thread subject in list, GET /api/threads has no subject */}
                <p className="truncate text-[12px] text-slate-400">{c.subject || c.email}</p>
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
                <h3 className="truncate text-[15px] font-semibold tracking-tight text-white">{active.subject || active.campaign}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
                  <Avatar name={active.from} hue={(active.email.charCodeAt(0) * 9) % 360} size={20} />
                  <span className="text-slate-300">{active.from}</span>
                  <span>&lt;{active.email}&gt;</span>
                  <Badge tone={sentimentTone[active.sentiment]}>{active.sentiment}</Badge>
                </div>
              </div>
              {/* TODO(feature): snooze, archive, delete, more: no API */}
            </div>

            {/* lead context strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-ink-700 bg-ink-850/40 px-5 py-2.5 text-[11.5px]">
              <span className="text-slate-500">Campaign: <b className="text-slate-300">{active.campaign}</b></span>
              {/* TODO(feature): step, opens, clicks, view full profile: not in thread API */}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {active.messages.length === 0 && (
                <p className="text-center text-[12px] text-slate-500">Loading conversation…</p>
              )}
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
                <p className="flex-1 text-[11.5px] text-emerald-200">Positive intent detected. Generate a reply draft.</p>
                <Button size="sm" variant="success" icon="zap" onClick={aiDraft}>{drafting ? "Drafting…" : "Use AI reply"}</Button>
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
                  {/* TODO(feature): rich-text tools, attachments, sender picker: API sends plain text from the lead's mailbox */}
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" icon="sparkles" onClick={aiDraft}>{drafting ? "Drafting…" : "AI assist"}</Button>
                    <Button size="sm" variant="primary" icon="send" onClick={send}>{sending ? "Sending…" : "Send"}</Button>
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
