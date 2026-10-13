import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Clock,
  Plus,
  Trash2,
  GripVertical,
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
  Variable,
  Pause,
  Play,
  X,
} from "lucide-react";
import Topbar from "../components/Topbar";
import { Card, PrimaryButton, SecondaryButton, StatCard, StatusBadge, Pill } from "../components/ui";
import type { CampaignStats, Lead } from "../data/mock";
import * as api from "../lib/api";

type Tab = "sequence" | "leads" | "schedule" | "analytics";

/** The sequence editor's model. A "wait" row maps to the delay_minutes of the email after it. */
interface Step {
  id: number;
  type: "email" | "wait";
  subject?: string;
  body?: string;
  waitDays?: number;
  position?: number; // 1-based position stored by the API (email steps only)
  locked?: boolean;
}

interface VariantEditor {
  variantId?: number;
  position: number;
  subject: string;
  body: string;
  weight: number;
}

/** API days are Python weekday() numbers: Monday = 0 … Sunday = 6. */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const labelClass = "text-xs font-semibold text-slate-500";

function toUiSteps(raw: api.RawStep[]): Step[] {
  const out: Step[] = [];
  let id = 1;
  const ordered = [...raw].sort((a, b) => a.position - b.position);
  for (const step of ordered) {
    if (step.delay_minutes > 0) {
      out.push({ id: id++, type: "wait", waitDays: step.delay_minutes / 1440 });
    }
    out.push({
      id: id++,
      type: "email",
      subject: step.subject,
      body: step.body,
      position: step.position,
      locked: step.locked,
    });
  }
  return out;
}

/** Inverse of toUiSteps: waits become the delay of the next email. Positions are re-derived. */
function toApiSteps(steps: Step[]): { position: number; subject: string; body: string; delay_minutes: number }[] {
  const out: { position: number; subject: string; body: string; delay_minutes: number }[] = [];
  let delay = 0;
  for (const step of steps) {
    if (step.type === "wait") {
      delay = Math.max(0, Math.round((step.waitDays ?? 0) * 1440));
      continue;
    }
    out.push({
      position: out.length + 1,
      subject: step.subject ?? "",
      body: step.body ?? "",
      delay_minutes: delay,
    });
    delay = 0;
  }
  return out;
}

function supportedTimezones(current: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf === "function") {
    const all = intl.supportedValuesOf("timeZone");
    return all.includes(current) ? all : [current, ...all];
  }
  return [current];
}

