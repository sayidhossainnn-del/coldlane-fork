/**
 * ColdLane JSON API client.
 *
 * One `fetch` wrapper (`request`) plus thin adapters that map the API's payloads onto
 * the view types in `../data/mock` (numeric ids become strings for the UI and are
 * converted back when a payload is sent).
 *
 * Config comes from the environment: `VITE_API_URL` (base origin, no trailing slash)
 * and `VITE_API_KEY` (sent as `X-API-Key`). Server-side error messages
 * (`{"error": "..."}`, optionally with `details: []`) are surfaced through `toast()`.
 *
 * Security notes:
 * - Passwords and the LLM API key are write-only: the API never returns them and this
 *   module never stores or logs them. Mailbox/LLM forms send a password only when the
 *   user typed a new one.
 * - Nothing here logs request bodies.
 */
import type {
  Campaign,
  CampaignStatus,
  CampaignStats,
  EmailAccount,
  InboxThread,
  Lead,
  Template,
} from "../data/mock";

/** A lead's status as the API stores it (mirrors coldlane's LEAD_STATUSES). */
export type LeadStatus =
  | "queued"
  | "active"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "suppressed"
  | "merge_error"
  | "error"
  | "completed";

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

/** An API failure: HTTP status plus the server's own message. */
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

/** True when the AI endpoints should answer 409 llm_not_configured. */
export function isLlmNotConfigured(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.message === "llm_not_configured";
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
  send: <T>(path: string, init: RequestInit) => request<T>(path, init),
};

// ---------------------------------------------------------------- toasts
// A tiny self-contained toast host. It lives in this module so no component's markup
// or styling has to change just to report API feedback.
type ToastKind = "success" | "error" | "info";

const TOAST_STYLES: Record<ToastKind, { bg: string; border: string; fg: string }> = {
  success: { bg: "#047857", border: "#6ee7b7", fg: "#ffffff" },
  error: { bg: "#fff1f2", border: "#fecdd3", fg: "#be123c" },
  info: { bg: "#ffffff", border: "#e2e8f0", fg: "#334155" },
};

let toastHost: HTMLDivElement | null = null;
let toastTimer: number | null = null;

export function toast(message: string, kind: ToastKind = "info"): void {
  if (typeof document === "undefined") return;
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.setAttribute("data-testid", "api-toast-host");
    toastHost.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:1000;display:flex;flex-direction:column;" +
      "gap:8px;align-items:flex-end;pointer-events:none;max-width:min(420px,90vw);";
    document.body.appendChild(toastHost);
  }
  toastHost.innerHTML = "";
  const style = TOAST_STYLES[kind];
  const el = document.createElement("div");
  el.style.cssText =
    `background:${style.bg};border:1px solid ${style.border};color:${style.fg};` +
    "border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.45;font-weight:500;" +
    "box-shadow:0 8px 24px rgba(15,23,42,.12);white-space:pre-wrap;pointer-events:auto;";
  el.textContent = message;
  toastHost.appendChild(el);
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.remove();
    if (toastHost && toastHost.childElementCount === 0) {
      toastHost.remove();
      toastHost = null;
    }
  }, kind === "error" ? 7000 : 4000);
}

/** Toast an API error with its message and any per-field details. */
export function toastError(err: unknown): void {
  if (err instanceof ApiError) {
    const details = err.details.length ? `\n${err.details.join("\n")}` : "";
    if (err.status === 409 && err.message === "llm_not_configured") {
      toast("AI is not configured yet — set the provider in Settings → AI Assistant.", "error");
      return;
    }
    toast(`${err.message}${details}`, "error");
    return;
  }
  toast(err instanceof Error ? err.message : "Something went wrong.", "error");
}

// ---------------------------------------------------------------- shared raw shapes
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
  stats?: CampaignStats;
}

export interface RawStepVariant {
  id: number | null; // null = arm 'A' (the step's own content)
  step_id: number;
  label: string;
  subject: string | null;
  body: string | null;
  weight: number;
  enabled: number;
  created_at: string | null;
  locked: boolean;
}

export interface RawStep {
  id: number;
  campaign_id: number;
  position: number;
  subject: string;
  body: string;
  delay_minutes: number;
  weight: number;
  locked?: boolean;
  variants?: RawStepVariant[];
}

