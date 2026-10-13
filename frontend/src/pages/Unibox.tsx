import { useCallback, useEffect, useState } from "react";
import {
  Search,
  CornerUpLeft,
  Sparkles,
  Send as SendIcon,
  CheckCircle2,
  Calendar,
  XCircle,
  Clock3,
  MessageCircleQuestion,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, Pill } from "../components/ui";
import { cn } from "../utils/cn";
import type { InboxThread } from "../data/mock";
import * as api from "../lib/api";

const categories = [
  { key: "All", icon: MessageCircleQuestion },
  { key: "Interested", icon: CheckCircle2 },
  { key: "Meeting Booked", icon: Calendar },
  { key: "Needs Reply", icon: Clock3 },
  { key: "Not Interested", icon: XCircle },
  { key: "Out of Office", icon: Clock3 },
];

const categoryColors: Record<string, string> = {
  Interested: "bg-emerald-50 text-emerald-700",
  "Meeting Booked": "bg-indigo-50 text-indigo-700",
  "Not Interested": "bg-rose-50 text-rose-700",
  "Out of Office": "bg-slate-100 text-slate-600",
  "Needs Reply": "bg-amber-50 text-amber-700",
};

// Reuses the exact badge palette above — no new styling vocabulary for AI labels.
const sentimentColors: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  neutral: "bg-slate-100 text-slate-600",
  negative: "bg-rose-50 text-rose-700",
};

export default function Unibox() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .listThreads("all")
      .then((rows) => setThreads(rows))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load threads."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = threads.filter((t) => {
    const matchesCategory = activeCategory === "All" || t.category === activeCategory;
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      !needle ||
      t.name.toLowerCase().includes(needle) ||
      t.preview.toLowerCase().includes(needle) ||
      t.campaign.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  });

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  /** Merge thread detail (messages + the lead's AI labels) into the list row. */
  const openThread = useCallback(
    (id: string) => {
      setSelectedId(id);
      setReply("");
      setDetailLoading(true);
      api
        .getThread(id)
        .then(({ lead, messages }) => {
          setThreads((prev) =>
            prev.map((t) =>
              t.id === id
                ? {
                    ...t,
                    name: api.leadName(lead.fields, lead.email),
                    company: api.leadCompany(lead.fields),
                    subject:
                      [...messages].reverse().find((m) => m.subject)?.subject ?? "",
                    score: lead.score,
                    sentiment: lead.sentiment,
                    intent: lead.intent,
                    meetingBooked: lead.meeting_booked,
                    summary: lead.summary,
                    unread: false,
                    messages: messages.map((m) => ({
                      from: m.direction === "out" ? "me" : "them",
                      body: m.body ?? "",
                      time: api.formatTimestamp(m.received_at),
                    })),
                  }
                : t,
            ),
          );
          // Opening a thread marks it read, exactly like the "Mark read" endpoint.
          api.markThreadRead(id).catch(() => undefined);
        })
        .catch((err) => {
          api.toastError(err);
        })
        .finally(() => setDetailLoading(false));
    },
    [],
  );

  function sendReply() {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    api
      .sendReply(selected.id, reply.trim())
      .then((result) => {
        api.toast(`Reply sent to ${selected.email} (${result.smtp_result})`, "success");
        setReply("");
        openThread(selected.id);
      })
      .catch((err) => api.toastError(err))
      .finally(() => setSending(false));
  }

  function draftReply() {
    if (!selected || drafting) return;
    setDrafting(true);
    api
      .draftReply(selected.id)
      .then(({ draft }) => {
        setReply(draft);
        api.toast("Draft ready — review it, nothing was sent.", "success");
      })
      .catch((err) => api.toastError(err))
      .finally(() => setDrafting(false));
  }

  return (
    <>
      <Topbar title="Unibox" subtitle="All your campaign replies in one unified inbox" />
      <main className="flex-1 overflow-hidden p-4 sm:p-8">
        <Card className="grid h-[calc(100vh-170px)] grid-cols-1 overflow-hidden lg:grid-cols-[220px_340px_1fr]">
          {/* Category rail */}
          <div className="hidden border-r border-slate-100 p-3 lg:block">
            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>
            {categories.map((c) => {
              const count = c.key === "All" ? threads.length : threads.filter((t) => t.category === c.key).length;
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveCategory(c.key)}
                  className={cn(
                    "mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium",
                    activeCategory === c.key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <c.icon size={15} />
                    {c.key}
                  </span>
                  <span className="text-xs text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Thread list */}
          <div className="overflow-y-auto border-r border-slate-100">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Loading replies…</p>
            )}
            {loadError && (
              <div className="m-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                <p>{loadError}</p>
                <button onClick={load} className="mt-2 font-semibold underline">
                  Retry
                </button>
              </div>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No replies match this filter.</p>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 border-b border-slate-50 px-4 py-3.5 text-left transition",
                  selectedId === t.id ? "bg-indigo-50/70" : "hover:bg-slate-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", t.unread ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                    {t.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{t.time}</span>
                </div>
                {/* TODO(feature): thread subject in the list — GET /api/threads returns no subject */}
                <p className="truncate text-xs font-medium text-slate-500">{t.campaign}</p>
                <p className="truncate text-xs text-slate-400">{t.preview}</p>
                {t.category && (
                  <span className={cn("mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", categoryColors[t.category])}>
                    {t.category}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Thread detail */}
          <div className="flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
                {loading ? "Loading replies…" : "Select a conversation to read it"}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{selected.subject || selected.campaign}</h3>
                    <p className="text-xs text-slate-400">
                      {selected.name} &lt;{selected.email}&gt;{selected.company ? <> &middot; {selected.company}</> : null}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {selected.sentiment && (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                            sentimentColors[selected.sentiment] ?? "bg-slate-100 text-slate-600"
                          )}
                        >
                          {api.sentimentLabel(selected.sentiment)}
                        </span>
                      )}
                      {selected.intent && <Pill>{api.intentLabel(selected.intent)}</Pill>}
                      {typeof selected.score === "number" && <Pill>Score {selected.score}</Pill>}
                      {selected.meetingBooked && (
                        <Pill className="bg-indigo-50 text-indigo-700">Meeting booked</Pill>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pill>{selected.campaign}</Pill>
                    {/* TODO(feature): star, archive and delete thread — no API for them */}
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                  {detailLoading && selected.messages.length === 0 && (
                    <p className="text-center text-sm text-slate-400">Loading conversation…</p>
                  )}
                  {!detailLoading && selected.messages.length === 0 && (
                    <p className="text-center text-sm text-slate-400">No messages stored for this thread yet.</p>
                  )}
                  {selected.messages.map((m, idx) => (
                    <div key={idx} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                          m.from === "me" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                        )}
                      >
                        <p className="whitespace-pre-line">{m.body}</p>
                        <p className={cn("mt-1.5 text-[10px]", m.from === "me" ? "text-indigo-200" : "text-slate-400")}>{m.time}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-4">
                  <div className="rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply..."
                      rows={3}
                      className="w-full resize-none rounded-t-xl px-3 py-2.5 text-sm outline-none"
                    />
                    <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                      <div className="flex items-center gap-1">
                        {/* TODO(feature): attachments — the reply API accepts plain text only */}
                        <button
                          onClick={draftReply}
                          disabled={drafting}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 disabled:opacity-60"
                        >
                          <Sparkles size={13} /> {drafting ? "Drafting…" : "AI Draft Reply"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={sendReply}
                          disabled={sending || !reply.trim()}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          <CornerUpLeft size={13} />
                          {sending ? "Sending…" : "Reply"}
                          <SendIcon size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}
