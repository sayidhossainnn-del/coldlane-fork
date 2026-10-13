import { useState } from "react";
import { Card, Badge, Button, Progress, Avatar, Icon, Tabs, Toggle, Field, inputCls, SectionTitle, Ring } from "../components/ui";
import { AreaChart, Donut } from "../components/Charts";
import { campaigns, leads as allLeads, rangeSeries, firstNameVars } from "../lib/data";
import type { SequenceStep, StepType } from "../lib/data";
import { CampaignCard } from "./Campaigns";

const stepMeta: Record<StepType, { icon: string; color: string; label: string }> = {
  email: { icon: "mail", color: "text-brand-300 bg-brand-500/12 ring-brand-500/25", label: "Email" },
  call: { icon: "phone", color: "text-amber-300 bg-amber-500/12 ring-amber-500/25", label: "Call task" },
  linkedin: { icon: "linkedin", color: "text-sky-300 bg-sky-500/12 ring-sky-500/25", label: "LinkedIn" },
  wait: { icon: "clock", color: "text-slate-300 bg-white/[0.06] ring-white/10", label: "Wait" },
  condition: { icon: "branch", color: "text-violet-300 bg-violet-500/12 ring-violet-500/25", label: "Condition" },
};

const STEP_LIB: StepType[] = ["email", "call", "linkedin", "wait", "condition"];

const relatedLeads = allLeads.slice(0, 7);

function renderPreview(body: string, leadName = "Sarah") {
  return body
    .replace(/\{\{first_name\}\}/g, leadName)
    .replace(/\{\{last_name\}\}/g, "Whitmore")
    .replace(/\{\{company\}\}/g, "Lumenstack")
    .replace(/\{\{title\}\}/g, "VP Engineering")
    .replace(/\{\{location\}\}/g, "Austin, TX")
    .split("\n")
    .map((line, i) => <p key={i} className="min-h-[1em] leading-relaxed">{line || "\u00A0"}</p>);
}