export interface RawThread {
  lead_id: number;
  lead_email: string;
  lead_status: LeadStatus;
  campaign_id: number;
  campaign_name: string;
  mailbox_id: number | null;
  mailbox_email: string | null;
  last_message_at: string;
  last_kind: string;
  last_direction: string;
  last_snippet: string;
  unread_count: number;
  sentiment: string | null;
  intent: string | null;
  meeting_intent: number;
  summary: string | null;
  meeting_booked_at: string | null;
  meeting_note: string | null;
  score: number;
}

export interface RawMessage {
  id: number;
  lead_id: number;
  direction: "in" | "out";
  kind: string;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  body: string | null;
  received_at: string;
}

export interface RawLead {
  id: number;
  campaign_id: number;
  campaign_name?: string;
  email: string;
  fields: Record<string, string>;
  status: LeadStatus;
  mailbox_id: number | null;
  mailbox_label?: string | null;
  mailbox_email?: string | null;
  current_step: number;
  last_sent_at: string | null;
  wait_reason: string | null;
  next_attempt_at: string | null;
  updated_at: string;
  sentiment: string | null;
  intent: string | null;
  meeting_intent: boolean;
  summary: string | null;
  meeting_booked: boolean;
  meeting_note: string | null;
  score: number;
}

export interface RawMailbox {
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
  has_smtp_password: boolean;
  has_imap_password: boolean;
  today_sent: number;
  effective_cap: number;
  created_at: string;
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
  steps: {
    step_id: number;
    position: number;
    subject: string;
    variants: RawVariantStatArm[];
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

export interface RawImportResult {
  import_id: number;
  campaign_id: number;
  filename: string;
  counts: { rows: number; imported: number; suppressed: number; invalid: number; duplicates: number };
  rejected: { row: number; email: string; reason: string }[];
  rejected_total: number;
  rejected_truncated: boolean;
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

export interface RawClassification {
  sentiment: string;
  intent: string;
  meeting_intent: number;
  summary: string;
  classified_message_id: number;
  model: string;
  updated_at: string;
}

// ---------------------------------------------------------------- formatting helpers
/** "2026-10-13 09:42:00" (UTC) -> a short local time label, never a fake one. */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  if (Number.isNaN(parsed.getTime())) return value;
  const now = new Date();
  const sameDay = parsed.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === parsed.toDateString();
  const time = parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  if (yesterday) return `Yesterday`;
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export function leadName(fields: Record<string, string> | undefined, email: string): string {
  const full = [fields?.first_name, fields?.last_name].filter(Boolean).join(" ").trim();
  return full || email;
}

export function leadCompany(fields: Record<string, string> | undefined): string {
  return fields?.company ?? "";
}

export function leadTitle(fields: Record<string, string> | undefined): string {
  return fields?.title ?? "";
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Not Contacted",
  active: "Contacted",
  replied: "Replied",
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  suppressed: "Suppressed",
  merge_error: "Merge Error",
  error: "Error",
  completed: "Completed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const CAMPAIGN_STATUS: Record<RawCampaign["status"], CampaignStatus> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export function campaignStatusLabel(status: RawCampaign["status"]): CampaignStatus {
  return CAMPAIGN_STATUS[status] ?? "Draft";
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function sentimentLabel(sentiment: string | null | undefined): string {
  return sentiment ? SENTIMENT_LABELS[sentiment] ?? sentiment : "";
}

const INTENT_LABELS: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not Interested",
  question: "Question",
  out_of_office: "Out of Office",
  referral: "Referral",
  unsubscribe: "Unsubscribe",
  other: "Other",
};

export function intentLabel(intent: string | null | undefined): string {
  return intent ? INTENT_LABELS[intent] ?? intent : "";
}

// ---------------------------------------------------------------- adapters
type InboxCategory = InboxThread["category"] | "";

/** The Unibox rail label for a thread, derived from real AI labels (never invented). */
export function threadCategory(raw: RawThread): InboxCategory {
  if (raw.meeting_booked_at) return "Meeting Booked";
  if (raw.intent === "interested") return "Interested";
  if (raw.intent === "not_interested") return "Not Interested";
  if (raw.intent === "out_of_office") return "Out of Office";
  if ((raw.unread_count ?? 0) > 0) return "Needs Reply";
  return "";
}

export function toInboxThread(raw: RawThread): InboxThread {
  return {
    id: String(raw.lead_id),
    name: raw.lead_email,
    email: raw.lead_email,
    company: "",
    campaign: raw.campaign_name ?? "",
    // TODO(feature): thread subject in the list — GET /api/threads has no subject column
    subject: "",
    preview: (raw.last_snippet ?? "").trim(),
    time: formatTimestamp(raw.last_message_at),
    unread: (raw.unread_count ?? 0) > 0,
    category: threadCategory(raw),
    messages: [],
    score: raw.score ?? 0,
    sentiment: raw.sentiment,
    intent: raw.intent,
    meetingBooked: !!raw.meeting_booked_at,
    summary: raw.summary,
    campaignId: raw.campaign_id,
  };
}

export function toLead(raw: RawLead): Lead {
  return {
    id: String(raw.id),
    name: leadName(raw.fields, raw.email),
    email: raw.email,
    company: leadCompany(raw.fields),
    title: leadTitle(raw.fields),
    status: statusLabel(raw.status),
    rawStatus: raw.status,
    campaign: raw.campaign_name ?? "",
    campaignId: raw.campaign_id,
    score: raw.score ?? 0,
    sentiment: raw.sentiment,
    meetingBooked: !!raw.meeting_booked,
    meetingNote: raw.meeting_note,
  };
}

export function toCampaign(raw: RawCampaign): Campaign {
  const stats = raw.stats;
  const total = stats?.total ?? 0;
  const sent = stats?.sent ?? 0;
  return {
    id: String(raw.id),
    name: raw.name,
    status: campaignStatusLabel(raw.status),
    rawStatus: raw.status,
    sent,
    replies: stats?.replied ?? 0,
    bounced: stats?.bounced ?? 0,
    meetings: stats?.meetings ?? 0,
    replyRate: stats?.reply_rate ?? 0,
    // Progress = share of this campaign's leads that have been sent to (real arithmetic).
    progress: total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0,
    leads: total,
    createdAt: raw.created_at,
    timezone: raw.timezone,
    windowDays: (raw.window_days ?? "").split(",").map((d) => Number(d.trim())).filter((d) => !Number.isNaN(d)),
    windowStart: raw.window_start_hour,
    windowEnd: raw.window_end_hour,
    pausedReason: raw.paused_reason,
    stats,
  };
}

export function toMailbox(raw: RawMailbox): EmailAccount {
  return {
    id: String(raw.id),
    label: raw.label,
    email: raw.from_email,
    // The API stores the provider's server, not a vendor brand: show the host as-is.
    provider: raw.smtp_host || "SMTP",
    dailyLimit: raw.daily_cap,
    sentToday: raw.today_sent,
    effectiveCap: raw.effective_cap,
    fromName: raw.from_name,
    fromEmail: raw.from_email,
    smtpHost: raw.smtp_host,
    smtpPort: raw.smtp_port,
    smtpUser: raw.smtp_user,
    smtpSecurity: raw.smtp_security,
    imapHost: raw.imap_host,
    imapPort: raw.imap_port,
    imapUser: raw.imap_user,
    imapSsl: !!raw.imap_ssl,
    senderAddress: raw.sender_address,
    signature: raw.signature,
    active: !!raw.active,
    pausedReason: raw.paused_reason,
    failCount: raw.fail_count,
    lastError: raw.last_error,
    hasSmtpPassword: raw.has_smtp_password,
    hasImapPassword: raw.has_imap_password,
    lastSendAt: raw.first_send_date,
  };
}

export function toTemplate(raw: {
  id: number;
  name: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
}): Template {
  return {
    id: String(raw.id),
    name: raw.name,
    subject: raw.subject ?? "",
    body: raw.body ?? "",
    updatedAt: raw.updated_at,
  };
}

// ---------------------------------------------------------------- threads
export interface ThreadListResponse {
  filter: string;
  limit: number;
  offset: number;
  threads: RawThread[];
}

export function listThreads(filter: "all" | "replied" | "unread" = "all", limit = 200) {
  return http
    .get<ThreadListResponse>(`/threads?filter=${filter}&limit=${limit}`)
    .then((r) => r.threads.map(toInboxThread));
}

export interface ThreadDetail {
  lead: RawLead;
  messages: RawMessage[];
}

export function getThread(leadId: string) {
  return http.get<ThreadDetail>(`/threads/${toId(leadId)}`);
}

export function markThreadRead(leadId: string) {
  return http.post<{ lead_id: number; marked_read: number }>(`/threads/${toId(leadId)}/read`);
}

export interface ReplyResult {
  lead_id: number;
  mailbox_id: number;
  message_id: string;
  subject: string;
  smtp_result: string;
  remaining_capacity: number;
}

/** Send a manual reply. Throws ApiError with the server's 409/429/502 message. */
export function sendReply(leadId: string, body: string) {
  return http.post<ReplyResult>(`/threads/${toId(leadId)}/reply`, { body });
}

export function classifyThread(leadId: string) {
  return http.post<{ lead_id: number; classification: RawClassification }>(
    `/threads/${toId(leadId)}/classify`,
  );
}

/** Draft a reply body. Nothing is stored or sent by the server. */
export function draftReply(leadId: string, instructions?: string) {
  return http.post<{ lead_id: number; draft: string }>(`/threads/${toId(leadId)}/draft-reply`, {
    ...(instructions ? { instructions } : {}),
  });
}

// ---------------------------------------------------------------- templates
export function listTemplates() {
  return http
    .get<{ templates: { id: number; name: string; subject: string | null; body: string | null; created_at: string; updated_at: string }[] }>(
      "/templates",
    )
    .then((r) => r.templates.map(toTemplate));
}

export function createTemplate(input: { name: string; subject?: string; body?: string }) {
  return http.post<{ id: number; name: string; subject: string | null; body: string | null; created_at: string; updated_at: string }>(
    "/templates",
    input,
  ).then(toTemplate);
}

export function updateTemplate(id: string, input: { name: string; subject?: string; body?: string }) {
  return http
    .put<{ id: number; name: string; subject: string | null; body: string | null; created_at: string; updated_at: string }>(
      `/templates/${toId(id)}`,
      input,
    )
    .then(toTemplate);
}

export function deleteTemplate(id: string) {
  return http.del<{ deleted: number }>(`/templates/${toId(id)}`);
}

// ---------------------------------------------------------------- mailboxes
export function listMailboxes() {
  return http.get<{ mailboxes: RawMailbox[] }>("/mailboxes").then((r) => r.mailboxes.map(toMailbox));
}

/** Mailbox payload. Password fields are optional and only sent when the user typed one. */
export interface MailboxInput {
  label: string;
  from_name: string;
  from_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_security: "starttls" | "ssl" | "none";
  smtp_password?: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_ssl: boolean;
  daily_cap: number;
  ramp_enabled: boolean;
  sender_address: string;
  signature: string;
  active: boolean;
}

export function createMailbox(input: MailboxInput) {
  return http.post<RawMailbox>("/mailboxes", input).then(toMailbox);
}

export function updateMailbox(id: string, input: Partial<MailboxInput>) {
  return http.put<RawMailbox>(`/mailboxes/${toId(id)}`, input).then(toMailbox);
}

export function testMailbox(id: string) {
  return http.post<{ ok: boolean; results: string[]; mailbox: RawMailbox }>(
    `/mailboxes/${toId(id)}/test`,
  );
}

export function pauseMailbox(id: string) {
  return http.post<RawMailbox>(`/mailboxes/${toId(id)}/pause`).then(toMailbox);
}

export function resumeMailbox(id: string) {
  return http.post<RawMailbox>(`/mailboxes/${toId(id)}/resume`).then(toMailbox);
}

// ---------------------------------------------------------------- campaigns
export function listCampaigns() {
  return http
    .get<{ campaigns: RawCampaign[] }>("/campaigns")
    .then((r) => r.campaigns.map(toCampaign));
}

export interface CampaignDetailResponse {
  campaign: RawCampaign;
  steps: RawStep[];
  mailboxes: RawMailbox[];
  stats: CampaignStats;
  start_errors: string[];
}

export function getCampaign(id: string) {
  return http.get<CampaignDetailResponse>(`/campaigns/${toId(id)}`);
}

export interface CampaignInput {
  name?: string;
  timezone?: string;
  days?: number[];
  window_start?: number;
  window_end?: number;
  mailbox_ids?: number[];
  steps?: { position: number; subject: string; body: string; delay_minutes: number }[];
}

export function createCampaign(input: CampaignInput) {
  return http.post<CampaignDetailResponse>("/campaigns", input);
}

export function updateCampaign(id: string, input: CampaignInput & { steps?: CampaignInput["steps"] }) {
  return http.put<CampaignDetailResponse>(`/campaigns/${toId(id)}`, input);
}

export function deleteCampaign(id: string) {
  return http.del<{ deleted: { campaign: number; steps: number; leads: number } | Record<string, number> }>(
    `/campaigns/${toId(id)}`,
  );
}

export function startCampaign(id: string) {
  return http.post<{ id: number; status: string }>(`/campaigns/${toId(id)}/start`);
}

export function pauseCampaign(id: string) {
  return http.post<{ id: number; status: string; paused_reason: string | null }>(
    `/campaigns/${toId(id)}/pause`,
  );
}

export function getCampaignSteps(id: string) {
  return http.get<{ campaign_id: number; steps: RawStep[] }>(`/campaigns/${toId(id)}/steps`);
}

export function getCampaignFields(id: string) {
  return http.get<{ campaign_id: number; fields: string[] }>(`/campaigns/${toId(id)}/fields`);
}

export function previewCampaign(id: string, leadId: number, options: { step?: number; variant?: string } = {}) {
  return http.post<RawPreview>(`/campaigns/${toId(id)}/preview`, {
    lead_id: leadId,
    ...(options.step !== undefined ? { step: options.step } : {}),
    ...(options.variant ? { variant: options.variant } : {}),
  });
}

export function importLeads(id: string, input: { csv_text: string; filename: string; lawful_basis_confirmed: boolean }) {
  return http.post<RawImportResult>(`/campaigns/${toId(id)}/leads/import`, input);
}

// ---------------------------------------------------------------- leads + stats
export interface LeadsResponse {
  total: number;
  limit: number;
  offset: number;
  leads: RawLead[];
}

export function listLeads(options: { campaign_id?: number; status?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.campaign_id) params.set("campaign_id", String(options.campaign_id));
  if (options.status) params.set("status", options.status);
  params.set("limit", String(options.limit ?? 500));
  return http.get<LeadsResponse>(`/leads?${params.toString()}`);
}

export function setMeeting(leadId: string, note?: string) {
  return http.post<{ lead: RawLead }>(`/leads/${toId(leadId)}/meeting`, note ? { note } : {});
}

export function clearMeeting(leadId: string) {
  return http.del<{ lead: RawLead }>(`/leads/${toId(leadId)}/meeting`);
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

export function getStats() {
  return http.get<StatsResponse>("/stats");
}

// ---------------------------------------------------------------- A/B variants
export function getCampaignVariants(id: string) {
  return http.get<RawVariantStats>(`/campaigns/${toId(id)}/variants`);
}

export function createVariant(campaignId: string, position: number, input: { subject: string; body: string; weight?: number }) {
  return http.post<{ step_id: number; position: number; variant: RawStepVariant }>(
    `/campaigns/${toId(campaignId)}/steps/${position}/variants`,
    input,
  );
}

export function updateVariant(
  variantId: number,
  input: { subject?: string; body?: string; weight?: number; enabled?: boolean },
) {
  return http.put<{ variant: RawStepVariant }>(`/variants/${variantId}`, input);
}

export function deleteVariant(variantId: number) {
  return http.del<{ id: number; deleted: boolean; disabled: boolean; reason?: string }>(
    `/variants/${variantId}`,
  );
}

export function setVariantWeights(campaignId: string, position: number, weights: Record<string, number>) {
  return http.put<{ position: number; weights: { label: string; weight: number }[] }>(
    `/campaigns/${toId(campaignId)}/steps/${position}/weights`,
    { weights },
  );
}

// ---------------------------------------------------------------- AI settings
export function getLlmSettings() {
  return http.get<{ settings: RawLlmSettings }>("/llm-settings").then((r) => r.settings);
}

export interface LlmSettingsInput {
  base_url?: string;
  model?: string;
  api_key?: string;
  clear_api_key?: boolean;
  draft_system_prompt?: string;
  enabled?: boolean;
}

export function saveLlmSettings(input: LlmSettingsInput) {
  return http.put<{ settings: RawLlmSettings }>("/llm-settings", input).then((r) => r.settings);
}

export function testLlmSettings() {
  return http.post<{ ok: boolean; detail: string }>("/llm-settings/test");
}

// ---------------------------------------------------------------- misc
/** The API uses numeric ids; the UI uses strings. */
export function toId(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed)) throw new ApiError(400, `Invalid id: ${value}`);
  return parsed;
}
