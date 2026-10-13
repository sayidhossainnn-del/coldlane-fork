export type CampaignStatus = "active" | "paused" | "draft" | "completed";
export type StepType = "email" | "call" | "linkedin" | "wait" | "condition";

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  leads: number;
  sent: number;
  opened: number;
  replied: number;
  positive: number;
  bounced: number;
  unsubscribed: number;
  meetings: number;
  dailyLimit: number;
  accounts: string[];
  createdAt: string;
  owner: string;
  tags: string[];
  sequence: SequenceStep[];
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
  health: number;
  warmupDays: number;
  sentToday: number;
  dailyLimit: number;
  campaigns: number;
  openedRate: number;
};

export type Template = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
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

export const firstNameVars = ["first_name", "last_name", "company", "title", "location", "linkedin_url"];

export const campaigns: Campaign[] = [
  {
    id: "cmp_01",
    name: "Series B SaaS — VP Engineering",
    status: "active",
    leads: 4210,
    sent: 18940,
    opened: 12411,
    replied: 1476,
    positive: 318,
    bounced: 214,
    unsubscribed: 96,
    meetings: 74,
    dailyLimit: 450,
    accounts: ["alex@northwind.io", "sdr2@northwind.io", "maya@northwind.io"],
    createdAt: "Jan 14, 2026",
    owner: "Alex Rivera",
    tags: ["outbound", "saas", "us"],
    progress: 62,
    sequence: [
      {
        id: "s1",
        type: "email",
        title: "Intro — 30 seconds",
        dayOffset: 0,
        subject: "{{first_name}}, quick idea for {{company}}'s pipeline",
        body: `Hi {{first_name}},\n\nSaw {{company}} is hiring 6 AEs this quarter — usually means pipeline is the bottleneck.\n\nWe helped Rampwire add $1.4M in qualified pipeline in 9 weeks using only cold email (no paid spend).\n\nWorth a 12-min look next Tuesday?\n\n— Alex`,
        enabled: true,
        stats: { sent: 8420, opened: 6011, replied: 806 },
        variants: [
          {
            id: "v1",
            label: "Variant A",
            share: 50,
            subject: "{{first_name}}, quick idea for {{company}}'s pipeline",
            body: "Hi {{first_name}},\n\nSaw {{company}} is hiring 6 AEs this quarter...",
            },
          {
            id: "v2",
            label: "Variant B",
            share: 50,
            subject: "6 AEs and no pipeline? ({{company}})",
            body: "Hey {{first_name}} — congrats on the expansion.\n\nQuick question: how is the team sourcing pipeline?",
          },
        ],
      },
      {
        id: "s2",
        type: "wait",
        title: "Wait",
        dayOffset: 3,
        waitDays: 3,
        enabled: true,
      },
      {
        id: "s3",
        type: "email",
        title: "Follow-up #1 — case study",
        dayOffset: 3,
        subject: "Re: {{first_name}}, quick idea for {{company}}'s pipeline",
        body: "Following up with the numbers:\n\n• 41% reply rate across 12 SaaS accounts\n• $18 CAC per meeting booked\n• Zero domain burns in 6 months\n\nWant the 2-page teardown?",
        enabled: true,
        stats: { sent: 6210, opened: 3902, replied: 402 },
      },
      {
        id: "s4",
        type: "condition",
        title: "If opened → send follow-up #2",
        dayOffset: 6,
        enabled: true,
        note: "Only continue if step 3 was opened",
      },
      {
        id: "s5",
        type: "linkedin",
        title: "LinkedIn — view profile + connect",
        dayOffset: 7,
        enabled: true,
        note: "Connection note: 'Enjoyed your post on platform migrations.'",
        stats: { sent: 3180, opened: 2104, replied: 190 },
      },
      {
        id: "s6",
        type: "wait",
        title: "Wait",
        dayOffset: 11,
        waitDays: 4,
        enabled: true,
      },
      {
        id: "s7",
        type: "email",
        title: "Breakup email",
        dayOffset: 11,
        subject: "Closing the loop, {{first_name}}",
        body: "Doesn't look like a fit right now — I'll close your file.\n\nIf pipeline gets tight in Q3, reply 'teardown' and I'll send it over.",
        enabled: false,
        stats: { sent: 1130, opened: 594, replied: 78 },
      },
    ],
  },
  {
    id: "cmp_02",
    name: "E-commerce Founders — Q1 Push",
    status: "active",
    leads: 2870,
    sent: 12105,
    opened: 7263,
    replied: 812,
    positive: 176,
    bounced: 168,
    unsubscribed: 61,
    meetings: 41,
    dailyLimit: 300,
    accounts: ["sdr@northwind.io", "leo@northwind.io"],
    createdAt: "Feb 02, 2026",
    owner: "Maya Chen",
    tags: ["ecommerce", "founders"],
    progress: 44,
    sequence: [
      {
        id: "e1",
        type: "email",
        title: "Founder-to-founder",
        dayOffset: 0,
        subject: "{{company}} + paid ads fatigue",
        body: "Hey {{first_name}},\n\nMost DTC brands we talk to are stuck paying $80+ per new customer. We fix that with owned channels.",
        enabled: true,
        stats: { sent: 5410, opened: 3310, replied: 391 },
      },
      { id: "e2", type: "wait", title: "Wait", dayOffset: 4, waitDays: 4, enabled: true },
      {
        id: "e3",
        type: "email",
        title: "Follow-up — Loom video",
        dayOffset: 4,
        subject: "2-min Loom for {{company}}",
        body: "Recorded a quick walkthrough of how we'd approach {{company}}: [Loom link]",
        enabled: true,
        stats: { sent: 4102, opened: 2510, replied: 288 },
      },
      {
        id: "e4",
        type: "call",
        title: "Call task — warm openers",
        dayOffset: 8,
        enabled: true,
        note: "Call leads that opened 2+ times. Script in Templates → 'Warm opener'.",
      },
    ],
  },
  {
    id: "cmp_03",
    name: "Reactivation — Closed/Lost 2025",
    status: "paused",
    leads: 1180,
    sent: 4902,
    opened: 2941,
    replied: 344,
    positive: 88,
    bounced: 41,
    unsubscribed: 29,
    meetings: 22,
    dailyLimit: 150,
    accounts: ["alex@northwind.io"],
    createdAt: "Dec 08, 2025",
    owner: "Alex Rivera",
    tags: ["nurture", "warm"],
    progress: 88,
    sequence: [
      {
        id: "r1",
        type: "email",
        title: "It's been a minute",
        dayOffset: 0,
        subject: "Still thinking about {{company}}",
        body: "Hi {{first_name}}, we paused on the rollout last year. Picking it back up?",
        enabled: true,
        stats: { sent: 2210, opened: 1410, replied: 190 },
      },
      { id: "r2", type: "wait", title: "Wait", dayOffset: 5, waitDays: 5, enabled: true },
      {
        id: "r3",
        type: "email",
        title: "New pricing note",
        dayOffset: 5,
        subject: "New plan for returning teams",
        body: "We shipped a self-serve tier — no annual contract.",
        enabled: true,
        stats: { sent: 1690, opened: 990, replied: 120 },
      },
    ],
  },
  {
    id: "cmp_04",
    name: "Agencies — 50–200 seats",
    status: "draft",
    leads: 640,
    sent: 0,
    opened: 0,
    replied: 0,
    positive: 0,
    bounced: 0,
    unsubscribed: 0,
    meetings: 0,
    dailyLimit: 200,
    accounts: [],
    createdAt: "Feb 21, 2026",
    owner: "Leo Novak",
    tags: ["agency", "draft"],
    progress: 0,
    sequence: [
      {
        id: "d1",
        type: "email",
        title: "Agency intro",
        dayOffset: 0,
        subject: "White-label outbound for {{company}}",
        body: "Hi {{first_name}},\n\nDo you run cold email in-house for clients?",
        enabled: true,
      },
    ],
  },
  {
    id: "cmp_05",
    name: "FinServ Compliance Officers",
    status: "completed",
    leads: 940,
    sent: 3760,
    opened: 2288,
    replied: 261,
    positive: 64,
    bounced: 52,
    unsubscribed: 18,
    meetings: 19,
    dailyLimit: 120,
    accounts: ["compliance@northwind.io"],
    createdAt: "Sep 19, 2025",
    owner: "Maya Chen",
    tags: ["finserv", "enterprise"],
    progress: 100,
    sequence: [
      {
        id: "f1",
        type: "email",
        title: "Compliance angle",
        dayOffset: 0,
        subject: "SOC2 evidence collection, automated",
        body: "Hi {{first_name}}, how are you collecting evidence today?",
        enabled: true,
        stats: { sent: 1800, opened: 1120, replied: 141 },
      },
    ],
  },
];