function StepNode({
  step,
  index,
  selected,
  onSelect,
  onToggle,
  onMove,
  onDelete,
}: {
  step: SequenceStep;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const meta = stepMeta[step.type];
  return (
    <div className="relative">
      {/* connector */}
      {index > 0 && (
        <div className="absolute left-[26px] top-[-18px] h-[18px] w-px bg-gradient-to-b from-transparent to-ink-600" />
      )}
      <div
        draggable
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
            {!step.enabled && <Badge tone="slate">off</Badge>}
          </div>
          <p className="mt-1 truncate text-[13px] font-medium text-white">{step.title}</p>
          {step.subject && <p className="mt-0.5 truncate text-[11.5px] text-slate-500">Subject: {step.subject}</p>}
          {step.note && <p className="mt-1 truncate text-[11px] italic text-slate-600">{step.note}</p>}

          {step.stats && (
            <div className="mt-2.5 flex items-center gap-4 text-[11px]">
              <span className="text-slate-500">Sent <b className="text-slate-300">{step.stats.sent.toLocaleString()}</b></span>
              <span className="text-slate-500">Open <b className="text-sky-300">{((step.stats.opened / step.stats.sent) * 100).toFixed(0)}%</b></span>
              <span className="text-slate-500">Reply <b className="text-emerald-300">{((step.stats.replied / step.stats.sent) * 100).toFixed(1)}%</b></span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" /></button>
          <button onClick={(e) => { e.stopPropagation(); onMove(1); }} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><Icon name="chevronDown" className="h-3.5 w-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"><Icon name="trash" className="h-3.5 w-3.5" /></button>
          <div onClick={(e) => { e.stopPropagation(); onToggle(); }} className="pl-1">
            <Toggle on={step.enabled} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CampaignDetail({ id, onBack, toast }: { id: string; onBack: () => void; toast: (m: string, t?: string) => void }) {
  const campaign = campaigns.find((c) => c.id === id) ?? campaigns[0];
  const [tab, setTab] = useState("Sequence");
  const [steps, setSteps] = useState<SequenceStep[]>(campaign.sequence);
  const [selectedId, setSelectedId] = useState(campaign.sequence[0]?.id ?? "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [variantIdx, setVariantIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const selected = steps.find((s) => s.id === selectedId) ?? steps[0];

  const patch = (p: Partial<SequenceStep>) => setSteps((prev) => prev.map((s) => (s.id === selected.id ? { ...s, ...p } : s)));

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
    setSelectedId(s.id);
    toast(`${meta.label} step added`, "brand");
  };

  const move = (sid: string, dir: -1 | 1) =>
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const p = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0");

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
                <span className="flex items-center gap-1.5"><Icon name="at" className="h-3.5 w-3.5" />{campaign.accounts.length} sending accounts</span>
                <span className="flex items-center gap-1.5"><Icon name="clock" className="h-3.5 w-3.5" />Mon–Fri · 9:00–17:00 (CST)</span>
                <span className="flex items-center gap-1.5"><Icon name="zap" className="h-3.5 w-3.5" />{campaign.dailyLimit}/day cap</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" icon="copy" onClick={() => toast("Campaign duplicated as draft", "brand")}>Duplicate</Button>
            <Button variant="default" icon="pause">Pause</Button>
            <Button variant="primary" icon="play" onClick={() => toast("Campaign resumed — sending now", "emerald")}>Resume</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-ink-700/60 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Delivered", `${p(campaign.sent - campaign.bounced, campaign.sent)}%`, "text-white"],
            ["Open rate", `${p(campaign.opened, campaign.sent)}%`, "text-sky-300"],
            ["Reply rate", `${p(campaign.replied, campaign.sent)}%`, "text-emerald-300"],
            ["Positive", `${p(campaign.positive, campaign.replied)}%`, "text-emerald-300"],
            ["Bounce", `${p(campaign.bounced, campaign.sent)}%`, "text-rose-300"],
            ["Meetings", campaign.meetings.toString(), "text-violet-300"],
          ].map(([l, v, c]) => (
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
                  <p className="mt-0.5 text-xs text-slate-500">{steps.length} steps · drag to reorder · avg. delay 3.2 days</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="emerald" dot>Auto-ongoing</Badge>
                  <Button size="sm" variant="default" icon="sparkles" onClick={() => toast("AI drafted a new follow-up", "violet")}>AI step</Button>
                </div>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const sid = e.dataTransfer.getData("text/plain");
                  if (sid) toast("Step reordered", "brand");
                }}
                className={`space-y-3 rounded-xl p-1 transition ${dragOver ? "ring-2 ring-brand-500/40" : ""}`}
              >
                {steps.map((s, i) => (
                  <StepNode
                    key={s.id}
                    step={s}
                    index={i}
                    selected={selected?.id === s.id}
                    onSelect={() => setSelectedId(s.id)}
                    onToggle={() => setSteps((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))}
                    onMove={(d) => move(s.id, d)}
                    onDelete={() => {
                      setSteps((prev) => prev.filter((x) => x.id !== s.id));
                      toast("Step removed", "rose");
                    }}
                  />
                ))}
              </div>

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
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle title="Step comparison" sub="Reply rate per step in this sequence" />
              <AreaChart
                data={rangeSeries["7d"]}
                height={150}
                series={[
                  { key: "replied", color: "#34d399", name: "Replies" },
                  { key: "opened", color: "#22d3ee", name: "Opens" },
                ]}
              />
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
                      <input className={inputCls} value={selected.subject ?? selected.title} onChange={(e) => patch(selected.type === "email" ? { subject: e.target.value } : { title: e.target.value })} />
                    </Field>

                    {selected.type === "email" && (
                      <>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">A/B variants</span>
                            <span className="text-[11px] text-slate-500">50 / 50 split</span>
                          </div>
                          <div className="flex gap-2">
                            {(selected.variants ?? [{ id: "only", label: "Variant A", share: 100, subject: "", body: "" }]).map((v, i) => (
                              <button key={v.id} onClick={() => setVariantIdx(i)}
                                className={`flex-1 rounded-lg border px-3 py-2 text-left transition ${variantIdx === i ? "border-brand-500/60 bg-brand-500/10" : "border-ink-600 hover:bg-white/5"}`}>
                                <p className="text-[11px] font-medium text-white">{v.label}</p>
                                <p className="text-[10px] text-slate-500">{v.share}% traffic</p>
                              </button>
                            ))}
                            <button className="grid w-10 place-items-center rounded-lg border border-dashed border-ink-600 text-slate-500 hover:border-brand-500/50 hover:text-brand-300">
                              <Icon name="plus" className="h-3.5 w-3.5" />
                            </button>
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
                            value={selected.body ?? ""}
                            onChange={(e) => patch({ body: e.target.value })}
                            className="w-full resize-y rounded-lg border border-ink-600 bg-ink-850 p-3 text-[13px] leading-relaxed text-slate-200 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20"
                          />
                          <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                            <span className="text-slate-600">{(selected.body ?? "").length} chars · {(selected.body ?? "").split(/\s+/).filter(Boolean).length} words</span>
                            <span className={((selected.body ?? "").length > 900 ? "text-amber-400" : "text-emerald-400")}>
                              {(selected.body ?? "").length > 900 ? "Too long for cold email" : "Good length"}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Insert variable</p>
                          <div className="flex flex-wrap gap-1.5">
                            {firstNameVars.map((v) => (
                              <button key={v}
                                onClick={() => patch({ body: `${selected.body ?? ""}{{${v}}}` })}
                                className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10.5px] text-brand-200 ring-1 ring-inset ring-white/10 transition hover:bg-brand-500/20">
                                {`{{${v}}}`}
                              </button>
                            ))}
                            <button onClick={() => toast("AI rewrote the email in your tone of voice", "violet")}
                              className="flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-[10.5px] font-medium text-violet-200 ring-1 ring-inset ring-violet-500/25 hover:bg-violet-500/25">
                              <Icon name="sparkles" className="h-3 w-3" /> Rewrite with AI
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900/50 px-3 py-2.5">
                          <div>
                            <p className="text-[12px] font-medium text-slate-200">Track opens & clicks</p>
                            <p className="text-[10.5px] text-slate-500">Adds a pixel + redirect wrapper</p>
                          </div>
                          <Toggle on onChange={() => {}} />
                        </div>
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
                    <Button size="sm" variant="ghost" icon="copy" onClick={() => { setSteps((prev) => [...prev, { ...selected, id: Math.random().toString(36).slice(2) }]); toast("Step duplicated", "brand"); }}>Duplicate</Button>
                    <Button size="sm" variant="primary" icon="check" onClick={() => toast("Step saved", "emerald")}>Save</Button>
                  </div>
                </div>
              </Card>
            )}

            {/* preview */}
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
                    <Avatar name={campaign.owner} hue={255} size={26} />
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-white">Alex Rivera <span className="text-slate-500">&lt;alex@northwind.io&gt;</span></p>
                      <p className="truncate text-[10.5px] text-slate-500">to sarah.w@lumenstack.com</p>
                    </div>
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="mb-2 text-[13px] font-semibold text-white">
                      {(selected?.subject ?? "").replace(/\{\{first_name\}\}/g, "Sarah").replace(/\{\{company\}\}/g, "Lumenstack")}
                    </p>
                    <div className="text-[12.5px] text-slate-400">{renderPreview(selected?.body ?? "")}</div>
                    <div className="mt-3 flex gap-2 border-t border-ink-700 pt-3 text-[10.5px] text-slate-600">
                      <span className="flex items-center gap-1"><Icon name="reply" className="h-3 w-3" /> Reply</span>
                      <span className="flex items-center gap-1"><Icon name="clock" className="h-3 w-3" /> Snooze</span>
                      <span className="flex items-center gap-1"><Icon name="archive" className="h-3 w-3" /> Archive</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/[0.07] p-2.5 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                  <Icon name="shield" className="h-3.5 w-3.5 shrink-0" />
                  No spam triggers detected. SpamAssassin score 0.8 / 5 · 2 links · no heavy images.
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "Overview" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <SectionTitle title="Daily volume" sub="Sends vs. opens vs. replies" right={<Badge tone="brand">Last 7 days</Badge>} />
            <AreaChart
              data={rangeSeries["30d"]}
              series={[
                { key: "sent", color: "#6366f1", name: "Sent" },
                { key: "opened", color: "#22d3ee", name: "Opened" },
                { key: "replied", color: "#34d399", name: "Replied" },
              ]}
            />
          </Card>
          <div className="space-y-4">
            <Card>
              <SectionTitle title="Engagement split" />
              <div className="flex items-center gap-4">
                <Donut
                  segments={[
                    { label: "Opened", value: campaign.opened, color: "#22d3ee" },
                    { label: "Unopened", value: campaign.sent - campaign.opened, color: "#334155" },
                  ]}
                  center={{ top: `${p(campaign.opened, campaign.sent)}%`, bottom: "opened" }}
                />
                <div className="flex-1 space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-slate-400">Opened</span><span className="text-white">{campaign.opened.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Unopened</span><span className="text-slate-300">{(campaign.sent - campaign.opened).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Replied</span><span className="text-emerald-300">{campaign.replied.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Unsubscribed</span><span className="text-rose-300">{campaign.unsubscribed}</span></div>
                </div>
              </div>
            </Card>
            <Card>
              <SectionTitle title="Top performing variant" />
              <div className="space-y-3">
                {[
                  ["Variant A — “quick idea”", 9.8, "brand"],
                  ["Variant B — “6 AEs”", 7.4, "sky"],
                ].map(([l, v, t]) => (
                  <div key={l as string}>
                    <div className="mb-1 flex justify-between text-[12px]"><span className="text-slate-300">{l}</span><span className="font-semibold text-white">{v}%</span></div>
                    <Progress value={(v as number) * 10} tone={t as string} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "Leads" && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-2 p-4">
            <input placeholder="Search leads in this campaign…" className="h-9 w-64 rounded-lg border border-ink-700 bg-ink-900/70 px-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-brand-500/60" />
            <Button variant="default" icon="filter" size="sm">Filters</Button>
            <Button variant="default" icon="upload" size="sm">Add leads</Button>
            <span className="ml-auto text-[11.5px] text-slate-500">{relatedLeads.length} of {campaign.leads.toLocaleString()} leads</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  {["", "Lead", "Stage", "Status", "Last activity", "Score"].map((h, i) => <th key={i} className="px-4 pb-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {relatedLeads.map((l) => (
                  <tr key={l.id} className="border-t border-ink-700/60 transition hover:bg-white/[0.025]">
                    <td className="w-10 px-4"><input type="checkbox" className="h-4 w-4 rounded accent-brand-500" /></td>
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
        </Card>
      )}

      {tab === "Schedule" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Sending window" sub="Times shown in leads' local timezone" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start"><input className={inputCls} defaultValue="09:00" /></Field>
                <Field label="End"><input className={inputCls} defaultValue="17:00" /></Field>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Days</p>
                <div className="flex flex-wrap gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                    <button key={d} className={`h-9 w-12 rounded-lg border text-[12px] transition ${i < 5 ? "border-brand-500/60 bg-brand-500/10 text-brand-200" : "border-ink-600 text-slate-500"}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-[11.5px]"><span className="text-slate-400">Emails per day (total)</span><span className="font-medium text-white">{campaign.dailyLimit}</span></div>
                <input type="range" min={0} max={1000} defaultValue={campaign.dailyLimit} className="w-full accent-brand-500" />
                <div className="mt-2 flex justify-between text-[10.5px] text-slate-600"><span>0</span><span>500</span><span>1000</span></div>
              </div>
              {[["Randomize send interval", true], ["Pause on out-of-office reply", true], ["Auto-pause on high bounce", true], ["Send follow-up to auto-replies", false]].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2.5">
                  <span className="text-[12.5px] text-slate-300">{l}</span>
                  <Toggle on={v as boolean} />
                </div>
              ))}
              <Button variant="primary" icon="check" className="w-full" onClick={() => toast("Schedule updated", "emerald")}>Save schedule</Button>
            </div>
          </Card>
          <Card>
            <SectionTitle title="This week's plan" sub="Projected sends per inbox" />
            <div className="space-y-3">
              {campaign.accounts.map((a, i) => (
                <div key={a} className="rounded-xl border border-ink-700/70 bg-ink-850/50 p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.split("@")[0]} hue={(a.charCodeAt(0) * 7) % 360} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-white">{a}</p>
                      <p className="text-[10.5px] text-slate-500">{Math.round(campaign.dailyLimit / campaign.accounts.length)} sends/day · {["Mon–Fri 9–5", "Mon–Thu 8–4", "Tue–Fri 10–6"][i % 3]}</p>
                    </div>
                    <Badge tone="emerald">healthy</Badge>
                  </div>
                  <div className="mt-2.5"><Progress value={40 + i * 15} tone={i % 2 ? "sky" : "brand"} /></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "Settings" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="General" />
            <div className="space-y-3.5">
              <Field label="Campaign name"><input className={inputCls} defaultValue={campaign.name} /></Field>
              <Field label="Owner"><select className={inputCls}><option>Alex Rivera</option><option>Maya Chen</option><option>Leo Novak</option></select></Field>
              <Field label="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {[...campaign.tags, "outbound"].map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-white/10">
                      {t}<button className="text-slate-500 hover:text-rose-300"><Icon name="x" className="h-3 w-3" /></button>
                    </span>
                  ))}
                  <button className="rounded-md border border-dashed border-ink-600 px-2 py-1 text-[11px] text-slate-500 hover:text-white">+ add</button>
                </div>
              </Field>
            </div>
          </Card>
          <Card>
            <SectionTitle title="Sequence rules" />
            <div className="space-y-3">
              {[["Stop sequence on reply", true], ["Stop on positive reply only", false], ["Exclude unsubscribed domain-wide", true], ["Restart sequence for re-engaged leads", false], ["Notify me on every reply", true], ["Auto-assign replies to round-robin owners", false]].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2.5">
                  <span className="text-[12.5px] text-slate-300">{l}</span>
                  <Toggle on={v as boolean} />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="danger" icon="trash" onClick={() => toast("Archive requires owner confirmation", "amber")}>Archive</Button>
                <Button variant="primary" icon="check" className="flex-1" onClick={() => toast("Settings saved", "emerald")}>Save changes</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* more campaigns */}
      <div className="pt-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight text-white">Other campaigns</h3>
          <Button size="sm" variant="ghost" onClick={onBack} icon="chevronRight">View all</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.filter((c) => c.id !== campaign.id).slice(0, 3).map((c) => (
            <CampaignCard key={c.id} c={c} onOpen={onBack} view="grid" />
          ))}
        </div>
      </div>
    </div>
  );
}
