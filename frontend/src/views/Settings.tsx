import { useEffect, useState } from "react";
import { Card, SectionTitle, Badge, Button, Icon, Toggle, Field, inputCls } from "../components/ui";
import * as api from "../lib/api";
import type { RawLlmSettings } from "../lib/api";

// Only sections backed by the API are listed: profile, team, deliverability,
// notifications, integrations, billing and API keys have no endpoints — hidden.
const SECTIONS: { label: string; icon: string }[] = [{ label: "AI", icon: "sparkles" }];

export function Settings({ toast }: { toast: (m: string, t?: string) => void }) {
  const [tab, setTab] = useState("AI");

  return (
    <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)]">
      <Card pad={false} className="h-fit p-2.5">
        {SECTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => setTab(s.label)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] transition ${
              tab === s.label ? "bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
            }`}
          >
            <Icon name={s.icon} className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </Card>

      <div className="space-y-4">
        {tab === "AI" && <AiSettings toast={toast} />}
      </div>
    </div>
  );
}

/** OpenAI-compatible provider settings. The API key is write-only: never read back, never logged. */
function AiSettings({ toast }: { toast: (m: string, t?: string) => void }) {
  const [settings, setSettings] = useState<RawLlmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [enabled, setEnabled] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    api
      .getLlmSettings()
      .then((s) => {
        setSettings(s);
        setBaseUrl(s.base_url);
        setModel(s.model);
        setPrompt(s.draft_system_prompt);
        setEnabled(s.enabled);
        setApiKey("");
      })
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = () => {
    if (saving) return;
    setSaving(true);
    api
      .saveLlmSettings({
        base_url: baseUrl.trim(),
        model: model.trim(),
        draft_system_prompt: prompt,
        enabled,
        // Only sent when the operator typed a new key; blank keeps the stored one.
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      })
      .then((saved) => {
        setSettings(saved);
        setApiKey("");
        toast("AI settings saved.", "emerald");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSaving(false));
  };

  const clearKey = () => {
    if (saving) return;
    setSaving(true);
    api
      .saveLlmSettings({ clear_api_key: true })
      .then((saved) => {
        setSettings(saved);
        toast("API key removed.", "emerald");
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSaving(false));
  };

  const test = () => {
    if (testing) return;
    setTesting(true);
    api
      .testLlmSettings()
      .then(({ ok, detail }) => toast(detail || (ok ? "ok" : "failed"), ok ? "emerald" : "rose"))
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setTesting(false));
  };

  if (loading) {
    return (
      <Card className="grid place-items-center py-16">
        <p className="text-[12px] text-slate-500">Loading AI settings…</p>
      </Card>
    );
  }
  if (loadError) {
    return (
      <Card className="grid place-items-center py-16 text-center">
        <p className="text-[12px] text-slate-400">{loadError}</p>
        <button onClick={load} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        title="AI assistant"
        sub="Any OpenAI-compatible provider. AI only labels replies and drafts text — it never sends email."
        right={<Badge tone={settings?.configured ? "emerald" : "slate"} dot>{settings?.configured ? "Configured" : "Not configured"}</Badge>}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Base URL">
          <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </Field>
        <Field label="Model">
          <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </Field>
        <Field label="API key" hint="Write-only: never displayed. Leave blank to keep the saved key.">
          <input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings?.has_key ? "•••••••• (saved)" : "sk-…"}
          />
        </Field>
        <div className="flex items-end gap-2 pb-1">
          <Toggle on={enabled} onChange={setEnabled} />
          <span className="pb-1.5 text-[12.5px] text-slate-300">{enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div className="sm:col-span-2">
          <Field label="Draft system prompt" hint="Leave empty to use the default prompt.">
            <textarea
              rows={5}
              className={inputCls}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={settings?.default_draft_system_prompt}
            />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {settings?.has_key && (
          <Button variant="danger" icon="trash" disabled={saving} onClick={clearKey}>Remove saved key</Button>
        )}
        <Button variant="default" icon="zap" disabled={testing} onClick={test}>{testing ? "Testing…" : "Test connection"}</Button>
        <Button variant="primary" icon="check" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save AI settings"}</Button>
      </div>
    </Card>
  );
}