export const leads: Lead[] = [
  { id: "l1", name: "Sarah Whitmore", email: "sarah.w@lumenstack.com", company: "Lumenstack", title: "VP Engineering", location: "Austin, TX", status: "replied", campaign: "Series B SaaS — VP Engineering", lastActivity: "Replied 12m ago", score: 92, stage: "Meeting booked", avatarHue: 265 },
  { id: "l2", name: "Daniel Okafor", email: "d.okafor@brightpath.ai", company: "Brightpath AI", title: "Head of Growth", location: "London, UK", status: "active", campaign: "Series B SaaS — VP Engineering", lastActivity: "Opened 3x · 1h ago", score: 88, stage: "Step 3 of 7", avatarHue: 200 },
  { id: "l3", name: "Emily Tran", email: "emily@northloop.co", company: "Northloop", title: "Director of Sales", location: "San Francisco, CA", status: "active", campaign: "E-commerce Founders — Q1 Push", lastActivity: "Opened 22m ago", score: 81, stage: "Step 2 of 4", avatarHue: 330 },
  { id: "l4", name: "Marcus Feld", email: "mfeld@stackforge.io", company: "Stackforge", title: "CTO", location: "Berlin, DE", status: "replied", campaign: "Series B SaaS — VP Engineering", lastActivity: "Replied yesterday", score: 95, stage: "Negotiation", avatarHue: 150 },
  { id: "l5", name: "Priya Raman", email: "priya.r@velocitycrm.com", company: "VelocityCRM", title: "RevOps Lead", location: "Toronto, CA", status: "paused", campaign: "Reactivation — Closed/Lost 2025", lastActivity: "Paused · out of office", score: 44, stage: "Paused", avatarHue: 30 },
  { id: "l6", name: "Tomás Herrera", email: "tomas@casacart.es", company: "CasaCart", title: "Founder", location: "Madrid, ES", status: "active", campaign: "E-commerce Founders — Q1 Push", lastActivity: "Sent 2h ago", score: 67, stage: "Step 1 of 4", avatarHue: 12 },
  { id: "l7", name: "Grace Lindqvist", email: "grace@fjordanalytics.se", company: "Fjord Analytics", title: "VP Data", location: "Stockholm, SE", status: "bounced", campaign: "Series B SaaS — VP Engineering", lastActivity: "Hard bounce", score: 8, stage: "Invalid", avatarHue: 220 },
  { id: "l8", name: "Jordan Pike", email: "jpike@harborgroup.com", company: "Harbor Group", title: "Managing Partner", location: "New York, NY", status: "completed", campaign: "FinServ Compliance Officers", lastActivity: "Sequence finished", score: 71, stage: "Won", avatarHue: 45 },
  { id: "l9", name: "Aiko Tanaka", email: "aiko.tanaka@miraflows.jp", company: "Miraflows", title: "Product Director", location: "Tokyo, JP", status: "new", campaign: "Agencies — 50–200 seats", lastActivity: "Imported today", score: 58, stage: "Not started", avatarHue: 300 },
  { id: "l10", name: "Ben Ortiz", email: "ben@parallelhq.com", company: "Parallel HQ", title: "COO", location: "Denver, CO", status: "active", campaign: "Series B SaaS — VP Engineering", lastActivity: "Clicked link · 4h ago", score: 90, stage: "Step 5 of 7", avatarHue: 175 },
  { id: "l11", name: "Nadia Haddad", email: "nadia@cedarworks.me", company: "Cedarworks", title: "Head of Partnerships", location: "Dubai, AE", status: "active", campaign: "Reactivation — Closed/Lost 2025", lastActivity: "Opened 1d ago", score: 63, stage: "Step 3 of 3", avatarHue: 285 },
  { id: "l12", name: "Owen Blake", email: "owen@fieldnotes.app", company: "Fieldnotes", title: "Founder", location: "Portland, OR", status: "replied", campaign: "E-commerce Founders — Q1 Push", lastActivity: "Replied 3d ago", score: 86, stage: "Meeting booked", avatarHue: 100 },
];

