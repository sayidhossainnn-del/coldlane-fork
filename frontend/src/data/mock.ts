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

export const campaigns: Campaign[] = [
  {
    id: "c1",
    name: "SaaS Founders — Series A Outreach",
    status: "Active",
    sent: 4820,
    opens: 2890,
    replies: 312,
    interested: 98,
    bounced: 54,
    clickRate: 18.4,
    progress: 68,
    leads: 6200,
    createdAt: "2024-01-12",
    accounts: ["jordan@outreachly.io", "amy@outreachly.io"],
  },
  {
    id: "c2",
    name: "E-commerce Agencies Q1 Push",
    status: "Active",
    sent: 2310,
    opens: 1543,
    replies: 201,
    interested: 61,
    bounced: 22,
    clickRate: 22.1,
    progress: 41,
    leads: 5500,
    createdAt: "2024-02-02",
    accounts: ["sales@outreachly.io"],
  },
  {
    id: "c3",
    name: "Fintech Decision Makers",
    status: "Paused",
    sent: 1180,
    opens: 690,
    replies: 84,
    interested: 29,
    bounced: 15,
    clickRate: 14.7,
    progress: 23,
    leads: 4800,
    createdAt: "2024-01-28",
    accounts: ["jordan@outreachly.io"],
  },
  {
    id: "c4",
    name: "Healthcare IT Buyers — NA",
    status: "Draft",
    sent: 0,
    opens: 0,
    replies: 0,
    interested: 0,
    bounced: 0,
    clickRate: 0,
    progress: 0,
    leads: 3100,
    createdAt: "2024-03-01",
    accounts: ["amy@outreachly.io"],
  },
  {
    id: "c5",
    name: "Real Estate Brokers Re-engagement",
    status: "Completed",
    sent: 8900,
    opens: 5210,
    replies: 611,
    interested: 178,
    bounced: 120,
    clickRate: 19.9,
    progress: 100,
    leads: 8900,
    createdAt: "2023-11-14",
    accounts: ["sales@outreachly.io", "jordan@outreachly.io"],
  },
  {
    id: "c6",
    name: "Logistics & Supply Chain CFOs",
    status: "Active",
    sent: 760,
    opens: 410,
    replies: 52,
    interested: 14,
    bounced: 9,
    clickRate: 16.2,
    progress: 12,
    leads: 6400,
    createdAt: "2024-03-10",
    accounts: ["amy@outreachly.io"],
  },
];

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

export const emailAccounts: EmailAccount[] = [
  { id: "a1", email: "jordan@outreachly.io", provider: "Google", warmupScore: 97, dailyLimit: 45, sentToday: 32, health: "Excellent", warmupEnabled: true },
  { id: "a2", email: "amy@outreachly.io", provider: "Google", warmupScore: 88, dailyLimit: 40, sentToday: 40, health: "Excellent", warmupEnabled: true },
  { id: "a3", email: "sales@outreachly.io", provider: "Microsoft", warmupScore: 64, dailyLimit: 35, sentToday: 11, health: "Good", warmupEnabled: true },
  { id: "a4", email: "hello@outreachly.io", provider: "SMTP", warmupScore: 41, dailyLimit: 25, sentToday: 25, health: "At risk", warmupEnabled: true },
  { id: "a5", email: "team@outreachly.io", provider: "Google", warmupScore: 12, dailyLimit: 0, sentToday: 0, health: "Paused", warmupEnabled: false },
];

export interface LeadList {
  id: string;
  name: string;
  leads: number;
  verified: number;
  createdAt: string;
  tags: string[];
}

export const leadLists: LeadList[] = [
  { id: "l1", name: "SaaS Founders US (Apollo Export)", leads: 6200, verified: 5890, createdAt: "2024-01-10", tags: ["SaaS", "Founders"] },
  { id: "l2", name: "Ecommerce Agencies — UK/EU", leads: 5500, verified: 5120, createdAt: "2024-01-30", tags: ["Agency", "Ecommerce"] },
  { id: "l3", name: "Fintech VP Engineering", leads: 4800, verified: 4201, createdAt: "2024-01-22", tags: ["Fintech"] },
  { id: "l4", name: "Healthcare IT Buyers", leads: 3100, verified: 2990, createdAt: "2024-02-25", tags: ["Healthcare"] },
  { id: "l5", name: "Logistics CFO List", leads: 6400, verified: 5800, createdAt: "2024-03-05", tags: ["Logistics", "Finance"] },
];

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

const firstNames = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas", "Mia", "James", "Amelia", "Benjamin", "Harper"];
const lastNames = ["Carter", "Bennett", "Reyes", "Hughes", "Price", "Simmons", "Foster", "Powell", "Long", "Patterson", "Barnes", "Ross", "Henderson"];
const companies = ["Northwind Labs", "Brightline Digital", "Vertex Analytics", "Cascade Systems", "Summit Partners", "Clearpath AI", "Lumen Works", "Pioneer Cloud", "Fathom Health", "Ridgeline Capital"];
const titles = ["VP Sales", "Head of Growth", "CEO", "Marketing Director", "Founder", "VP Engineering", "CFO", "COO", "Demand Gen Manager"];
const statuses: Lead["status"][] = ["Not Contacted", "Contacted", "Opened", "Replied", "Interested", "Bounced"];

