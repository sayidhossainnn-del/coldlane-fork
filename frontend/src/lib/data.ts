/**
 * View types for the UI. All rows are produced by ./api from real API responses;
 * the mock datasets that used to live here are gone — nothing imports them.
 */

export type CampaignStatus = "active" | "paused" | "draft" | "completed";
export type StepType = "email" | "call" | "linkedin" | "wait" | "condition";

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  leads: number;
  sent: number;
  /** No open tracking exists in the API: always 0 and hidden by the views. */
  opened: number;
  replied: number;
  /** No positive-reply aggregate exists in the API: always 0 and hidden by the views. */
  positive: number;
  bounced: number;
  unsubscribed: number;
  meetings: number;
  /** No campaign-level daily limit exists: 0 in list views (hidden), filled from the
   *  assigned mailboxes' caps in the campaign detail view. */
  dailyLimit: number;
  /** Only returned by the campaign detail endpoint; empty in list views (hidden). */
  accounts: string[];
  createdAt: string;
  /** No owner column exists: empty and hidden by the views. */
  owner: string;
  /** No tags column exists: empty and hidden by the views. */
  tags: string[];
  sequence: SequenceStep[];
  /** Share of the campaign's leads that have been contacted (real arithmetic). */
  progress: number;
};

export type SequenceStep = {
  id: string;
  type: StepType;
  title: string;
  dayOffset: number;
  waitDays?: number;
  subject?: string;
  body?: string;
  variants?: { id: string; label: string; subject: string; body: string; share: number }[];
  enabled: boolean;
  stats?: { sent: number; opened: number; replied: number };
  note?: string;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  location: string;
  status: "active" | "paused" | "completed" | "bounced" | "replied" | "new";
  campaign: string;
  lastActivity: string;
  score: number;
  stage: string;
  avatarHue: number;
};

export type Mailbox = {
  id: string;
  email: string;
  provider: "Google" | "Microsoft" | "SMTP";
  status: "healthy" | "warming" | "paused" | "error";
  /** No health score exists in the API: 0 and hidden by the Accounts view. */
  health: number;
  warmupDays: number;
  sentToday: number;
  dailyLimit: number;
  /** No per-mailbox campaign count exists in the API: 0 and hidden by the views. */
  campaigns: number;
  /** No open tracking exists in the API: 0 and hidden by the views. */
  openedRate: number;
};

export type Template = {
  id: string;
  name: string;
  /** No category column exists: empty and hidden by the Templates view. */
  category: string;
  subject: string;
  body: string;
  /** No usage/reply-rate columns exist: 0 and hidden by the Templates view. */
  used: number;
  replyRate: number;
  updated: string;
};

export type Conversation = {
  id: string;
  from: string;
  email: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  sentiment: "positive" | "neutral" | "negative";
  campaign: string;
  messages: { id: string; author: string; me: boolean; body: string; time: string }[];
};

/** Merge variables offered by the template editor's insert buttons. */
export const firstNameVars = ["first_name", "last_name", "company", "title", "location", "linkedin_url"];