export const mailboxes: Mailbox[] = [
  { id: "mb1", email: "alex@northwind.io", provider: "Google", status: "healthy", health: 96, warmupDays: 214, sentToday: 38, dailyLimit: 60, campaigns: 2, openedRate: 68 },
  { id: "mb2", email: "sdr2@northwind.io", provider: "Google", status: "healthy", health: 91, warmupDays: 168, sentToday: 44, dailyLimit: 60, campaigns: 1, openedRate: 61 },
  { id: "mb3", email: "maya@northwind.io", provider: "Microsoft", status: "healthy", health: 88, warmupDays: 121, sentToday: 51, dailyLimit: 55, campaigns: 2, openedRate: 57 },
  { id: "mb4", email: "leo@northwind.io", provider: "Google", status: "warming", health: 64, warmupDays: 11, sentToday: 9, dailyLimit: 18, campaigns: 1, openedRate: 44 },
  { id: "mb5", email: "sdr@northwind.io", provider: "Google", status: "healthy", health: 84, warmupDays: 97, sentToday: 29, dailyLimit: 50, campaigns: 1, openedRate: 52 },
  { id: "mb6", email: "compliance@northwind.io", provider: "SMTP", status: "paused", health: 71, warmupDays: 43, sentToday: 0, dailyLimit: 40, campaigns: 0, openedRate: 39 },
  { id: "mb7", email: "outreach2@getnorthwind.co", provider: "Google", status: "error", health: 22, warmupDays: 4, sentToday: 0, dailyLimit: 10, campaigns: 0, openedRate: 11 },
];

