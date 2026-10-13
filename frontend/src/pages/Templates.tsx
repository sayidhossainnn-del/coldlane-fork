import { useState } from "react";
import { Plus, FileText, Copy, Pencil, Trash2, Sparkles, X } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, Pill, PrimaryButton, SecondaryButton } from "../components/ui";
import { templates } from "../data/mock";

export default function Templates() {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <>
      <Topbar
        title="Templates"
        subtitle="Reusable email templates and snippets for your sequences"
        actions={<PrimaryButton icon={Plus} onClick={() => setShowEditor(true)}>New Template</PrimaryButton>}
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <Card className="flex flex-col items-center gap-4 border-dashed bg-gradient-to-br from-violet-50 to-indigo-50 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
            <Sparkles size={22} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Generate a template with AI</h3>
            <p className="text-sm text-slate-500">Describe your product and target persona — get a ready-to-send email in seconds.</p>
          </div>
          <SecondaryButton onClick={() => setShowEditor(true)}>Try it</SecondaryButton>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FileText size={18} />
                </div>
                <Pill>{t.category}</Pill>
              </div>
              <h4 className="mt-3 font-semibold text-slate-900">{t.name}</h4>
              <p className="mt-1 text-sm text-slate-500">Used in {t.used} campaigns</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-emerald-600">{t.replyRate}% reply rate</span>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button onClick={() => setShowEditor(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                  <Pencil size={13} /> Edit
                </button>
                <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                  <Copy size={13} /> Duplicate
                </button>
                <button className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50">
                  <Trash2 size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">New Template</h3>
              <button onClick={() => setShowEditor(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              <input placeholder="Template name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              <input placeholder="Subject line" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              <textarea
                rows={8}
                placeholder="Hi {{firstName}}, ..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <SecondaryButton onClick={() => setShowEditor(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={() => setShowEditor(false)}>Save Template</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