export const leads: Lead[] = Array.from({ length: 42 }).map((_, i) => {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  const company = companies[(i * 2) % companies.length];
  return {
    id: `lead-${i}`,
    name: `${fn} ${ln}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${company.toLowerCase().replace(/\s/g, "")}.com`,
    company,
    title: titles[(i * 5) % titles.length],
    status: statuses[i % statuses.length],
    campaign: campaigns[i % campaigns.length].name,
  };
});

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

export const inboxThreads: InboxThread[] = [
  {
    id: "t1",
    name: "Priya Shah",
    email: "priya@vertexanalytics.com",
    company: "Vertex Analytics",
    campaign: "SaaS Founders — Series A Outreach",
    subject: "Re: Quick question about Vertex's outbound stack",
    preview: "Thanks for reaching out — this actually looks relevant, can we grab 15 min...",
    time: "9:42 AM",
    unread: true,
    category: "Interested",
    messages: [
      { from: "me", body: "Hi Priya, noticed Vertex is scaling the GTM team — curious how you're handling outbound personalization at volume today?", time: "Mon 8:10 AM" },
      { from: "them", body: "Thanks for reaching out — this actually looks relevant, can we grab 15 min this week to talk through it?", time: "Mon 9:42 AM" },
    ],
  },
  {
    id: "t2",
    name: "Marcus Chen",
    email: "marcus@brightlinedigital.com",
    company: "Brightline Digital",
    campaign: "E-commerce Agencies Q1 Push",
    subject: "Re: Brightline <> Outreachly",
    preview: "Appreciate the follow up, can you send over pricing for 10 seats?",
    time: "Yesterday",
    unread: true,
    category: "Meeting Booked",
    messages: [
      { from: "me", body: "Hey Marcus, would it make sense to put 20 minutes on the calendar this week?", time: "Fri 2:00 PM" },
      { from: "them", body: "Appreciate the follow up, can you send over pricing for 10 seats? Booked us a slot Thursday.", time: "Yesterday" },
    ],
  },
  {
    id: "t3",
    name: "Daniela Ross",
    email: "daniela@clearpath.ai",
    company: "Clearpath AI",
    campaign: "Fintech Decision Makers",
    subject: "Re: Scaling cold outbound at Clearpath",
    preview: "Not the right time for us, please remove me from this list.",
    time: "2 days ago",
    unread: false,
    category: "Not Interested",
    messages: [
      { from: "me", body: "Hi Daniela, quick one — are you currently exploring tools to automate outbound sequencing?", time: "Wed 10:00 AM" },
      { from: "them", body: "Not the right time for us, please remove me from this list.", time: "2 days ago" },
    ],
  },
  {
    id: "t4",
    name: "Tom Fitzgerald",
    email: "tom@summitpartners.com",
    company: "Summit Partners",
    campaign: "Real Estate Brokers Re-engagement",
    subject: "Out of Office: Re: Summit Partners intro",
    preview: "I'm currently out of office and will respond when I return on the 14th.",
    time: "3 days ago",
    unread: false,
    category: "Out of Office",
    messages: [
      { from: "me", body: "Hi Tom, flagging this in case it's useful for Summit's pipeline this quarter.", time: "Mon 9:00 AM" },
      { from: "them", body: "I'm currently out of office and will respond when I return on the 14th.", time: "3 days ago" },
    ],
  },
  {
    id: "t5",
    name: "Grace Kim",
    email: "grace@fathomhealth.com",
    company: "Fathom Health",
    campaign: "Healthcare IT Buyers — NA",
    subject: "Re: Fathom Health outreach automation",
    preview: "Can you clarify how deliverability monitoring works on your platform?",
    time: "4 days ago",
    unread: true,
    category: "Needs Reply",
    messages: [
      { from: "me", body: "Hi Grace, we help healthcare IT teams keep outbound compliant and deliverable — worth a look?", time: "Last Thu" },
      { from: "them", body: "Can you clarify how deliverability monitoring works on your platform?", time: "4 days ago" },
    ],
  },
];

export const performanceSeries = [
  { day: "Mon", sent: 820, opens: 512, replies: 61, clicks: 190 },
  { day: "Tue", sent: 940, opens: 601, replies: 74, clicks: 210 },
  { day: "Wed", sent: 1020, opens: 688, replies: 88, clicks: 255 },
  { day: "Thu", sent: 880, opens: 560, replies: 65, clicks: 198 },
  { day: "Fri", sent: 1150, opens: 790, replies: 102, clicks: 301 },
  { day: "Sat", sent: 430, opens: 240, replies: 29, clicks: 88 },
  { day: "Sun", sent: 360, opens: 198, replies: 21, clicks: 70 },
];

export const funnel = [
  { stage: "Sent", value: 18900 },
  { stage: "Delivered", value: 18120 },
  { stage: "Opened", value: 11740 },
  { stage: "Replied", value: 1460 },
  { stage: "Interested", value: 480 },
];

export const templates = [
  { id: "tp1", name: "Cold Intro — Pain Point", category: "Cold Outreach", used: 128, replyRate: 14.2 },
  { id: "tp2", name: "Breakup Email", category: "Follow-up", used: 96, replyRate: 9.8 },
  { id: "tp3", name: "Case Study Share", category: "Nurture", used: 64, replyRate: 17.5 },
  { id: "tp4", name: "Meeting Request — Direct", category: "Booking", used: 210, replyRate: 21.3 },
  { id: "tp5", name: "Re-engagement Ping", category: "Follow-up", used: 48, replyRate: 7.1 },
  { id: "tp6", name: "Referral Ask", category: "Nurture", used: 33, replyRate: 11.0 },
];