export const templates: Template[] = [
  {
    id: "t1",
    name: "Short & punchy intro",
    category: "Cold intro",
    subject: "{{first_name}}, quick idea for {{company}}",
    body: "Hi {{first_name}},\n\nSaw {{company}} is hiring — usually means pipeline is tight.\n\nWe added $1.4M in qualified pipeline for Rampwire in 9 weeks.\n\nOpen to a 12-min look?\n\n— Alex",
    used: 1284,
    replyRate: 9.4,
    updated: "2 days ago",
  },
  {
    id: "t2",
    name: "Loom video follow-up",
    category: "Follow-up",
    subject: "2-min Loom for {{company}}",
    body: "Hey {{first_name}},\n\nRecorded a short walkthrough of how we'd approach {{company}} specifically.\n\n[LOOM_LINK]\n\nWorth 2 minutes?",
    used: 902,
    replyRate: 12.1,
    updated: "5 days ago",
  },
  {
    id: "t3",
    name: "Breakup / close the loop",
    category: "Breakup",
    subject: "Closing the loop, {{first_name}}",
    body: "Doesn't look like a fit right now — I'll close your file.\n\nIf things change, reply 'teardown' and I'll send it over.",
    used: 611,
    replyRate: 6.8,
    updated: "1 week ago",
  },
  {
    id: "t4",
    name: "Referral ask",
    category: "Warm",
    subject: "Who owns outbound at {{company}}?",
    body: "Hi {{first_name}},\n\nNot sure if you're the right person — who owns outbound at {{company}}?\n\nHappy to route this to them directly.",
    used: 388,
    replyRate: 14.6,
    updated: "3 weeks ago",
  },
  {
    id: "t5",
    name: "Event follow-up",
    category: "Warm",
    subject: "SaaStr follow-up",
    body: "Great meeting you at SaaStr. You mentioned ramp time was the biggest pain — here's how we cut it 40%.",
    used: 214,
    replyRate: 11.2,
    updated: "1 month ago",
  },
  {
    id: "t6",
    name: "Case study drop",
    category: "Follow-up",
    subject: "Numbers from a similar team",
    body: "41% reply rate, $18 CAC per meeting, zero domain burns in 6 months.\n\nWant the 2-page teardown?",
    used: 509,
    replyRate: 8.9,
    updated: "4 days ago",
  },
];

