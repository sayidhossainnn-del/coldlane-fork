import { useCallback, useEffect, useState } from "react";
import { Plus, FileText, Copy, Pencil, Trash2, X } from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import type { Template } from "../data/mock";
import * as api from "../lib/api";

interface EditorState {
  id?: string;
  name: string;
  subject: string;
  body: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .listTemplates()
      .then(setTemplates)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load templates."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function save() {
    if (!editor || saving) return;
    if (!editor.name.trim()) {
      api.toast("Template name is required.", "error");
      return;
    }
    setSaving(true);
    const input = { name: editor.name.trim(), subject: editor.subject, body: editor.body };
    const request = editor.id ? api.updateTemplate(editor.id, input) : api.createTemplate(input);
    request
      .then((saved) => {
        setTemplates((prev) =>
          editor.id ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved],
        );
        api.toast(editor.id ? "Template saved." : "Template created.", "success");
        setEditor(null);
      })
      .catch((err) => api.toastError(err))
      .finally(() => setSaving(false));
  }

  function duplicate(template: Template) {
    api
      .createTemplate({ name: `${template.name} (Copy)`, subject: template.subject, body: template.body })
      .then((copy) => {
        setTemplates((prev) => [...prev, copy]);
        api.toast("Template duplicated.", "success");
      })
      .catch((err) => api.toastError(err));
  }

  function remove(template: Template) {
    if (!window.confirm(`Delete the template "${template.name}"?`)) return;
    api
      .deleteTemplate(template.id)
      .then(() => {
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        api.toast("Template deleted.", "success");
      })
      .catch((err) => api.toastError(err));
  }

  return (
    <>
      <Topbar
        title="Templates"
        subtitle="Reusable email templates and snippets for your sequences"
        actions={<PrimaryButton icon={Plus} onClick={() => setEditor({ name: "", subject: "", body: "" })}>New Template</PrimaryButton>}
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        {/* TODO(feature): AI template generator — the API has no text-generation endpoint outside a thread */}

        {loading && <p className="text-sm text-slate-400">Loading templates…</p>}
        {loadError && (
          <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{loadError}</p>
            <button onClick={load} className="mt-1 font-semibold underline">Retry</button>
          </Card>
        )}
        {!loading && !loadError && templates.length === 0 && (
          <p className="text-sm text-slate-400">No templates yet — create your first one.</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FileText size={18} />
                </div>
                {/* TODO(feature): template category — templates only store name/subject/body */}
              </div>
              <h4 className="mt-3 font-semibold text-slate-900">{t.name}</h4>
              <p className="mt-1 text-sm text-slate-500">{t.subject || "No subject line"}</p>
              {/* TODO(feature): "Used in N campaigns" and reply rate — the API tracks neither */}
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setEditor({ id: t.id, name: t.name, subject: t.subject, body: t.body })}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => duplicate(t)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <button
                  onClick={() => remove(t)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">{editor.id ? "Edit Template" : "New Template"}</h3>
              <button onClick={() => setEditor(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              <input
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="Template name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={editor.subject}
                onChange={(e) => setEditor({ ...editor, subject: e.target.value })}
                placeholder="Subject line"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <textarea
                rows={8}
                value={editor.body}
                onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                placeholder="Hi {{firstName}}, ..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <SecondaryButton onClick={() => setEditor(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={save}>{saving ? "Saving…" : "Save Template"}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
