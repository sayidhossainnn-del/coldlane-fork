/**
 * ColdLane API client for the /frontend UI (types from ./data).
 * Env: VITE_API_URL (origin, no trailing slash), VITE_API_KEY (sent as X-API-Key).
 * Passwords / LLM key are never read or stored here.
 */
import type { Campaign, Conversation, Lead, Mailbox, SequenceStep, Template } from "./data";

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_API_KEY?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];
  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function parseError(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === "object") {
    const body = payload as { error?: unknown; details?: unknown };
    const message =
      typeof body.error === "string" && body.error.trim() ? body.error : `Request failed (${status}).`;
    const details = Array.isArray(body.details)
      ? body.details.filter((d): d is string => typeof d === "string")
      : [];
    return new ApiError(status, message, details);
  }
  return new ApiError(status, `Request failed (${status}).`);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `Cannot reach the ColdLane API at ${BASE || window.location.origin}.`);
  }
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!res.ok) throw parseError(res.status, payload);
  return payload as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, init: RequestInit = {}) =>
    request<T>(path, { method: "POST", ...init, ...(body !== undefined ? json(body) : {}) }),
  put: <T>(path: string, body?: unknown, init: RequestInit = {}) =>
    request<T>(path, { method: "PUT", ...init, ...(body !== undefined ? json(body) : {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Error -> one-line message for the UI's own toast(). */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && err.message === "llm_not_configured") {
      return "AI is not configured yet. Set the provider in Settings > AI.";
    }
    const details = err.details.length ? ` ${err.details.join(" ")}` : "";
    return `${err.message}${details}`;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function toId(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed)) throw new ApiError(400, `Invalid id: ${value}`);
  return parsed;
}

/* ---------------- formatting ---------------- */
function parseUtc(value: string): Date {
  return new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseUtc(value);
  if (Number.isNaN(d.getTime())) return value;
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function leadName(fields: Record<string, string> | undefined, email: string): string {
  const full = [fields?.first_name, fields?.last_name].filter(Boolean).join(" ").trim();
  return full || email;
}

/* ---------------- raw shapes (threads) ---------------- */
export interface RawThread {
  lead_id: number;
  lead_email: string;
  campaign_id: number;
  campaign_name: string;
  last_message_at: string;
  last_snippet: string;
  unread_count: number;
  sentiment: string | null;
  intent: string | null;
}

export interface RawMessage {
  id: number;
  direction: "in" | "out";
  subject: string | null;
  body: string | null;
  received_at: string;
}

export interface RawLead {
  id: number;
  email: string;
  fields: Record<string, string>;
  sentiment: string | null;
}

export interface RawMailbox {
  id: number;
  from_email: string;
  active: number;
}

/* ---------------- adapters ---------------- */
function toSentiment(s: string | null): Conversation["sentiment"] {
  return s === "positive" || s === "negative" ? s : "neutral";
}

export function toConversation(raw: RawThread): Conversation {
  return {
    id: String(raw.lead_id),
    from: raw.lead_email,
    email: raw.lead_email,
    subject: "", // TODO(feature): GET /api/threads has no subject; filled on open
    preview: (raw.last_snippet ?? "").trim(),
    time: formatTimestamp(raw.last_message_at),
    unread: (raw.unread_count ?? 0) > 0,
    sentiment: toSentiment(raw.sentiment),
    campaign: raw.campaign_name ?? "",
    messages: [],
  };
}

/* ---------------- threads ---------------- */
export function listThreads(filter: "all" | "replied" | "unread" = "all", limit = 200) {
  return http
    .get<{ threads: RawThread[] }>(`/threads?filter=${filter}&limit=${limit}`)
    .then((r) => r.threads.map(toConversation));
}

export function getThread(leadId: string) {
  return http.get<{ lead: RawLead; messages: RawMessage[] }>(`/threads/${toId(leadId)}`);
}

export function markThreadRead(leadId: string) {
  return http.post<{ lead_id: number; marked_read: number }>(`/threads/${toId(leadId)}/read`);
}

export function sendReply(leadId: string, body: string) {
  return http.post<{ smtp_result: string }>(`/threads/${toId(leadId)}/reply`, { body });
}

export function draftReply(leadId: string, instructions?: string) {
  return http.post<{ draft: string }>(`/threads/${toId(leadId)}/draft-reply`, {
    ...(instructions ? { instructions } : {}),
  });
}

/* ---------------- mailboxes (inbox rail) ---------------- */
export function listMailboxes() {
  return http
    .get<{ mailboxes: RawMailbox[] }>("/mailboxes")
    .then((r) => r.mailboxes.map((m) => ({ email: m.from_email, active: !!m.active })));
}

/* ================================================================================
 * Extended client for the remaining views (Accounts, Templates, Campaigns,
 * CampaignDetail, Leads, Dashboard, Analytics, Settings).
 *
 * Same rules as the Inbox code above:
 * - numeric ids come back as strings for the UI (toId() converts them back),
 * - passwords / the LLM key are write-only: never read, never logged,
 * - raw API rows are mapped onto the existing view types in ./data, and fields the
 *   API has no data for are mapped to neutral zeros and hidden by the views.
 * ================================================================================ */

/* ---------------- formatting ---------------- */

/** "2026-10-13 09:42:00" (UTC) -> "Oct 13, 2026" in local time. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseUtc(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "0,1,2,3,4" -> "Mon–Fri" (consecutive days are compressed, gaps are listed). */
export function daysLabel(days: string | number[]): string {
  const list = (Array.isArray(days) ? days : days.split(","))
    .map((d) => Number(String(d).trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const uniq = [...new Set(list)].sort((a, b) => a - b);
  if (!uniq.length) return "No send days";
  const runs: number[][] = [];
  for (const d of uniq) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((run) => (run.length > 1 ? `${DAY_NAMES[run[0]]}–${DAY_NAMES[run[run.length - 1]]}` : DAY_NAMES[run[0]]))
    .join(", ");
}

/** "0,1,2,3,4" + 9..17 -> "Mon–Fri · 9:00–17:00" (+ optional timezone). */
export function scheduleLabel(c: {
  window_days?: string;
  window_start_hour?: number;
  window_end_hour?: number;
  timezone?: string;
}, withTimezone = false): string {
  const days = daysLabel(c.window_days ?? "");
  const start = c.window_start_hour ?? 0;
  const end = c.window_end_hour ?? 0;
  const base = `${days} · ${start}:00–${end}:00`;
  return withTimezone && c.timezone ? `${base} (${c.timezone})` : base;
}

/* ---------------- raw shapes (campaigns / steps / variants) ---------------- */

export interface RawCampaignStats {
  sent: number;
  gone_out: number;
  contacted: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  meetings: number;
  queued: number;
  active: number;
  statuses: Record<string, number>;
  total: number;
  waiting_cap: number;
  reply_rate: number;
  bounce_rate: number;
  per_step: Record<string, number>;
}

export interface RawCampaign {
  id: number;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  timezone: string;
  window_days: string;
  window_start_hour: number;
  window_end_hour: number;
  paused_reason: string | null;
  created_at: string;
  stats?: RawCampaignStats;
}

export interface RawStepVariant {
  /** null = arm "A" (the step's own content). */
  id: number | null;
  step_id: number;
  label: string;
  subject: string | null;
  body: string | null;
  weight: number;
  enabled: number;
  created_at: string | null;
  locked?: boolean;
}

export interface RawStep {
  id: number;
  campaign_id: number;
  position: number;
  subject: string;
  body: string;
  delay_minutes: number;
  weight?: number;
  locked?: boolean;
  variants?: RawStepVariant[];
}

export interface RawCampaignDetail {
  campaign: RawCampaign;
  steps: RawStep[];
  mailboxes: RawMailboxFull[];
  stats: RawCampaignStats;
  start_errors: string[];
  /** Present on PUT: positions the server refused to rewrite because they already sent. */
  locked_steps?: number[];
}

export interface RawVariantStatArm extends RawStepVariant {
  sent: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  reply_rate: number;
}

export interface RawVariantStats {
  campaign_id: number;
  steps: { step_id: number; position: number; subject: string; variants: RawVariantStatArm[] }[];
}

/* ---------------- raw shapes (mailboxes) ---------------- */

export interface RawMailboxFull {
  id: number;
  label: string;
  from_name: string;
  from_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_security: "starttls" | "ssl" | "none";
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_ssl: number;
  daily_cap: number;
  ramp_enabled: number;
  first_send_date: string | null;
  sender_address: string;
  signature: string;
  active: number;
  paused_reason: string | null;
  fail_count: number;
  last_error: string | null;
  last_error_at: string | null;
  next_send_at: string | null;
  created_at: string;
  has_smtp_password: boolean;
  has_imap_password: boolean;
  today_sent: number;
  effective_cap: number;
}

/* ---------------- raw shapes (leads) ---------------- */

/** A lead's status as the API stores it (mirrors coldlane's LEAD_STATUSES). */
export type ApiLeadStatus =
  | "queued"
  | "active"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "suppressed"
  | "merge_error"
  | "error"
  | "completed";

export interface RawLeadFull {
  id: number;
  campaign_id: number;
  campaign_name: string | null;
  email: string;
  status: ApiLeadStatus;
  mailbox_id: number | null;
  mailbox_label: string | null;
  mailbox_email: string | null;
  current_step: number;
  last_sent_at: string | null;
  reply_snippet: string | null;
  wait_reason: string | null;
  attempts: number;
  next_attempt_at: string | null;
  updated_at: string;
  fields: Record<string, string>;
  sentiment: string | null;
  intent: string | null;
  meeting_intent: boolean;
  summary: string | null;
  meeting_booked: boolean;
  meeting_note: string | null;
  score: number;
}

export interface LeadsResponse {
  total: number;
  limit: number;
  offset: number;
  leads: RawLeadFull[];
}

/* ---------------- raw shapes (templates, stats, AI settings, import, preview) ---------------- */

export interface RawTemplate {
  id: number;
  name: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatsResponse {
  total: { sent: number; replied: number; bounced: number; unsubscribed: number; meetings: number };
  campaigns: {
    campaign_id: number;
    name: string;
    status: RawCampaign["status"];
    sent: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    meetings: number;
    queued: number;
    active: number;
  }[];
}

export interface RawLlmSettings {
  base_url: string;
  model: string;
  enabled: boolean;
  draft_system_prompt: string;
  updated_at: string | null;
  has_key: boolean;
  configured: boolean;
  default_draft_system_prompt: string;
}

export interface LlmSettingsInput {
  base_url?: string;
  model?: string;
  api_key?: string;
  clear_api_key?: boolean;
  draft_system_prompt?: string;
  enabled?: boolean;
}

export interface RawPreview {
  campaign_id: number;
  lead_id: number;
  email: string;
  position: number;
  variant: string;
  fields: Record<string, string>;
  merge_error: string | null;
  subject: string | null;
  body: string | null;
  text: string | null;
}

export interface RawImportResult {
  import_id: number;
  campaign_id: number;
  filename: string;
  counts: { rows: number; imported: number; suppressed: number; invalid: number; duplicates: number };
  rejected: { row: number; email: string; reason: string }[];
  rejected_total: number;
  rejected_truncated: boolean;
}

/* ---------------- adapters: raw rows -> view types in ./data ---------------- */

/** The API's lead statuses (superset of the view's union) -> the view's union.
 * The precise status is still shown by views through `stage`. */
const LEAD_STATUS_MAP: Record<ApiLeadStatus, Lead["status"]> = {
  queued: "new",
  active: "active",
  replied: "replied",
  bounced: "bounced",
  completed: "completed",
  unsubscribed: "paused",
  suppressed: "paused",
  error: "paused",
  merge_error: "paused",
};

function leadStage(raw: RawLeadFull): string {
  if (raw.wait_reason) return raw.wait_reason;
  if (raw.status === "unsubscribed") return "Unsubscribed";
  if (raw.status === "suppressed") return "Suppressed";
  if (raw.status === "merge_error") return "Merge error";
  if (raw.status === "error") return "Error";
  if (raw.current_step > 0) return `Step ${raw.current_step}`;
  return "Not started";
}

export function toLead(raw: RawLeadFull): Lead {
  return {
    id: String(raw.id),
    name: leadName(raw.fields, raw.email),
    email: raw.email,
    company: raw.fields.company ?? "",
    title: raw.fields.title ?? "",
    location: raw.fields.location ?? "",
    status: LEAD_STATUS_MAP[raw.status] ?? "new",
    campaign: raw.campaign_name ?? "",
    lastActivity: formatTimestamp(raw.updated_at),
    score: raw.score ?? 0,
    stage: leadStage(raw),
    avatarHue: (raw.email.charCodeAt(0) * 37 + raw.id * 13) % 360,
  };
}

export function toCampaign(raw: RawCampaign): Campaign {
  const s = raw.stats;
  const total = s?.total ?? 0;
  const contacted = s?.contacted ?? 0;
  return {
    id: String(raw.id),
    name: raw.name,
    status: raw.status,
    leads: total,
    sent: s?.sent ?? 0,
    // No open tracking exists in the API: the views hide every "opened" element.
    opened: 0,
    replied: s?.replied ?? 0,
    // No aggregate positive-reply count exists in the API: hidden by the views.
    positive: 0,
    bounced: s?.bounced ?? 0,
    unsubscribed: s?.unsubscribed ?? 0,
    meetings: s?.meetings ?? 0,
    // No campaign-level daily limit exists; the detail view fills this from the
    // assigned mailboxes' caps and the list views hide it.
    dailyLimit: 0,
    // The list endpoint does not return assigned mailboxes; the detail view fills it.
    accounts: [],
    createdAt: formatDate(raw.created_at),
    // No owner/tags columns exist: hidden by the views.
    owner: "",
    tags: [],
    sequence: [],
    // Real progress: share of this campaign's leads that have been contacted.
    progress: total > 0 ? Math.min(100, Math.round((contacted / total) * 100)) : 0,
  };
}

function providerOf(host: string): Mailbox["provider"] {
  const h = (host ?? "").toLowerCase();
  if (/gmail|googlemail|google/.test(h)) return "Google";
  if (/office365|outlook|microsoft|exchange|smtp\.live/.test(h)) return "Microsoft";
  return "SMTP";
}

function mailboxStatus(raw: RawMailboxFull): Mailbox["status"] {
  if (raw.paused_reason || !raw.active) return "paused";
  if ((raw.fail_count ?? 0) > 0) return "error";
  // Still ramping: the server's effective cap for today is below the configured cap.
  if (raw.ramp_enabled && raw.effective_cap < raw.daily_cap) return "warming";
  return "healthy";
}

export function toMailbox(raw: RawMailboxFull): Mailbox {
  return {
    id: String(raw.id),
    email: raw.from_email,
    provider: providerOf(raw.smtp_host),
    status: mailboxStatus(raw),
    // No health score / open rate / per-mailbox campaign count exists in the API:
    // the Accounts view hides those elements.
    health: 0,
    warmupDays: 0,
    sentToday: raw.today_sent ?? 0,
    dailyLimit: raw.effective_cap ?? raw.daily_cap,
    campaigns: 0,
    openedRate: 0,
  };
}

export function toTemplate(raw: RawTemplate): Template {
  return {
    id: String(raw.id),
    name: raw.name,
    // No category / usage / reply-rate columns exist: the Templates view hides them.
    category: "",
    subject: raw.subject ?? "",
    body: raw.body ?? "",
    used: 0,
    replyRate: 0,
    updated: formatTimestamp(raw.updated_at),
  };
}

/** Raw steps -> SequenceSteps. Every step the backend stores is an email step;
 * `delay_minutes` is accumulated into each step's send day. */
export function toSequence(
  steps: RawStep[],
  stepStats?: Record<number, { sent: number; replied: number }>,
): SequenceStep[] {
  let day = 0;
  return steps.map((s) => {
    day += Math.round((s.delay_minutes ?? 0) / 1440);
    const stats = stepStats?.[s.position];
    return {
      id: String(s.id),
      type: "email" as const,
      title: s.subject || `Step ${s.position}`,
      dayOffset: day,
      waitDays: undefined,
      subject: s.subject,
      body: s.body,
      variants: (s.variants ?? []).map((a) => ({
        id: a.id === null ? `step-${s.id}-A` : String(a.id),
        label: `Variant ${a.label}`,
        subject: a.subject ?? "",
        body: a.body ?? "",
        share: a.weight ?? 100,
      })),
      // The backend has no per-step enable flag: always on, so the toggle is hidden.
      enabled: true,
      stats: stats && stats.sent > 0 ? { sent: stats.sent, opened: 0, replied: stats.replied } : undefined,
    };
  });
}

/* ---------------- campaigns ---------------- */

export function listCampaigns() {
  return http
    .get<{ campaigns: RawCampaign[] }>("/campaigns")
    .then((r) => r.campaigns.map(toCampaign));
}

export function getCampaign(id: string) {
  return http.get<RawCampaignDetail>(`/campaigns/${toId(id)}`);
}

export interface CampaignInput {
  name?: string;
  timezone?: string;
  days?: number[];
  window_start?: number;
  window_end?: number;
  mailbox_ids?: number[];
  steps?: { subject: string; body: string; delay_minutes: number }[];
}

export function createCampaign(input: CampaignInput) {
  return http.post<RawCampaignDetail>("/campaigns", input);
}

export function updateCampaign(id: string, input: CampaignInput) {
  return http.put<RawCampaignDetail & { locked_steps?: number[] }>(`/campaigns/${toId(id)}`, input);
}

export function deleteCampaign(id: string) {
  return http.del<{ deleted: number; campaign_name: string; leads_deleted: number }>(`/campaigns/${toId(id)}`);
}

export function startCampaign(id: string) {
  return http.post<{ id: number; status: string }>(`/campaigns/${toId(id)}/start`);
}

export function pauseCampaign(id: string) {
  return http.post<{ id: number; status: string; paused_reason: string | null }>(
    `/campaigns/${toId(id)}/pause`,
  );
}

export function getCampaignFields(id: string) {
  return http.get<{ campaign_id: number; fields: string[] }>(`/campaigns/${toId(id)}/fields`);
}

export function getCampaignVariants(id: string) {
  return http.get<RawVariantStats>(`/campaigns/${toId(id)}/variants`);
}

export function previewCampaign(id: string, leadId: string | number, options: { step?: number; variant?: string } = {}) {
  return http.post<RawPreview>(`/campaigns/${toId(id)}/preview`, {
    lead_id: typeof leadId === "number" ? leadId : toId(leadId),
    ...(options.step !== undefined ? { step: options.step } : {}),
    ...(options.variant ? { variant: options.variant } : {}),
  });
}

export function importLeads(id: string, input: { csv_text: string; filename: string; lawful_basis_confirmed: boolean }) {
  return http.post<RawImportResult>(`/campaigns/${toId(id)}/leads/import`, input);
}

/* ---------------- A/B variants ---------------- */

export function createVariant(
  campaignId: string,
  position: number,
  input: { subject: string; body: string; weight?: number },
) {
  return http.post<{ step_id: number; position: number; variant: RawStepVariant }>(
    `/campaigns/${toId(campaignId)}/steps/${position}/variants`,
    input,
  );
}

/** `variantId` is the numeric id of a stored arm (arm "A" has none). */
export function updateVariant(
  variantId: string | number,
  input: { subject?: string; body?: string; weight?: number; enabled?: boolean },
) {
  return http.put<{ variant: RawStepVariant }>(`/variants/${toId(variantId)}`, input);
}

/* ---------------- leads + stats ---------------- */

export function listLeads(options: { campaign_id?: string | number; status?: string; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (options.campaign_id !== undefined) params.set("campaign_id", String(options.campaign_id));
  if (options.status) params.set("status", options.status);
  params.set("limit", String(options.limit ?? 500));
  if (options.offset) params.set("offset", String(options.offset));
  return http.get<LeadsResponse>(`/leads?${params.toString()}`);
}

/** Every lead, page by page (the API caps one page at 500 rows). */
export async function listAllLeads(maxPages = 40): Promise<RawLeadFull[]> {
  const rows: RawLeadFull[] = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await listLeads({ limit: 500, offset });
    rows.push(...res.leads);
    offset += res.leads.length;
    if (!res.leads.length || offset >= res.total) break;
  }
  return rows;
}

export function getStats() {
  return http.get<StatsResponse>("/stats");
}

/* ---------------- templates ---------------- */

export function listTemplates() {
  return http.get<{ templates: RawTemplate[] }>("/templates").then((r) => r.templates.map(toTemplate));
}

export function createTemplate(input: { name: string; subject?: string; body?: string }) {
  return http.post<RawTemplate>("/templates", input).then(toTemplate);
}

export function updateTemplate(id: string, input: { name: string; subject?: string; body?: string }) {
  return http.put<RawTemplate>(`/templates/${toId(id)}`, input).then(toTemplate);
}

export function deleteTemplate(id: string) {
  return http.del<{ deleted: number }>(`/templates/${toId(id)}`);
}

/* ---------------- mailboxes (accounts) ---------------- */

export function listAccounts() {
  return http.get<{ mailboxes: RawMailboxFull[] }>("/mailboxes").then((r) => r.mailboxes.map(toMailbox));
}

export function listMailboxRows() {
  return http.get<{ mailboxes: RawMailboxFull[] }>("/mailboxes").then((r) => r.mailboxes);
}

/** Mailbox payload. Password fields are optional and only sent when the user typed one. */
export interface MailboxInput {
  label?: string;
  from_name?: string;
  from_email: string;
  smtp_host: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_security?: "starttls" | "ssl" | "none";
  smtp_password?: string;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_ssl?: boolean;
  daily_cap?: number;
  ramp_enabled?: boolean;
  sender_address?: string;
  signature?: string;
  active?: boolean;
}

export function createMailbox(input: MailboxInput) {
  return http.post<RawMailboxFull>("/mailboxes", input).then(toMailbox);
}

export function updateMailbox(id: string, input: Partial<MailboxInput>) {
  return http.put<RawMailboxFull>(`/mailboxes/${toId(id)}`, input).then(toMailbox);
}

export function testMailbox(id: string) {
  return http.post<{ ok: boolean; results: string[]; mailbox: RawMailboxFull }>(`/mailboxes/${toId(id)}/test`);
}

export function pauseMailbox(id: string) {
  return http.post<RawMailboxFull>(`/mailboxes/${toId(id)}/pause`);
}

export function resumeMailbox(id: string) {
  return http.post<RawMailboxFull>(`/mailboxes/${toId(id)}/resume`);
}

/* ---------------- AI (LLM) settings ---------------- */

export function getLlmSettings() {
  return http.get<{ settings: RawLlmSettings }>("/llm-settings").then((r) => r.settings);
}

/** `api_key` is write-only: blank keeps the stored key, the API never returns it. */
export function saveLlmSettings(input: LlmSettingsInput) {
  return http.put<{ settings: RawLlmSettings }>("/llm-settings", input).then((r) => r.settings);
}

export function testLlmSettings() {
  return http.post<{ ok: boolean; detail: string }>("/llm-settings/test");
}