export const conversations: Conversation[] = [
  {
    id: "c1",
    from: "Sarah Whitmore",
    email: "sarah.w@lumenstack.com",
    subject: "Re: quick idea for Lumenstack's pipeline",
    preview: "This is interesting — we're actually 3 weeks from a hiring push. Can you do Thursday?",
    time: "9:41 AM",
    unread: true,
    sentiment: "positive",
    campaign: "Series B SaaS — VP Engineering",
    messages: [
      { id: "m1", author: "You", me: true, body: "Hi Sarah,\n\nSaw Lumenstack is hiring 6 AEs this quarter — usually means pipeline is the bottleneck.\n\nWe helped Rampwire add $1.4M in qualified pipeline in 9 weeks using only cold email.\n\nWorth a 12-min look next Tuesday?", time: "Mon 8:02 AM" },
      { id: "m2", author: "Sarah Whitmore", me: false, body: "Hey Alex — timing is odd. We're literally rebuilding the outbound motion right now.", time: "Mon 4:18 PM" },
      { id: "m3", author: "Sarah Whitmore", me: false, body: "This is interesting — we're actually 3 weeks from a hiring push. Can you do Thursday 2pm ET?", time: "9:41 AM" },
    ],
  },
  {
    id: "c2",
    from: "Marcus Feld",
    email: "mfeld@stackforge.io",
    subject: "Re: pricing for a 40-seat team",
    preview: "Send over the annual numbers and I'll get finance to look this week.",
    time: "8:55 AM",
    unread: true,
    sentiment: "positive",
    campaign: "Series B SaaS — VP Engineering",
    messages: [
      { id: "m1", author: "You", me: true, body: "Following up with the numbers:\n\n• 41% reply rate across 12 SaaS accounts\n• $18 CAC per meeting booked", time: "Tue 9:12 AM" },
      { id: "m2", author: "Marcus Feld", me: false, body: "Send over the annual numbers and I'll get finance to look this week.", time: "8:55 AM" },
    ],
  },
  {
    id: "c3",
    from: "Emily Tran",
    email: "emily@northloop.co",
    subject: "Not now — Q3 maybe",
    preview: "We're locked into a contract until June. Ping me in May?",
    time: "Yesterday",
    unread: false,
    sentiment: "neutral",
    campaign: "E-commerce Founders — Q1 Push",
    messages: [
      { id: "m1", author: "Emily Tran", me: false, body: "We're locked into a contract until June. Ping me in May?", time: "Yesterday 3:02 PM" },
    ],
  },
  {
    id: "c4",
    from: "Owen Blake",
    email: "owen@fieldnotes.app",
    subject: "Re: 2-min Loom",
    preview: "Watched it twice. Booked Thursday — here's my calendar link.",
    time: "Yesterday",
    unread: false,
    sentiment: "positive",
    campaign: "E-commerce Founders — Q1 Push",
    messages: [
      { id: "m1", author: "You", me: true, body: "Recorded a quick walkthrough of how we'd approach Fieldnotes.", time: "Mon 11:30 AM" },
      { id: "m2", author: "Owen Blake", me: false, body: "Watched it twice. Booked Thursday — here's my calendar link.", time: "Yesterday 10:11 AM" },
    ],
  },
  {
    id: "c5",
    from: "Grace Lindqvist",
    email: "grace@fjordanalytics.se",
    subject: "Auto-reply: Out of office",
    preview: "I am on parental leave until April 14. For urgent matters contact...",
    time: "Tue",
    unread: false,
    sentiment: "neutral",
    campaign: "Series B SaaS — VP Engineering",
    messages: [
      { id: "m1", author: "Grace Lindqvist", me: false, body: "I am on parental leave until April 14. For urgent matters contact ops@fjordanalytics.se.", time: "Tue 6:40 AM" },
    ],
  },
  {
    id: "c6",
    from: "Priya Raman",
    email: "priya.r@velocitycrm.com",
    subject: "Please remove me",
    preview: "Not interested, please remove from your list.",
    time: "Mon",
    unread: false,
    sentiment: "negative",
    campaign: "Reactivation — Closed/Lost 2025",
    messages: [
      { id: "m1", author: "Priya Raman", me: false, body: "Not interested, please remove from your list.", time: "Mon 1:22 PM" },
    ],
  },
];

