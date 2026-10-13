import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Badge, Button, Progress, Avatar, Icon, Tabs, Field, inputCls, SectionTitle, Ring } from "../components/ui";
import { AreaChart, Donut } from "../components/Charts";
import * as api from "../lib/api";
import type { RawCampaignDetail, RawPreview, RawVariantStats } from "../lib/api";
import type { Campaign, Lead, SequenceStep, StepType } from "../lib/data";
import { CampaignCard } from "./Campaigns";

const stepMeta: Record<StepType, { icon: string; color: string; label: string }> = {
  email: { icon: "mail", color: "text-brand-300 bg-brand-500/12 ring-brand-500/25", label: "Email" },
  call: { icon: "phone", color: "text-amber-300 bg-amber-500/12 ring-amber-500/25", label: "Call task" },
  linkedin: { icon: "linkedin", color: "text-sky-300 bg-sky-500/12 ring-sky-500/25", label: "LinkedIn" },
  wait: { icon: "clock", color: "text-slate-300 bg-white/[0.06] ring-white/10", label: "Wait" },
  condition: { icon: "branch", color: "text-violet-300 bg-violet-500/12 ring-violet-500/25", label: "Condition" },
};

// The API only stores email steps (max 5), so that is the only addable step type.
const STEP_LIB: StepType[] = ["email"];

function renderLines(text: string) {
  // No sample lead exists: merge tags render exactly as stored.
  return text.split("\n").map((line, i) => <p key={i} className="min-h-[1em] leading-relaxed">{line || "\u00A0"}</p>);
}

function StepNode({
  step,
  index,
  selected,
  onSelect,
  onMove,
  onDelete,
  onDropOn,
  editable,
}: {
  step: SequenceStep;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onDropOn: (draggedId: string) => void;
  editable: boolean;
}) {
  const meta = stepMeta[step.type];
  return (
    <div
      className="relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        const sid = e.dataTransfer.getData("text/plain");
        if (sid) onDropOn(sid);
      }}
    >
      {/* connector */}
      {index > 0 && (
        <div className="absolute left-[26px] top-[-18px] h-[18px] w-px bg-gradient-to-b from-transparent to-ink-600" />
      )}
      <div
        draggable={editable}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", step.id)}
        onClick={onSelect}
        className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
          selected
            ? "border-brand-500/60 bg-brand-500/[0.06] shadow-lg shadow-brand-950/30"
            : "border-ink-700/70 bg-ink-900/60 hover:border-ink-600 hover:bg-ink-850"
        }`}
      >
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${meta.color}`}>
          <Icon name={meta.icon} className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{meta.label}</span>
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">
              {step.type === "wait" ? `after ${step.waitDays ?? 1}d` : `day ${step.dayOffset}`}
            </span>
            {step.variants && step.variants.length > 1 && <Badge tone="violet">{step.variants.length} variants</Badge>}
            {/* The API has no per-step enable flag: the "off" badge never appears. */}
          </div>
          <p className="mt-1 truncate text-[13px] font-medium text-white">{step.title}</p>
          {step.subject && <p className="mt-0.5 truncate text-[11.5px] text-slate-500">Subject: {step.subject}</p>}
          {step.note && <p className="mt-1 truncate text-[11px] italic text-slate-600">{step.note}</p>}

          {step.stats && (
            <div className="mt-2.5 flex items-center gap-4 text-[11px]">
              <span className="text-slate-500">Sent <b className="text-slate-300">{step.stats.sent.toLocaleString()}</b></span>
              {/* No open tracking exists in the API: the "Open" stat is hidden. */}
              <span className="text-slate-500">Reply <b className="text-emerald-300">{((step.stats.replied / step.stats.sent) * 100).toFixed(1)}%</b></span>
            </div>
          )}
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={(e) => { e.stopPropagation(); onMove(1); }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><Icon name="chevronDown" className="h-3.5 w-3.5" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"><Icon name="trash" className="h-3.5 w-3.5" /></button>
            {/* Step-level toggle: no API flag — hidden (variant arms keep their own enabled flag). */}
          </div>
        )}
      </div>
    </div>
  );
}

