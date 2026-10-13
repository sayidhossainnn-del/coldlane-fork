import { useCallback, useEffect, useState } from "react";
import { Card, SectionTitle, Progress, Icon } from "../components/ui";
import { Donut, FunnelBars } from "../components/Charts";
import * as api from "../lib/api";
import type { RawCampaign } from "../lib/api";
import type { Campaign } from "../lib/data";

/** AI intent labels of replied threads -> donut segments (only classified replies count). */
const INTENT_LABEL: Record<string, { label: string; color: string }> = {
  interested: { label: "Interested", color: "#34d399" },
  question: { label: "Question", color: "#fbbf24" },
  not_interested: { label: "Not a fit", color: "#f43f5e" },
  out_of_office: { label: "OOO", color: "#64748b" },
  referral: { label: "Other", color: "#a78bfa" },
  unsubscribe: { label: "Other", color: "#a78bfa" },
  other: { label: "Other", color: "#a78bfa" },
};

export function Analytics() {
  const [rawCampaigns, setRawCampaigns] = useState<RawCampaign[]>([]);
  const [intentCounts, setIntentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.http.get<{ campaigns: RawCampaign[] }>("/campaigns"),
      api.http.get<{ threads: { intent: string | null }[] }>("/threads?filter=replied&limit=200").catch(() => ({ threads: [] as { intent: string | null }[] })),
    ])
      .then(([c, t]) => {
        setRawCampaigns(c.campaigns);
        const counts: Record<string, number> = {};
        t.threads.forEach((row) => {
          if (!row.intent) return;
          const meta = INTENT_LABEL[row.intent] ?? { label: "Other", color: "#a78bfa" };
          counts[meta.label] = (counts[meta.label] ?? 0) + 1;
        });
        setIntentCounts(counts);
      })
      .catch((err) => setLoadError(api.errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const campaigns: Campaign[] = rawCampaigns.map(api.toCampaign);
  const totals = rawCampaigns.reduce(
    (a, c) => {
      const s = c.stats;
      if (!s) return a;
      return {
        sent: a.sent + s.sent,
        replied: a.replied + s.replied,
        meetings: a.meetings + s.meetings,
        leads: a.leads + s.total,
        goneOut: a.goneOut + s.gone_out,
        bounced: a.bounced + s.bounced,
      };
    },
    { sent: 0, replied: 0, meetings: 0, leads: 0, goneOut: 0, bounced: 0 },
  );
  const delivered = Math.max(0, totals.goneOut - totals.bounced);
  const deliveryRate = totals.goneOut ? (delivered / totals.goneOut) * 100 : 0;
  const bounceRate = totals.goneOut ? (totals.bounced / totals.goneOut) * 100 : 0;
  const conversion = totals.leads ? (totals.meetings / totals.leads) * 100 : 0;
  const intentSegments = Object.entries(intentCounts).map(([label, value]) => ({
    label,
    value,
    color: label === "Interested" ? "#34d399" : label === "Question" ? "#fbbf24" : label === "Not a fit" ? "#f43f5e" : label === "OOO" ? "#64748b" : "#a78bfa",
  }));
  const classified = intentSegments.reduce((a, s) => a + s.value, 0);
  const leaderboard = campaigns.filter((c) => c.sent > 0).sort((a, b) => b.replied / b.sent - a.replied / a.sent);

  if (loading) {
    return (
      <div className="space-y-5">
        <Card className="grid place-items-center py-16">
          <p className="text-[12px] text-slate-500">Loading analytics…</p>
        </Card>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-5">
        <Card className="grid place-items-center py-16 text-center">
          <p className="text-[12px] text-slate-400">{loadError}</p>
          <button onClick={load} className="mt-2 text-[12px] text-brand-300 hover:text-brand-200">Retry</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-white">Outbound analytics</h2>
          <p className="text-[12px] text-slate-500">Everything across campaigns, inboxes and sequences</p>
        </div>
        <div className="flex items-center gap-2">
          {/* "Export report" and range tabs: no export endpoint and no time-series data — hidden. */}
        </div>
      </div>

      {/* Headline metrics: only delivery rate has real data (deltas/sparklines need history — hidden). */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-start justify-between">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Delivery rate</p>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <p className="text-[24px] font-semibold leading-none tracking-tight text-white">{deliveryRate.toFixed(1)}%</p>
          </div>
        </Card>
        {/* Avg. reply time, cost per meeting and pipeline value have no API — hidden. */}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* "Volume & engagement trend" chart: the API has no time series — hidden. */}
        <Card>
          <SectionTitle title="Conversion funnel" sub="Whole account" />
          <FunnelBars
            steps={[
              { label: "Delivered", value: delivered, color: "#6366f1" },
              // "Opened" and "Positive": no data — hidden.
              { label: "Replied", value: totals.replied, color: "#34d399" },
              { label: "Meeting", value: totals.meetings, color: "#fbbf24" },
            ]}
          />
          <div className="mt-4 rounded-xl border border-ink-700 bg-ink-850/50 p-3">
            <p className="flex items-center gap-2 text-[11.5px] text-slate-400">
              <Icon name="target" className="h-3.5 w-3.5 text-violet-300" />
              Lead → meeting conversion: <b className="text-white">{conversion.toFixed(1)}%</b>
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* "Daily send volume" and send-time heatmap: no per-day/hour data — hidden. */}
        {classified > 0 && (
          <Card>
            <SectionTitle title="Reply breakdown" sub="Classified by AI" />
            <div className="flex items-center gap-5">
              <Donut size={132} segments={intentSegments} center={{ top: classified.toLocaleString(), bottom: "classified" }} />
              <div className="flex-1 space-y-2 text-[12px]">
                {intentSegments.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                    <span className="font-medium text-slate-200">{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
        {/* No classified replies yet: the reply-breakdown card is hidden. */}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <SectionTitle title="Deliverability health" sub="Across all campaigns" />
          <div className="space-y-4">
            {/* Inbox placement, domain reputation, DNS records and spam complaints have no
                API: hidden. Bounce rate below is computed from real counters. */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="text-slate-300">Bounce rate</span>
                <span className="font-semibold text-white">{bounceRate.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(100, bounceRate)} tone="rose" />
            </div>
          </div>
        </Card>

        <Card pad={false}>
          <div className="p-5 pb-3">
            <SectionTitle title="Campaign leaderboard" sub="Ranked by reply rate" />
          </div>
          <div className="space-y-1 px-2.5 pb-3">
            {leaderboard.length === 0 && (
              <p className="py-6 text-center text-[12px] text-slate-500">No sends yet.</p>
            )}
            {leaderboard.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-white/[0.04]">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${i === 0 ? "bg-amber-400/20 text-amber-300" : "bg-white/[0.06] text-slate-400"}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-white">{c.name}</p>
                  <p className="text-[10.5px] text-slate-500">{c.sent.toLocaleString()} sent</p>
                </div>
                <div className="text-right">
                  <p className="text-[12.5px] font-semibold text-emerald-300">{((c.replied / c.sent) * 100).toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-600">reply</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* "Inbox-level performance" table: the API has no per-mailbox aggregates — hidden. */}
    </div>
  );
}