export default function CampaignDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState<api.CampaignDetailResponse | null>(null);
  const [variantStats, setVariantStats] = useState<api.RawVariantStats | null>(null);
  const [mergeFields, setMergeFields] = useState<string[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sequence");
  const [steps, setSteps] = useState<Step[]>([]);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [variantEditor, setVariantEditor] = useState<VariantEditor | null>(null);
  const [previewLeadId, setPreviewLeadId] = useState<string>("");
  const [preview, setPreview] = useState<api.RawPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState(9);
  const [windowEnd, setWindowEnd] = useState(17);
  const [timezone, setTimezone] = useState("UTC");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<number | null>(null);

  const campaignId = id ?? "";
  const rawStatus = detail?.campaign.status;
  const stats: CampaignStats | null = detail?.stats ?? null;
  const timezones = useMemo(() => supportedTimezones(timezone), [timezone]);

  const load = useCallback(() => {
    if (!campaignId) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.getCampaign(campaignId),
      api.getCampaignVariants(campaignId),
      api.getCampaignFields(campaignId),
      api.listLeads({ campaign_id: api.toId(campaignId) }),
    ])
      .then(([d, v, f, l]) => {
        setDetail(d);
        setVariantStats(v);
        setMergeFields(f.fields);
        setLeads(l.leads.map(api.toLead));
        setSteps(toUiSteps(d.steps));
        setActiveStep((current) => current ?? toUiSteps(d.steps).find((s) => s.type === "email")?.id ?? null);
        setDays(
          (d.campaign.window_days || "")
            .split(",")
            .map((n) => Number(n.trim()))
            .filter((n) => !Number.isNaN(n)),
        );
        setWindowStart(d.campaign.window_start_hour);
        setWindowEnd(d.campaign.window_end_hour);
        setTimezone(d.campaign.timezone);
        setPreviewLeadId((current) => current || (l.leads[0] ? String(l.leads[0].id) : ""));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load this campaign."))
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeEmail = steps.find((s) => s.id === activeStep && s.type === "email") ?? null;
  const activeApiStep = detail?.steps.find((s) => s.position === activeEmail?.position) ?? null;
  const arms: api.RawVariantStatArm[] = useMemo(() => {
    const withStats = variantStats?.steps.find((s) => s.step_id === activeApiStep?.id)?.variants;
    if (withStats && withStats.length) return withStats;
    return (activeApiStep?.variants ?? []).map((v) => ({
      ...v,
      sent: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
      reply_rate: 0,
    }));
  }, [variantStats, activeApiStep]);

  const emailStepCount = steps.filter((s) => s.type === "email").length;

  // ---------------------------------------------------------------- persistence
  function persistSteps(next: Step[], silent = true) {
    if (!campaignId) return;
    api
      .updateCampaign(campaignId, { steps: toApiSteps(next) })
      .then((updated) => {
        setDetail(updated);
        if (updated.locked_steps?.length && !silent) {
          api.toast(
            `Step ${updated.locked_steps.join(", ")} already sent — left unchanged.`,
            "info",
          );
        }
      })
      .catch((err) => api.toastError(err));
  }

  function scheduleStepSave(next: Step[]) {
    setSteps(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => persistSteps(next), 600);
  }

  function saveSchedule(patch: {
    days?: number[];
    window_start?: number;
    window_end?: number;
    timezone?: string;
  }) {
    if (!campaignId) return;
    api
      .updateCampaign(campaignId, patch)
      .then((updated) => setDetail(updated))
      .catch((err) => api.toastError(err));
  }

  function toggleDay(index: number) {
    const next = days.includes(index) ? days.filter((d) => d !== index) : [...days, index].sort((a, b) => a - b);
    setDays(next);
    saveSchedule({ days: next });
  }

  function addEmailStep() {
    const newId = Math.max(0, ...steps.map((s) => s.id)) + 1;
    scheduleStepSave([...steps, { id: newId, type: "email", subject: "", body: "" }]);
  }

  function addWaitStep() {
    const newId = Math.max(0, ...steps.map((s) => s.id)) + 1;
    scheduleStepSave([...steps, { id: newId, type: "wait", waitDays: 2 }]);
  }

  function removeStep(stepId: number) {
    scheduleStepSave(steps.filter((s) => s.id !== stepId));
  }

  function updateStep(stepId: number, patch: Partial<Step>) {
    scheduleStepSave(steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  }

  function insertVariable(field: string) {
    const el = bodyRef.current;
    const token = `{{${field}}}`;
    if (!el || !activeEmail) {
      if (activeEmail) updateStep(activeEmail.id, { body: `${activeEmail.body ?? ""}${token}` });
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const body = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    updateStep(activeEmail.id, { body });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  // ---------------------------------------------------------------- start / pause
  function startCampaign() {
    if (!campaignId) return;
    setBusy(true);
    api
      .startCampaign(campaignId)
      .then(() => {
        api.toast("Campaign started.", "success");
        load();
      })
      .catch((err) => api.toastError(err))
      .finally(() => setBusy(false));
  }

  function pauseCampaign() {
    if (!campaignId) return;
    setBusy(true);
    api
      .pauseCampaign(campaignId)
      .then(() => {
        api.toast("Campaign paused.", "success");
        load();
      })
      .catch((err) => api.toastError(err))
      .finally(() => setBusy(false));
  }

  // ---------------------------------------------------------------- preview
  function runPreview() {
    if (!campaignId || !previewLeadId) return;
    setPreviewing(true);
    const options: { step?: number } = {};
    if (activeEmail?.position) options.step = activeEmail.position;
    api
      .previewCampaign(campaignId, api.toId(previewLeadId), options)
      .then(setPreview)
      .catch((err) => api.toastError(err))
      .finally(() => setPreviewing(false));
  }

  // ---------------------------------------------------------------- variants
  function refreshVariants() {
    if (!campaignId) return;
    api.getCampaignVariants(campaignId).then(setVariantStats).catch(() => undefined);
  }

  function openAddVariant() {
    if (!activeEmail?.position) return;
    setVariantEditor({
      position: activeEmail.position,
      subject: activeEmail.subject ?? "",
      body: activeEmail.body ?? "",
      weight: 100,
    });
  }

  function openEditVariant(arm: api.RawVariantStatArm) {
    if (!activeEmail?.position || arm.id === null) return;
    setVariantEditor({
      variantId: arm.id,
      position: activeEmail.position,
      subject: arm.subject ?? "",
      body: arm.body ?? "",
      weight: arm.weight,
    });
  }

  function saveVariant() {
    if (!variantEditor || busy) return;
    setBusy(true);
    const request =
      variantEditor.variantId === undefined
        ? api.createVariant(campaignId, variantEditor.position, {
            subject: variantEditor.subject,
            body: variantEditor.body,
            weight: variantEditor.weight,
          })
        : api.updateVariant(variantEditor.variantId, {
            subject: variantEditor.subject,
            body: variantEditor.body,
          });
    request
      .then(() => {
        api.toast(variantEditor.variantId === undefined ? "Variant added." : "Variant saved.", "success");
        setVariantEditor(null);
        refreshVariants();
        load();
      })
      .catch((err) => api.toastError(err))
      .finally(() => setBusy(false));
  }

  function toggleVariant(arm: api.RawVariantStatArm) {
    if (arm.id === null) return;
    api
      .updateVariant(arm.id, { enabled: !arm.enabled })
      .then(() => {
        refreshVariants();
        load();
      })
      .catch((err) => api.toastError(err));
  }

  function removeVariant(arm: api.RawVariantStatArm) {
    if (arm.id === null) return;
    if (!window.confirm(`Delete variant ${arm.label}?`)) return;
    api
      .deleteVariant(arm.id)
      .then((result) => {
        if (!result.deleted && result.disabled) api.toast(result.reason ?? "Already sent: disabled instead.", "info");
        else api.toast("Variant deleted.", "success");
        refreshVariants();
        load();
      })
      .catch((err) => api.toastError(err));
  }

  function saveWeights() {
    if (!activeEmail?.position) return;
    const weights: Record<string, number> = {};
    for (const arm of arms) {
      weights[arm.label] = Math.max(1, Math.min(100, Number(weightFor(arm)) || 1));
    }
    api
      .setVariantWeights(campaignId, activeEmail.position, weights)
      .then(() => {
        setWeightDraft({});
        refreshVariants();
        load();
      })
      .catch((err) => api.toastError(err));
  }

  const [weightDraft, setWeightDraft] = useState<Record<string, number>>({});

  function weightFor(arm: api.RawVariantStatArm): number {
    return weightDraft[arm.label] ?? arm.weight;
  }

  if (loading) {
    return (
      <>
        <Topbar title="Campaign" subtitle="Loading…" />
        <main className="flex-1 p-4 sm:p-8">
          <p className="text-sm text-slate-400">Loading campaign…</p>
        </main>
      </>
    );
  }
  if (loadError || !detail) {
    return (
      <>
        <Topbar title="Campaign" subtitle="Could not load" />
        <main className="flex-1 p-4 sm:p-8">
          <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{loadError ?? "Campaign not found."}</p>
            <button onClick={load} className="mt-1 font-semibold underline">
              Retry
            </button>
          </Card>
        </main>
      </>
    );
  }

  const campaign = api.toCampaign({ ...detail.campaign, stats: detail.stats });

  return (
    <>
      <Topbar
        title={campaign.name}
        subtitle={`Created ${api.formatDate(campaign.createdAt)} · ${campaign.leads.toLocaleString()} leads`}
        actions={
          <>
            {(rawStatus === "draft" || rawStatus === "paused") && (
              <PrimaryButton icon={Play} onClick={startCampaign}>
                {busy ? "Working…" : "Start"}
              </PrimaryButton>
            )}
            {rawStatus === "active" && (
              <SecondaryButton icon={Pause} onClick={pauseCampaign}>
                {busy ? "Working…" : "Pause"}
              </SecondaryButton>
            )}
            <StatusBadge status={campaign.status} />
          </>
        }
      />
      <main className="flex-1 space-y-6 p-4 sm:p-8">
        <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600">
          <ArrowLeft size={14} /> Back to campaigns
        </Link>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Sent" value={(stats?.sent ?? 0).toLocaleString()} icon={Mail} accent="indigo" />
          {/* TODO(feature): open rate — ColdLane tracks no opens */}
          <StatCard label="Reply Rate" value={`${stats?.reply_rate ?? 0}%`} icon={Mail} accent="amber" />
          <StatCard label="Meetings" value={String(stats?.meetings ?? 0)} icon={Mail} accent="emerald" />
        </div>

        <div className="flex gap-1.5 border-b border-slate-200">
          {([
            ["sequence", "Sequence"],
            ["leads", "Leads"],
            ["schedule", "Schedule & Settings"],
            ["analytics", "Analytics"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "sequence" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Sequence Steps</h4>
                <Pill>{emailStepCount} emails</Pill>
              </div>
              <div className="mt-4 space-y-2">
                {steps.map((s, i) =>
                  s.type === "email" ? (
                    <button
                      key={s.id}
                      onClick={() => setActiveStep(s.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left transition ${
                        activeStep === s.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <GripVertical size={14} className="shrink-0 text-slate-300" />
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{s.subject || "(no subject)"}</p>
                        <p className="text-xs text-slate-400">
                          Email step
                          {(() => {
                            const step = detail.steps.find((d) => d.position === s.position);
                            const count = step?.variants?.length ?? 0;
                            return count > 1 ? ` · ${count} variants` : "";
                          })()}
                          {s.locked ? " · sent" : ""}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStep(s.id);
                        }}
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </button>
                  ) : (
                    <div key={s.id} className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500">
                      <Clock size={13} />
                      Wait {s.waitDays} day{s.waitDays !== 1 ? "s" : ""}
                      <button onClick={() => removeStep(s.id)} className="ml-auto text-slate-300 hover:text-rose-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ),
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <SecondaryButton icon={Plus} onClick={addEmailStep} className="justify-center">
                  Email
                </SecondaryButton>
                <SecondaryButton icon={Clock} onClick={addWaitStep} className="justify-center">
                  Delay
                </SecondaryButton>
              </div>
            </Card>

            <Card className="p-5">
              {activeEmail ? (
                <>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Editing step {steps.findIndex((s) => s.id === activeEmail.id) + 1}
                    </h4>
                    {/* TODO(feature): AI rewrite — the API only drafts replies to a thread */}
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Subject line</label>
                      <input
                        value={activeEmail.subject ?? ""}
                        onChange={(e) => updateStep(activeEmail.id, { subject: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200">
                      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
                        {[Bold, Italic, Link2, ImageIcon].map((Icon, idx) => (
                          <button key={idx} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Icon size={14} />
                          </button>
                        ))}
                        <span className="mx-1 h-4 w-px bg-slate-200" />
                        <button
                          onClick={() => mergeFields[0] && insertVariable(mergeFields[0])}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                        >
                          <Variable size={13} /> Insert variable
                        </button>
                      </div>
                      <textarea
                        ref={bodyRef}
                        value={activeEmail.body ?? ""}
                        onChange={(e) => updateStep(activeEmail.id, { body: e.target.value })}
                        rows={12}
                        className="w-full resize-none px-3 py-3 text-sm text-slate-700 outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(mergeFields.length ? mergeFields : ["email"]).map((v) => (
                        <button key={v} onClick={() => insertVariable(v)}>
                          <Pill className="font-mono text-[11px]">{`{{${v}}}`}</Pill>
                        </button>
                      ))}
                    </div>

                    {/* ---------------------------------------------------------------- A/B variants */}
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-semibold text-slate-700">A/B variants</h5>
                        <button
                          onClick={openAddVariant}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          <Plus size={13} /> Add variant
                        </button>
                      </div>
                      {arms.length <= 1 && (
                        <p className="mt-2 text-xs text-slate-400">
                          Only arm A (this content) exists. Add a variant to start an A/B test.
                        </p>
                      )}
                      <div className="mt-3 space-y-3">
                        {arms.map((arm) => (
                          <div key={arm.label} className="border-t border-slate-100 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill className={arm.enabled ? "bg-indigo-50 text-indigo-700" : undefined}>{arm.label}</Pill>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={weightFor(arm)}
                                onChange={(e) =>
                                  setWeightDraft({ ...weightDraft, [arm.label]: Number(e.target.value) })
                                }
                                onBlur={saveWeights}
                                disabled={busy}
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                                title="Weight (1-100)"
                              />
                              <span className="text-xs text-slate-400">
                                sent {arm.sent} · replied {arm.replied} · {arm.reply_rate}% reply rate
                              </span>
                              <div className="ml-auto flex items-center gap-1">
                                {arm.id !== null && (
                                  <>
                                    <button
                                      onClick={() => toggleVariant(arm)}
                                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                      {arm.enabled ? "Enabled" : "Disabled"}
                                    </button>
                                    <button
                                      onClick={() => openEditVariant(arm)}
                                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => removeVariant(arm)}
                                      className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {arm.subject || "(empty subject — threads as Re:)"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ---------------------------------------------------------------- preview */}
                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-700">Preview</h5>
                        <select
                          value={previewLeadId}
                          onChange={(e) => setPreviewLeadId(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
                        >
                          {leads.length === 0 && <option value="">No leads imported yet</option>}
                          {leads.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.email}
                            </option>
                          ))}
                        </select>
                        <SecondaryButton onClick={runPreview}>
                          {previewing ? "Rendering…" : "Render email"}
                        </SecondaryButton>
                      </div>
                      {preview && (
                        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-semibold text-slate-500">
                            Step {preview.position} · arm {preview.variant}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{preview.subject}</p>
                          {preview.merge_error ? (
                            <p className="mt-2 text-sm text-rose-600">Merge error: {preview.merge_error}</p>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{preview.text}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-slate-400">
                  Select an email step to edit its content
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === "leads" && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Email</th>
                    <th className="px-3 py-3 font-semibold">Company</th>
                    <th className="px-3 py-3 font-semibold">Title</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                        No leads in this campaign yet — import a CSV from the Leads page.
                      </td>
                    </tr>
                  )}
                  {leads.slice(0, 10).map((l) => (
                    <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-800">{l.name}</td>
                      <td className="px-3 py-3 text-slate-500">{l.email}</td>
                      <td className="px-3 py-3 text-slate-500">{l.company}</td>
                      <td className="px-3 py-3 text-slate-500">{l.title}</td>
                      <td className="px-3 py-3">
                        <LeadStatusPill status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "schedule" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h4 className="font-semibold text-slate-800">Sending Schedule</h4>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Start time</label>
                    <input
                      type="time"
                      value={`${String(windowStart).padStart(2, "0")}:00`}
                      onChange={(e) => {
                        const hour = Number(e.target.value.split(":")[0]);
                        if (Number.isNaN(hour)) return;
                        setWindowStart(hour);
                        saveSchedule({ window_start: hour });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">End time</label>
                    <input
                      type="time"
                      value={`${String(windowEnd).padStart(2, "0")}:00`}
                      onChange={(e) => {
                        const hour = Number(e.target.value.split(":")[0]);
                        if (Number.isNaN(hour)) return;
                        setWindowEnd(hour);
                        saveSchedule({ window_end: hour });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Active days</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((d, idx) => (
                      <button
                        key={d}
                        onClick={() => toggleDay(idx)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          days.includes(idx) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      saveSchedule({ timezone: e.target.value });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h4 className="font-semibold text-slate-800">Sending Options</h4>
              {/* ColdLane's sending rules are fixed server-side; none of these are configurable
                  per campaign, so the toggles are hidden rather than shown as no-ops. */}
              {/* TODO(feature): stop-on-reply toggle — always on */}
              {/* TODO(feature): bounce auto-pause threshold — fixed MAX_BOUNCE_RATE, always on */}
              {/* TODO(feature): open and click tracking — ColdLane never tracks */}
              {/* TODO(feature): text-only mode — not a server option */}
              {/* TODO(feature): per-account daily limit — set on each mailbox instead */}
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-500">
                  Caps, gaps, rotation, ramp-up, suppression and bounce auto-pause are enforced by the worker and are
                  not per-campaign settings. Per-account daily caps live on each mailbox.
                </p>
              </div>
            </Card>
          </div>
        )}

        {tab === "analytics" && (
          <Card className="p-5">
            <h4 className="font-semibold text-slate-800">Campaign performance</h4>
            {/* TODO(feature): opens over time — ColdLane tracks no opens */}
            <div className="mt-4 divide-y divide-slate-100">
              {[
                ["Sent", (stats?.sent ?? 0).toLocaleString()],
                ["Replied", (stats?.replied ?? 0).toLocaleString()],
                ["Bounced", (stats?.bounced ?? 0).toLocaleString()],
                ["Unsubscribed", (stats?.unsubscribed ?? 0).toLocaleString()],
                ["Meetings booked", (stats?.meetings ?? 0).toLocaleString()],
                ["Reply rate", `${stats?.reply_rate ?? 0}%`],
                ["Bounce rate", `${stats?.bounce_rate ?? 0}%`],
                ["Leads in campaign", (stats?.total ?? 0).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      {variantEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">
                {variantEditor.variantId === undefined ? "Add variant" : `Edit variant for step ${variantEditor.position}`}
              </h3>
              <button onClick={() => setVariantEditor(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5">
              <div>
                <label className={labelClass}>Subject line</label>
                <input
                  value={variantEditor.subject}
                  onChange={(e) => setVariantEditor({ ...variantEditor, subject: e.target.value })}
                  placeholder="Leave empty to thread as Re:"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Body</label>
                <textarea
                  rows={8}
                  value={variantEditor.body}
                  onChange={(e) => setVariantEditor({ ...variantEditor, body: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              {variantEditor.variantId === undefined && (
                <div>
                  <label className={labelClass}>Weight (1-100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={variantEditor.weight}
                    onChange={(e) => setVariantEditor({ ...variantEditor, weight: Number(e.target.value) })}
                    className={`mt-1 ${inputClass}`}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <SecondaryButton onClick={() => setVariantEditor(null)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={saveVariant}>{busy ? "Saving…" : "Save Variant"}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const statusColors: Record<string, string> = {
  "Not Contacted": "bg-slate-100 text-slate-600",
  Contacted: "bg-indigo-50 text-indigo-700",
  Replied: "bg-amber-50 text-amber-700",
  Bounced: "bg-rose-50 text-rose-700",
  Unsubscribed: "bg-rose-50 text-rose-700",
  Suppressed: "bg-slate-100 text-slate-600",
  "Merge Error": "bg-amber-50 text-amber-700",
  Error: "bg-rose-50 text-rose-700",
  Completed: "bg-emerald-50 text-emerald-700",
};

function LeadStatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}
