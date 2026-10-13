import { useState } from "react";
import {
  Search,
  Star,
  Archive,
  Trash2,
  CornerUpLeft,
  Sparkles,
  Paperclip,
  Send as SendIcon,
  CheckCircle2,
  Calendar,
  XCircle,
  Clock3,
  MessageCircleQuestion,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, Pill } from "../components/ui";
import { inboxThreads } from "../data/mock";
import { cn } from "../utils/cn";

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

export default function Unibox() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedId, setSelectedId] = useState(inboxThreads[0].id);
  const [reply, setReply] = useState("");

  const filtered = inboxThreads.filter((t) => activeCategory === "All" || t.category === activeCategory);
  const selected = inboxThreads.find((t) => t.id === selectedId) ?? inboxThreads[0];

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
                placeholder="Search"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>
            {categories.map((c) => {
              const count = c.key === "All" ? inboxThreads.length : inboxThreads.filter((t) => t.category === c.key).length;
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
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
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
                <p className="truncate text-xs font-medium text-slate-500">{t.subject}</p>
                <p className="truncate text-xs text-slate-400">{t.preview}</p>
                <span className={cn("mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", categoryColors[t.category])}>
                  {t.category}
                </span>
              </button>
            ))}
          </div>

          {/* Thread detail */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">{selected.subject}</h3>
                <p className="text-xs text-slate-400">
                  {selected.name} &lt;{selected.email}&gt; &middot; {selected.company}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Pill>{selected.campaign}</Pill>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-500">
                  <Star size={15} />
                </button>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Archive size={15} />
                </button>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
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
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                      <Paperclip size={15} />
                    </button>
                    <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50">
                      <Sparkles size={13} /> AI Draft Reply
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                      <CornerUpLeft size={13} />
                      Reply
                      <SendIcon size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
