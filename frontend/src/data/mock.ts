/**
 * View-model types shared by the app.
 *
 * The mock data that used to live here is gone: every view now reads the real ColdLane
 * JSON API through `../lib/api.ts`, which adapts API payloads into these types (numeric
 * ids become strings). Fields the API does not report are optional and are hidden in the
 * UI with `// TODO(feature): …` comments.
 */

export type CampaignStatus = "Active" | "Paused" | "Draft" | "Completed";

/** The numbers GET /api/stats and GET /api/campaigns/{id} actually report. */
export interface CampaignStats {
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

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  sent: number;
  // TODO(feature): opens and open rates — ColdLane tracks no opens
  opens?: number;
  replies: number;
  // TODO(feature): "interested" as its own counter — the API reports replies only
  interested?: number;
  bounced: number;
  // TODO(feature): click rates — ColdLane tracks no clicks
  clickRate?: number;
  progress: number;
  leads: number;
  createdAt: string;
  // TODO(feature): sender count inside the campaigns list — only GET /api/campaigns/{id} lists them
  accounts?: string[];
  // Reported by the API
  rawStatus?: "draft" | "active" | "paused" | "completed";
  meetings?: number;
  replyRate?: number;
  timezone?: string;
  windowDays?: number[];
  windowStart?: number;
  windowEnd?: number;
  pausedReason?: string | null;
  stats?: CampaignStats;
}

export interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  // TODO(feature): warmup score — ColdLane has no warmup
  warmupScore?: number;
  dailyLimit: number;
  sentToday: number;
  // TODO(feature): health score — the API reports active/paused/fail_count only
  health?: "Excellent" | "Good" | "At risk" | "Paused";
  // TODO(feature): warmup toggle — ColdLane has no warmup
  warmupEnabled?: boolean;
  // Reported by GET /api/mailboxes
  label?: string;
  effectiveCap?: number;
  fromName?: string;
  fromEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecurity?: "starttls" | "ssl" | "none";
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapSsl?: boolean;
  senderAddress?: string;
  signature?: string;
  active?: boolean;
  pausedReason?: string | null;
  failCount?: number;
  lastError?: string | null;
  hasSmtpPassword?: boolean;
  hasImapPassword?: boolean;
  lastSendAt?: string | null;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  status: string;
  campaign: string;
  // Reported by GET /api/leads
  rawStatus?: string;
  campaignId?: number;
  score?: number;
  sentiment?: string | null;
  meetingBooked?: boolean;
  meetingNote?: string | null;
}

/** The API keeps only a name/subject/body per template. */
export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
}

export interface InboxThread {
  id: string;
  name: string;
  email: string;
  company: string;
  campaign: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  category: "Interested" | "Meeting Booked" | "Not Interested" | "Out of Office" | "Needs Reply" | "";
  messages: { from: "them" | "me"; body: string; time: string }[];
  // Reported by GET /api/threads (AI labels are null until a thread is classified)
  score?: number;
  sentiment?: string | null;
  intent?: string | null;
  meetingBooked?: boolean;
  summary?: string | null;
  campaignId?: number;
}
