/**
 * ColdLane API client for the /frontend UI (types from ./data).
 * Env: VITE_API_URL (origin, no trailing slash), VITE_API_KEY (sent as X-API-Key).
 * Passwords / LLM key are never read or stored here.
 */
import type { Conversation } from "./data";

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