export function CampaignDetail({ id, onBack, toast }: { id: string; onBack: () => void; toast: (m: string, t?: string) => void }) {
  const [detail, setDetail] = useState<RawCampaignDetail | null>(null);
  const [variantStats, setVariantStats] = useState<RawVariantStats | null>(null);
  const [fields, setFields] = useState<string[]>(["email"]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadsKey, setLeadsKey] = useState(0);
  const [others, setOthers] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [delays, setDelays] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("Sequence");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [variantIdx, setVariantIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [daysDraft, setDaysDraft] = useState<number[]>([]);
  const [startDraft, setStartDraft] = useState(9);
  const [endDraft, setEndDraft] = useState(17);
  const [preview, setPreview] = useState<RawPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; text: string } | null>(null);
  const [lawful, setLawful] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingVariant = useRef<{ stepId: string; variantId: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    return Promise.all([api.getCampaign(id), api.getCampaignVariants(id), api.getCampaignFields(id)])
      .then(([d, vs, f]) => {
        setDetail(d);
        setVariantStats(vs);
        setFields(f.fields);
        const replied: Record<number, number> = {};
        vs.steps.forEach((s) => {
          replied[s.position] = s.variants.reduce((a, v) => a + (v.replied ?? 0), 0);
        });
        const stepStats: Record<number, { sent: number; replied: number }> = {};
        d.steps.forEach((s) => {
          stepStats[s.position] = {
            sent: d.stats.per_step?.[String(s.position)] ?? 0,
            replied: replied[s.position] ?? 0,
          };
        });
        const seq = api.toSequence(d.steps, stepStats);
        setSteps(seq);
        setDelays(Object.fromEntries(d.steps.map((s) => [String(s.id), s.delay_minutes ?? 0])));
        setDirty([]);
        setSelectedId((cur) => (seq.some((s) => s.id === cur) ? cur : (seq[0]?.id ?? "")));
        setNameDraft(d.campaign.name);
        const days = (d.campaign.window_days ?? "").split(",").map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
        setDaysDraft(days);
        setStartDraft(d.campaign.window_start_hour);
        setEndDraft(d.campaign.window_end_hour);
        const pending = pendingVariant.current;
        if (pending) {
          pendingVariant.current = null;
          const target = seq.find((s) => s.id === pending.stepId);
          const idx = target?.variants?.findIndex((v) => v.id === pending.variantId) ?? -1;
          if (idx >= 0) {
            setSelectedId(pending.stepId);
            setVariantIdx(idx);
          }
        }
      })
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    api.listCampaigns().then((rows) => setOthers(rows.filter((c) => c.id !== id).slice(0, 3))).catch(() => setOthers([]));
  }, [load, id]);

  useEffect(() => {
    setLeadsLoading(true);
    setLeadsError(null);
    api
      .listLeads({ campaign_id: id, limit: 500 })
      .then((r) => {
        setLeads(r.leads.map(api.toLead));
        setLeadsTotal(r.total);
      })
      .catch((err) => setLeadsError(api.errorMessage(err)))
      .finally(() => setLeadsLoading(false));
  }, [id, leadsKey]);

  const previewLead = leads[0];
  const selectedPos = detail ? detail.steps.findIndex((s) => String(s.id) === selectedId) + 1 : 0;
  useEffect(() => {
    if (!detail || !previewLead || selectedPos < 1) {
      setPreview(null);
      return;
    }
    const rawStep = detail.steps[selectedPos - 1];
    const arms = rawStep.variants ?? [];
    const arm = arms[Math.min(variantIdx, Math.max(0, arms.length - 1))];
    const letter = arm && arm.id !== null ? arm.label : undefined;
    setPreviewLoading(true);
    api
      .previewCampaign(id, previewLead.id, { step: selectedPos, ...(letter ? { variant: letter } : {}) })
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [id, detail, previewLead, selectedPos, variantIdx]);

  const detailCampaign = detail
    ? {
        ...api.toCampaign({ ...detail.campaign, stats: detail.stats }),
        dailyLimit: detail.mailboxes.reduce((a, m) => a + (m.daily_cap ?? 0), 0),
      }
    : null;

  const editable = !!detail && (detail.campaign.status === "draft" || detail.campaign.status === "paused");
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0];
  const fallbackArm = selected ? { id: `local-${selected.id}`, label: "Variant A", subject: selected.subject ?? "", body: selected.body ?? "", share: 100 } : null;
  const arms = selected?.variants ?? (fallbackArm ? [fallbackArm] : []);
  const armIdx = Math.min(variantIdx, Math.max(0, arms.length - 1));
  const arm = arms[armIdx];
  const armIsStored = !!arm && /^\d+$/.test(arm.id);
  const armIsA = !armIsStored; // arm 'A' (or an unsaved local step) edits the step's own content
  const subjectValue = armIsA ? (selected?.subject ?? "") : (arm?.subject ?? "");
  const bodyValue = armIsA ? (selected?.body ?? "") : (arm?.body ?? "");

  const patch = (p: Partial<SequenceStep>) => {
    if (!selected) return;
    setSteps((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...p } : s)));
  };

  const patchArm = (idx: number, p: { subject?: string; body?: string }) => {
    if (!selected) return;
    const target = (selected.variants ?? [])[idx];
    if (!target) return;
    setSteps((prev) =>
      prev.map((s) =>
        s.id === selected.id
          ? { ...s, variants: (s.variants ?? []).map((v, i) => (i === idx ? { ...v, ...p } : v)) }
          : s,
      ),
    );
    if (/^\d+$/.test(target.id)) setDirty((d) => (d.includes(target.id) ? d : [...d, target.id]));
  };

  const addStep = (type: StepType) => {
    const meta = stepMeta[type];
    const s: SequenceStep = {
      id: `s_${Math.random().toString(36).slice(2, 7)}`,
      type,
      title: type === "wait" ? "Wait" : `${meta.label} step`,
      dayOffset: steps.length * 3,
      waitDays: type === "wait" ? 3 : undefined,
      subject: type === "email" ? "Follow up — {{first_name}}" : undefined,
      body: type === "email" ? "Hi {{first_name}},\n\n" : undefined,
      enabled: true,
    };
    setSteps((p) => [...p, s]);
    setDelays((d) => ({ ...d, [s.id]: 0 }));
    setSelectedId(s.id);
    setVariantIdx(0);
    toast(`${meta.label} step added — save to apply`, "brand");
  };

  const move = (sid: string, dir: -1 | 1) =>
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const reorderTo = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setSteps((prev) => {
      const from = prev.findIndex((s) => s.id === draggedId);
      const to = prev.findIndex((s) => s.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    toast("Step moved — save to apply", "brand");
  };

  const removeStep = (sid: string) => {
    setSteps((prev) => prev.filter((x) => x.id !== sid));
    toast("Step removed — save to apply", "rose");
  };

  const duplicateStep = () => {
    if (!selected) return;
    const copy: SequenceStep = { ...selected, id: `s_${Math.random().toString(36).slice(2, 7)}`, subject: selected.subject, body: selected.body };
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.id === selected.id);
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setDelays((d) => ({ ...d, [copy.id]: delays[selected.id] ?? 0 }));
    toast("Step duplicated — save to apply", "brand");
  };

  const addVariant = () => {
    if (!selected || selectedPos < 1 || saving) return;
    setSaving(true);
    api
      .createVariant(id, selectedPos, { subject: selected.subject ?? "", body: selected.body ?? "" })
      .then((res) => {
        pendingVariant.current = { stepId: selected.id, variantId: String(res.variant.id) };
        toast(`Variant ${res.variant.label} added`, "emerald");
        return load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSaving(false));
  };

  const save = () => {
    if (saving || !detail || !editable) return;
    setSaving(true);
    const payload = steps.map((s) => ({
      subject: s.subject ?? "",
      body: s.body ?? "",
      delay_minutes: delays[s.id] ?? 0,
    }));
    const armsToSave = steps.flatMap((s) =>
      (s.variants ?? []).filter((v) => dirty.includes(v.id)).map((v) => ({ id: v.id, subject: v.subject, body: v.body })),
    );
    const jobs: Promise<unknown>[] = [api.updateCampaign(id, { steps: payload })];
    armsToSave.forEach((a) => jobs.push(api.updateVariant(a.id, { subject: a.subject, body: a.body })));
    Promise.allSettled(jobs)
      .then((results) => {
        const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
        if (failed.length) {
          toast(api.errorMessage(failed[0].reason), "rose");
        } else {
          const put = results[0] as PromiseFulfilledResult<RawCampaignDetail & { locked_steps?: number[] }>;
          const locked = put.value.locked_steps ?? [];
          toast(
            locked.length
              ? `Sequence saved · step${locked.length > 1 ? "s" : ""} ${locked.join(", ")} already sent and stayed locked`
              : "Sequence saved",
            locked.length ? "amber" : "emerald",
          );
        }
        setDirty([]);
        load();
      })
      .finally(() => setSaving(false));
  };

  const pause = () => {
    if (acting) return;
    setActing(true);
    api
      .pauseCampaign(id)
      .then(() => {
        toast("Campaign paused", "amber");
        load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setActing(false));
  };

  const resume = () => {
    if (acting) return;
    setActing(true);
    api
      .startCampaign(id)
      .then(() => {
        toast("Campaign started — sending now", "emerald");
        load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setActing(false));
  };

  const saveSchedule = () => {
    if (saving || !editable) return;
    if (!daysDraft.length) {
      toast("Pick at least one send day.", "rose");
      return;
    }
    setSaving(true);
    api
      .updateCampaign(id, { days: daysDraft, window_start: startDraft, window_end: endDraft })
      .then(() => {
        toast("Schedule updated", "emerald");
        load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSaving(false));
  };

  const saveSettings = () => {
    if (saving || !editable) return;
    if (!nameDraft.trim()) {
      toast("Campaign name is required.", "rose");
      return;
    }
    setSaving(true);
    api
      .updateCampaign(id, { name: nameDraft.trim() })
      .then(() => {
        toast("Settings saved", "emerald");
        load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setSaving(false));
  };

  const archive = () => {
    if (acting) return;
    setActing(true);
    api
      .deleteCampaign(id)
      .then(() => {
        toast("Campaign deleted", "rose");
        onBack();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setActing(false));
  };

  const readCsv = (file: File | undefined) => {
    if (!file) return;
    file
      .text()
      .then((text) => setImportFile({ name: file.name, text }))
      .catch(() => toast("Could not read that file.", "rose"));
  };

  const startImport = () => {
    if (importing) return;
    if (!importFile) {
      toast("Choose a CSV file first.", "rose");
      return;
    }
    if (!lawful) {
      toast("Confirm you have a lawful basis to email these contacts.", "rose");
      return;
    }
    setImporting(true);
    api
      .importLeads(id, { csv_text: importFile.text, filename: importFile.name, lawful_basis_confirmed: true })
      .then((res) => {
        const c = res.counts;
        setImportOpen(false);
        setImportFile(null);
        setLawful(false);
        toast(`${c.imported} imported · ${c.duplicates} duplicates · ${c.invalid} invalid · ${c.suppressed} suppressed`, "emerald");
        setLeadsKey((k) => k + 1);
        load();
      })
      .catch((err) => toast(api.errorMessage(err), "rose"))
      .finally(() => setImporting(false));
  };

  const stats = detail?.stats;
  const delivered = stats && stats.gone_out > 0 ? Math.max(0, ((stats.gone_out - stats.bounced) / stats.gone_out) * 100) : 0;
  const avgDelayDays = steps.length > 1
    ? steps.slice(1).reduce((a, s) => a + (delays[s.id] ?? 0), 0) / (steps.length - 1) / 1440
    : 0;
  const stepChart = steps.map((s, i) => ({ label: String(i + 1), sent: s.stats?.sent ?? 0, opened: 0, replied: s.stats?.replied ?? 0 }));
  const stepChartTotal = stepChart.reduce((a, d) => a + d.sent, 0);
  const variantRows = (variantStats?.steps ?? []).flatMap((s) =>
    s.variants.length > 1
      ? s.variants.map((v) => ({ key: `${s.position}-${v.label}`, label: `Variant ${v.label} · step ${s.position}`, rate: v.reply_rate }))
      : [],
  );
  const shownLeads = leads.filter((l) => (l.name + l.email + l.company).toLowerCase().includes(query.toLowerCase()));
  const splitLabel = arms.length > 1 && arm ? (() => {
    const total = arms.reduce((a, v) => a + (v.share || 0), 0) || 1;
    return `${arms.map((v) => Math.round(((v.share || 0) / total) * 100)).join(" / ")} split`;
  })() : null;
  const senderBox = detail?.mailboxes[0] ?? null;

  if (loading) {
    return (
      <div className="space-y-5">
        <Card className="grid place-items-center py-16">
          <p className="text-[12px] text-slate-500">Loading campaign…</p>
        </Card>
      </div>
    );
  }
  if (loadError || !detail || !detailCampaign || !stats) {
    return (
      <div className="space-y-5">
        <Card className="grid place-items-center py-16 text-center">
          <p className="text-[12px] text-slate-400">{loadError ?? "Campaign not found."}</p>
          <button onClick={() => (loadError ? load() : onBack())} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">
            {loadError ? "Retry" : "Back to campaigns"}
          </button>
        </Card>
      </div>
    );
  }

  const campaign = detailCampaign;
  const schedule = api.scheduleLabel(detail.campaign, true);
  const daysShort = api.daysLabel(detail.campaign.window_days);

  return (
    <div className="space-y-5">
      {/* header */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button onClick={onBack} className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-ink-700 text-slate-400 transition hover:bg-white/5 hover:text-white">
              <Icon name="chevronLeft" className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight text-white">{campaign.name}</h2>
                <Badge tone={campaign.status === "active" ? "emerald" : campaign.status === "paused" ? "amber" : "slate"} dot>{campaign.status}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
                <span className="flex items-center gap-1.5"><Icon name="users" className="h-3.5 w-3.5" />{campaign.leads.toLocaleString()} leads</span>
                <span className="flex items-center gap-1.5"><Icon name="at" className="h-3.5 w-3.5" />{detail.mailboxes.length} sending accounts</span>
                <span className="flex items-center gap-1.5"><Icon name="clock" className="h-3.5 w-3.5" />{schedule}</span>
                {campaign.dailyLimit > 0 && (
                  <span className="flex items-center gap-1.5"><Icon name="zap" className="h-3.5 w-3.5" />{campaign.dailyLimit}/day cap</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* "Duplicate": no API — hidden. */}
            {campaign.status === "active" ? (
              <Button variant="default" icon="pause" disabled={acting} onClick={pause}>{acting ? "Pausing…" : "Pause"}</Button>
            ) : (
              <Button variant="primary" icon="play" disabled={acting} onClick={resume}>{acting ? "Starting…" : "Resume"}</Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-ink-700/60 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {([
            ["Delivered", `${delivered.toFixed(1)}%`, "text-white"],
            // "Open rate" and "Positive": no open tracking / positive-reply aggregate — hidden.
            ["Reply rate", `${stats.reply_rate}%`, "text-emerald-300"],
            ["Bounce", `${stats.bounce_rate}%`, "text-rose-300"],
            ["Meetings", stats.meetings.toString(), "text-violet-300"],
          ] as [string, string, string][]).map(([l, v, c]) => (
            <div key={l}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p>
              <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      </Card>

      <Tabs tabs={["Sequence", "Overview", "Leads", "Schedule", "Settings"]} active={tab} onChange={setTab} />

      {tab === "Sequence" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* builder */}
          <div className="space-y-4">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-white">Sequence builder</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {steps.length} steps · drag to reorder · avg. delay {avgDelayDays % 1 === 0 ? avgDelayDays : avgDelayDays.toFixed(1)} days
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="emerald" dot>Auto-ongoing</Badge>
                  {/* "AI step": no step-drafting endpoint — hidden. */}
                </div>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
                className={`space-y-3 rounded-xl p-1 transition ${dragOver ? "ring-2 ring-brand-500/40" : ""}`}
              >
                {steps.length === 0 && (
                  <p className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-[12.5px] text-slate-500">
                    No steps yet. Add an email step below.
                  </p>
                )}
                {steps.map((s, i) => (
                  <StepNode
                    key={s.id}
                    step={s}
                    index={i}
                    editable={editable}
                    selected={selected?.id === s.id}
                    onSelect={() => { setSelectedId(s.id); setVariantIdx(0); }}
                    onMove={(d) => move(s.id, d)}
                    onDelete={() => removeStep(s.id)}
                    onDropOn={(draggedId) => reorderTo(draggedId, s.id)}
                  />
                ))}
              </div>

              {editable && (
                <div className="mt-4 border-t border-dashed border-ink-700 pt-4">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Add step</p>
                  <div className="flex flex-wrap gap-2">
                    {STEP_LIB.map((t) => (
                      <button
                        key={t}
                        onClick={() => addStep(t)}
                        className={`flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/70 px-3 py-2 text-[12px] text-slate-300 transition hover:-translate-y-0.5 hover:border-brand-500/50 hover:bg-brand-500/10 hover:text-white`}
                      >
                        <Icon name={stepMeta[t].icon} className="h-3.5 w-3.5" />
                        {stepMeta[t].label}
                        <Icon name="plus" className="h-3 w-3 opacity-50" />
                      </button>
                    ))}
                    {/* Call / LinkedIn / Wait / Condition steps have no API: hidden. */}
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle title="Step comparison" sub="Sends vs. replies per step" />
              {stepChartTotal > 0 ? (
                <AreaChart
                  data={stepChart}
                  height={150}
                  series={[
                    { key: "sent", color: "#6366f1", name: "Sent" },
                    { key: "replied", color: "#34d399", name: "Replies" },
                  ]}
                />
              ) : (
                <p className="py-8 text-center text-[12px] text-slate-500">No sends yet in this sequence.</p>
              )}
            </Card>
          </div>

          {/* editor */}
          <div className="space-y-4">
            {selected && (
              <Card pad={false} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
                  <Icon name={stepMeta[selected.type].icon} className="h-4 w-4 text-brand-300" />
                  <span className="text-[13px] font-medium text-white">Edit {stepMeta[selected.type].label.toLowerCase()}</span>
                  <Badge tone="brand" className="ml-auto">Day {selected.dayOffset}</Badge>
                </div>

                {selected.type === "wait" ? (
                  <div className="space-y-4 p-4">
                    <Field label="Wait duration (days)">
                      <input
                        type="number" className={inputCls} value={selected.waitDays ?? 3}
                        onChange={(e) => patch({ waitDays: Number(e.target.value), dayOffset: Number(e.target.value) })}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 7].map((d) => (
                        <button key={d} onClick={() => patch({ waitDays: d, dayOffset: d })}
                          className={`rounded-lg border px-3 py-1.5 text-[12px] transition ${selected.waitDays === d ? "border-brand-500/60 bg-brand-500/10 text-brand-200" : "border-ink-600 text-slate-400 hover:bg-white/5"}`}>
                          {d} day{d > 1 ? "s" : ""}
                        </button>
                      ))}
                    </div>
                    <p className="rounded-lg bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-slate-500">
                      Leads skip business days automatically. Sends pause outside 9:00–17:00 in the lead's local timezone.
                    </p>
                  </div>
                ) : selected.type === "condition" ? (
                  <div className="space-y-3 p-4">
                    <Field label="Condition"><select className={inputCls}><option>If opened</option><option>If clicked</option><option>If replied</option><option>If not opened</option></select></Field>
                    <Field label="Then"><select className={inputCls}><option>Continue sequence</option><option>Skip next step</option><option>Exit sequence</option><option>Add to segment</option></select></Field>
                    <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.07] p-3 text-[11.5px] text-violet-200">
                      <b>Note:</b> {selected.note ?? "Branch applied to all leads entering this step."}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 p-4">
                    <Field label={selected.type === "email" ? "Subject line" : "Task title"}>
                      <input
                        className={inputCls}
                        disabled={!editable}
                        value={subjectValue}
                        onChange={(e) => (armIsA ? patch({ subject: e.target.value }) : patchArm(armIdx, { subject: e.target.value }))}
                      />
                    </Field>

                    {selected.type === "email" && (
                      <>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">A/B variants</span>
                            {splitLabel && <span className="text-[11px] text-slate-500">{splitLabel}</span>}
                          </div>
                          <div className="flex gap-2">
                            {arms.map((v, i) => (
                              <button key={v.id} onClick={() => setVariantIdx(i)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-left transition ${armIdx === i ? "border-brand-500/60 bg-brand-500/10" : "border-ink-600 hover:bg-white/5"}`}>
                                <p className="text-[11px] font-medium text-white">{v.label}</p>
                                <p className="text-[10px] text-slate-500">{v.share}% traffic</p>
                              </button>
                            ))}
                            {editable && (
                              <button
                                onClick={addVariant}
                                disabled={saving}
                                className="grid w-10 place-items-center rounded-lg border border-dashed border-ink-600 text-slate-500 hover:border-brand-500/50 hover:text-brand-300"
                              >
                                <Icon name="plus" className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Body</span>
                            <div className="flex items-center gap-0.5 rounded-lg border border-ink-700 bg-ink-900 p-0.5">
                              {["bold", "italic", "link", "image", "code"].map((t) => (
                                <button key={t} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/[0.08] hover:text-white">
                                  <Icon name={t} className="h-3 w-3" />
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            rows={9}
                            disabled={!editable}
                            value={bodyValue}
                            onChange={(e) => (armIsA ? patch({ body: e.target.value }) : patchArm(armIdx, { body: e.target.value }))}
                            className="w-full resize-y rounded-lg border border-ink-600 bg-ink-850 p-3 text-[13px] leading-relaxed text-slate-200 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                          />
                          <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                            <span className="text-slate-600">{bodyValue.length} chars · {bodyValue.split(/\s+/).filter(Boolean).length} words</span>
                            <span className={bodyValue.length > 900 ? "text-amber-400" : "text-emerald-400"}>
                              {bodyValue.length > 900 ? "Too long for cold email" : "Good length"}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Insert variable</p>
                          <div className="flex flex-wrap gap-1.5">
                            {fields.map((v) => (
                              <button key={v}
                                disabled={!editable}
                                onClick={() => (armIsA ? patch({ body: `${bodyValue}{{${v}}}` }) : patchArm(armIdx, { body: `${bodyValue}{{${v}}}` }))}
                                className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10.5px] text-brand-200 ring-1 ring-inset ring-white/10 transition hover:bg-brand-500/20 disabled:opacity-50">
                                {`{{${v}}}`}
                              </button>
                            ))}
                            {/* "Rewrite with AI": no rewrite endpoint — hidden. */}
                          </div>
                        </div>

                        {/* "Track opens & clicks": the backend has no open/click tracking — hidden. */}
                      </>
                    )}

                    {selected.type !== "email" && (
                      <Field label="Instructions for rep">
                        <textarea rows={6} className={inputCls} value={selected.note ?? ""} onChange={(e) => patch({ note: e.target.value })} />
                      </Field>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-ink-700 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Ring value={selected.enabled ? 100 : 0} size={26} stroke={3} tone={selected.enabled ? "#34d399" : "#64748b"} label={selected.enabled ? "on" : "off"} />
                    {selected.enabled ? "Active in rotation" : "Paused step"}
                  </div>
                  <div className="flex gap-2">
                    {editable && (
                      <Button size="sm" variant="ghost" icon="copy" onClick={duplicateStep}>Duplicate</Button>
                    )}
                    <Button size="sm" variant="primary" icon="check" disabled={!editable || saving} onClick={save}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* preview */}
            {previewLead && (
              <Card pad={false}>
                <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
                  <span className="text-[13px] font-medium text-white">Inbox preview</span>
                  <div className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900 p-0.5">
                    {(["desktop", "mobile"] as const).map((d) => (
                      <button key={d} onClick={() => setDevice(d)}
                        className={`grid h-6 w-7 place-items-center rounded ${device === d ? "bg-white/[0.09] text-white" : "text-slate-500"}`}>
                        <Icon name={d === "desktop" ? "monitor" : "smartphone"} className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <div className={`mx-auto rounded-xl border border-ink-600 bg-white/[0.03] transition-all ${device === "mobile" ? "max-w-[280px]" : "max-w-full"}`}>
                    <div className="flex items-center gap-2 border-b border-ink-700 px-3.5 py-2.5">
                      {senderBox ? (
                        <>
                          <Avatar name={senderBox.from_name || senderBox.from_email.split("@")[0]} hue={(senderBox.from_email.charCodeAt(0) * 7) % 360} size={26} />
                          <div className="min-w-0">
                            <p className="truncate text-[11.5px] font-medium text-white">
                              {senderBox.from_name || senderBox.from_email} <span className="text-slate-500">&lt;{senderBox.from_email}&gt;</span>
                            </p>
                            <p className="truncate text-[10.5px] text-slate-500">to {previewLead.email}</p>
                          </div>
                        </>
                      ) : (
                        <div className="min-w-0">
                          <p className="truncate text-[11.5px] font-medium text-white">to {previewLead.email}</p>
                          <p className="truncate text-[10.5px] text-slate-500">No sending account assigned yet</p>
                        </div>
                      )}
                    </div>
                    <div className="px-3.5 py-3">
                      <p className="mb-2 text-[13px] font-semibold text-white">{preview?.subject ?? (previewLoading ? "Rendering…" : "")}</p>
                      <div className="text-[12.5px] text-slate-400">
                        {preview?.merge_error ? (
                          <p className="text-amber-300">Merge error: {preview.merge_error}</p>
                        ) : previewLoading && !preview ? (
                          <p className="text-slate-500">Rendering preview…</p>
                        ) : selectedPos < 1 ? (
                          <p className="text-slate-500">Save this new step to preview it.</p>
                        ) : preview ? (
                          renderLines(preview.body ?? "")
                        ) : (
                          <p className="text-slate-500">Preview unavailable.</p>
                        )}
                      </div>
                      <div className="mt-3 flex gap-2 border-t border-ink-700 pt-3 text-[10.5px] text-slate-600">
                        <span className="flex items-center gap-1"><Icon name="reply" className="h-3 w-3" /> Reply</span>
                        <span className="flex items-center gap-1"><Icon name="clock" className="h-3 w-3" /> Snooze</span>
                        <span className="flex items-center gap-1"><Icon name="archive" className="h-3 w-3" /> Archive</span>
                      </div>
                    </div>
                  </div>
                  {/* SpamAssassin claim: no spam scanner in the API — hidden. */}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "Overview" && (
        <div className="grid gap-4 xl:grid-cols-3">
          {/* "Daily volume" chart: the API has no time series — hidden. */}
          <div className="space-y-4">
            <Card>
              <SectionTitle title="Engagement split" />
              <div className="flex items-center gap-4">
                <Donut
                  segments={[
                    { label: "Replied", value: stats.replied, color: "#34d399" },
                    { label: "No reply", value: Math.max(0, stats.contacted - stats.replied), color: "#64748b" },
                  ]}
                  center={{ top: `${stats.reply_rate}%`, bottom: "reply rate" }}
                />
                <div className="flex-1 space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-slate-400">Replied</span><span className="text-emerald-300">{stats.replied.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">No reply</span><span className="text-slate-300">{Math.max(0, stats.contacted - stats.replied).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Unsubscribed</span><span className="text-rose-300">{stats.unsubscribed}</span></div>
                </div>
              </div>
            </Card>
            {variantRows.length > 0 && (
              <Card>
                <SectionTitle title="Top performing variant" />
                <div className="space-y-3">
                  {variantRows.map((v) => (
                    <div key={v.key}>
                      <div className="mb-1 flex justify-between text-[12px]"><span className="text-slate-300">{v.label}</span><span className="font-semibold text-white">{v.rate}%</span></div>
                      <Progress value={Math.min(100, v.rate * 10)} tone="brand" />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "Leads" && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-2 p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads in this campaign…"
              className="h-9 w-64 rounded-lg border border-ink-700 bg-ink-900/70 px-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-brand-500/60"
            />
            {/* "Filters": no filter options exist beyond search — hidden. */}
            <Button variant="default" icon="upload" size="sm" onClick={() => setImportOpen(true)}>Add leads</Button>
            <span className="ml-auto text-[11.5px] text-slate-500">{leadsLoading ? "Loading…" : `${shownLeads.length} of ${leadsTotal.toLocaleString()} leads`}</span>
          </div>
          {leadsError ? (
            <div className="px-4 pb-6 text-center text-[12px] text-slate-400">
              <p>{leadsError}</p>
              <button onClick={() => setLeadsKey((k) => k + 1)} className="mt-2 text-brand-300 hover:text-brand-200">Retry</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    {["Lead", "Stage", "Status", "Last activity", "Score"].map((h) => <th key={h} className="px-4 pb-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-slate-500">Loading leads…</td></tr>
                  )}
                  {!leadsLoading && shownLeads.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[12px] text-slate-500">No leads in this campaign yet.</td></tr>
                  )}
                  {shownLeads.map((l) => (
                    <tr key={l.id} className="border-t border-ink-700/60 transition hover:bg-white/[0.025]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.name} hue={l.avatarHue} size={30} />
                          <div><p className="text-[13px] font-medium text-white">{l.name}</p><p className="text-[11px] text-slate-500">{l.email}</p></div>
                        </div>
                      </td>
                      <td className="px-4 text-[12.5px] text-slate-300">{l.stage}</td>
                      <td className="px-4"><Badge tone={l.status === "replied" ? "emerald" : l.status === "bounced" ? "rose" : l.status === "paused" ? "amber" : "slate"}>{l.status}</Badge></td>
                      <td className="px-4 text-[12px] text-slate-500">{l.lastActivity}</td>
                      <td className="px-4 text-[13px] font-semibold text-white">{l.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "Schedule" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Sending window" sub="Times shown in leads' local timezone" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><input className={inputCls} disabled={!editable} value={`${String(startDraft).padStart(2, "0")}:00`} onChange={(e) => {
                  const h = Number(e.target.value.split(":")[0]);
                  if (Number.isInteger(h) && h >= 0 && h < 24) setStartDraft(h);
                }} /></Field>
                <Field label="End"><input className={inputCls} disabled={!editable} value={`${String(endDraft).padStart(2, "0")}:00`} onChange={(e) => {
                  const h = Number(e.target.value.split(":")[0]);
                  if (Number.isInteger(h) && h >= 1 && h <= 24) setEndDraft(h);
                }} /></Field>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Days</p>
                <div className="flex flex-wrap gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                    <button
                      key={d}
                      disabled={!editable}
                      onClick={() => setDaysDraft((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                      className={`h-9 w-12 rounded-lg border text-[12px] transition ${daysDraft.includes(i) ? "border-brand-500/60 bg-brand-500/10 text-brand-200" : "border-ink-600 text-slate-500"} disabled:opacity-60`}
                    >{d}</button>
                  ))}
                </div>
              </div>
              {/* "Emails per day (total)" slider: no campaign-level daily limit exists — hidden. */}
              {/* Send-interval / OOO / bounce toggles: not configurable via the API — hidden. */}
              <Button variant="primary" icon="check" className="w-full" disabled={!editable || saving} onClick={saveSchedule}>
                {saving ? "Saving…" : "Save schedule"}
              </Button>
            </div>
          </Card>
          <Card>
            <SectionTitle title="This week's plan" sub="Daily cap per assigned inbox" />
            <div className="space-y-3">
              {detail.mailboxes.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-[12.5px] text-slate-500">
                  No sending accounts assigned to this campaign yet.
                </p>
              )}
              {detail.mailboxes.map((m) => {
                const state = api.toMailbox(m);
                return (
                  <div key={m.id} className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.from_email.split("@")[0]} hue={(m.from_email.charCodeAt(0) * 7) % 360} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-white">{m.from_email}</p>
                        <p className="text-[10.5px] text-slate-500">{state.dailyLimit} sends/day · {daysShort} {detail.campaign.window_start_hour}:00–{detail.campaign.window_end_hour}:00</p>
                      </div>
                      <Badge tone={state.status === "healthy" ? "emerald" : state.status === "warming" ? "amber" : state.status === "error" ? "rose" : "slate"}>{state.status}</Badge>
                    </div>
                    <div className="mt-2.5">
                      <Progress value={state.dailyLimit ? (m.today_sent / state.dailyLimit) * 100 : 0} tone={m.today_sent / (state.dailyLimit || 1) > 0.85 ? "amber" : "brand"} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "Settings" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="General" />
            <div className="space-y-3.5">
              <Field label="Campaign name">
                <input className={inputCls} disabled={!editable} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
              </Field>
              {/* Owner and tags: no columns in the API — hidden. */}
            </div>
          </Card>
          <Card>
            <SectionTitle title="Sequence rules" />
            <div className="space-y-3">
              {/* Stop/restart/notify rules: not configurable via the API — hidden. */}
              <div className="flex gap-2 pt-1">
                <Button variant="danger" icon="trash" disabled={!editable || acting} onClick={archive}>
                  {acting ? "Working…" : "Archive"}
                </Button>
                <Button variant="primary" icon="check" className="flex-1" disabled={!editable || saving} onClick={saveSettings}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* more campaigns */}
      {others.length > 0 && (
        <div className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">Other campaigns</h3>
            <Button size="sm" variant="ghost" onClick={onBack} icon="chevronRight">View all</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map((c) => (
              <CampaignCard key={c.id} c={c} onOpen={onBack} view="grid" />
            ))}
          </div>
        </div>
      )}

      {/* import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setImportOpen(false)} />
          <div className="relative w-full max-w-lg animate-pop rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <h3 className="text-sm font-semibold text-white">Add leads to {campaign.name}</h3>
              <button onClick={() => setImportOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"><Icon name="x" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); readCsv(e.dataTransfer.files?.[0]); }}
                className="grid cursor-pointer place-items-center rounded-xl border border-dashed border-ink-600 bg-ink-900/50 px-4 py-10 text-center transition hover:border-brand-500/50"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-300"><Icon name="upload" className="h-5 w-5" /></div>
                <p className="mt-3 text-[13px] font-medium text-white">{importFile ? importFile.name : "Drop your CSV here"}</p>
                <p className="mt-1 text-[11.5px] text-slate-500">{importFile ? "Ready to import" : "or click to browse"}</p>
                <Button variant="default" size="sm" className="mt-3">{importFile ? "Choose another file" : "Choose file"}</Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => readCsv(e.target.files?.[0])}
                />
              </div>
              <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-400">
                <input type="checkbox" checked={lawful} onChange={(e) => setLawful(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-500" />
                I confirm I have a lawful basis to email these contacts and will honor opt-outs.
              </label>
              <div className="rounded-lg bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-slate-500">
                Required column: <code className="font-mono text-brand-200">email</code>. Optional: first_name, last_name, company, title, linkedin_url, custom variables.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3.5">
              <Button variant="default" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={importing} onClick={startImport}>{importing ? "Importing…" : "Start import"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