/* ---- analytics series ---- */
export const rangeSeries: Record<string, { label: string; sent: number; opened: number; replied: number }[]> = {
  "7d": [
    { label: "Mon", sent: 620, opened: 402, replied: 51 },
    { label: "Tue", sent: 704, opened: 461, replied: 63 },
    { label: "Wed", sent: 688, opened: 448, replied: 47 },
    { label: "Thu", sent: 742, opened: 512, replied: 72 },
    { label: "Fri", sent: 611, opened: 390, replied: 44 },
    { label: "Sat", sent: 218, opened: 141, replied: 12 },
    { label: "Sun", sent: 186, opened: 118, replied: 9 },
  ],
  "14d": [
    { label: "W1", sent: 4210, opened: 2711, replied: 318 },
    { label: "W2", sent: 4620, opened: 3044, replied: 372 },
  ],
  "30d": [
    { label: "Jan 1", sent: 3810, opened: 2361, replied: 268 },
    { label: "Jan 8", sent: 4402, opened: 2871, replied: 331 },
    { label: "Jan 15", sent: 4720, opened: 3180, replied: 398 },
    { label: "Jan 22", sent: 4410, opened: 2904, replied: 344 },
    { label: "Jan 29", sent: 5102, opened: 3480, replied: 431 },
    { label: "Feb 5", sent: 4890, opened: 3291, replied: 402 },
  ],
  "90d": [
    { label: "Nov", sent: 11400, opened: 7120, replied: 812 },
    { label: "Dec", sent: 12880, opened: 8210, replied: 940 },
    { label: "Jan", sent: 15230, opened: 10110, replied: 1240 },
    { label: "Feb", sent: 16720, opened: 11420, replied: 1476 },
  ],
};

export const funnel = [
  { label: "Delivered", value: 42170, color: "#6366f1" },
  { label: "Opened", value: 27241, color: "#8b5cf6" },
  { label: "Replied", value: 3157, color: "#22d3ee" },
  { label: "Positive", value: 646, color: "#34d399" },
  { label: "Meeting", value: 156, color: "#fbbf24" },
];

export const heatmap = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 12 }, (_, h) => {
    const base = Math.sin((h - 6) / 3.4) * 60 + 40;
    const weekend = d >= 5 ? 0.35 : 1;
    const jitter = ((d * 12 + h) % 7) * 6;
    return Math.max(0, Math.min(100, Math.round((base + jitter) * weekend)));
  })
);

export const activity = [
  { id: "a1", type: "reply", text: "Sarah Whitmore replied to “Series B SaaS — VP Engineering”", time: "12m ago", tone: "emerald" },
  { id: "a2", type: "meeting", text: "Meeting booked with Marcus Feld — Thu 2:00 PM", time: "38m ago", tone: "violet" },
  { id: "a3", type: "open", text: "Daniel Okafor opened your email 3 times", time: "1h ago", tone: "sky" },
  { id: "a4", type: "bounce", text: "Hard bounce — grace@fjordanalytics.se removed", time: "2h ago", tone: "rose" },
  { id: "a5", type: "account", text: "outreach2@getnorthwind.co failed auth — reconnection required", time: "3h ago", tone: "amber" },
  { id: "a6", type: "lead", text: "1,240 leads imported into “Agencies — 50–200 seats”", time: "5h ago", tone: "brand" },
  { id: "a7", type: "reply", text: "Owen Blake replied — interested, asked for pricing", time: "6h ago", tone: "emerald" },
];

export const senders = [
  { id: "p1", name: "Alex Rivera", email: "alex@northwind.io", initials: "AR", hue: 255, online: true },
  { id: "p2", name: "Maya Chen", email: "maya@northwind.io", initials: "MC", hue: 175, online: true },
  { id: "p3", name: "Leo Novak", email: "leo@northwind.io", initials: "LN", hue: 25, online: false },
];
