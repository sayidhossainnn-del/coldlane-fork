"""SQLite (WAL) storage shared by the web and worker services."""
import os
import sqlite3

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS mailboxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    from_name TEXT NOT NULL DEFAULT '',
    from_email TEXT NOT NULL,
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_user TEXT NOT NULL DEFAULT '',
    smtp_pass_enc TEXT,
    smtp_security TEXT NOT NULL DEFAULT 'starttls',
    imap_host TEXT NOT NULL DEFAULT '',
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_user TEXT NOT NULL DEFAULT '',
    imap_pass_enc TEXT,
    imap_ssl INTEGER NOT NULL DEFAULT 1,
    daily_cap INTEGER NOT NULL DEFAULT 30,
    ramp_enabled INTEGER NOT NULL DEFAULT 1,
    first_send_date TEXT,
    sender_address TEXT NOT NULL DEFAULT '',
    signature TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    paused_reason TEXT,
    fail_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_error_at TEXT,
    next_send_at TEXT,
    last_imap_uid INTEGER,
    imap_uidvalidity TEXT,
    last_imap_poll TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    window_days TEXT NOT NULL DEFAULT '0,1,2,3,4',
    window_start_hour INTEGER NOT NULL DEFAULT 9,
    window_end_hour INTEGER NOT NULL DEFAULT 17,
    status TEXT NOT NULL DEFAULT 'draft',
    paused_reason TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaign_mailboxes (
    campaign_id INTEGER NOT NULL,
    mailbox_id INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, mailbox_id)
);
CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    delay_minutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    filename TEXT,
    rows INTEGER NOT NULL DEFAULT 0,
    accepted INTEGER NOT NULL DEFAULT 0,
    suppressed INTEGER NOT NULL DEFAULT 0,
    invalid INTEGER NOT NULL DEFAULT 0,
    duplicates INTEGER NOT NULL DEFAULT 0,
    acknowledged_at TEXT NOT NULL,
    acknowledged_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    import_id INTEGER,
    email TEXT NOT NULL,
    fields_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    mailbox_id INTEGER,
    current_step INTEGER NOT NULL DEFAULT 0,
    last_sent_at TEXT,
    last_message_id TEXT,
    thread_refs TEXT NOT NULL DEFAULT '',
    thread_subject TEXT,
    unsub_token TEXT NOT NULL UNIQUE,
    reply_snippet TEXT,
    wait_reason TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_status ON leads(campaign_id, status);
CREATE TABLE IF NOT EXISTS sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    step_id INTEGER,
    step_pos INTEGER NOT NULL,
    mailbox_id INTEGER NOT NULL,
    recipient TEXT NOT NULL,
    recipient_domain TEXT NOT NULL,
    message_id TEXT,
    sent_at TEXT NOT NULL,
    status TEXT NOT NULL,
    smtp_result TEXT,
    attempt INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sends_mailbox ON sends(mailbox_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_sends_domain ON sends(recipient_domain, sent_at);
CREATE INDEX IF NOT EXISTS idx_sends_msgid ON sends(message_id);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    campaign_id INTEGER,
    email TEXT,
    kind TEXT NOT NULL,
    detail TEXT,
    at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_lead ON events(lead_id, kind);
CREATE TABLE IF NOT EXISTS suppression (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    domain TEXT,
    source TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supp_email ON suppression(email);
CREATE INDEX IF NOT EXISTS idx_supp_domain ON suppression(domain);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS worker_state (key TEXT PRIMARY KEY, value TEXT);

-- ---------------------------------------------------------------- unibox storage
-- Full message bodies for the external dashboard's unified inbox. `sends` keeps
-- aggregate send bookkeeping (caps, throttling, status); `messages` is the
-- append-only, full-content record of every outbound and inbound email so a
-- thread view can be rendered without re-touching the mail servers.
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    campaign_id INTEGER,
    mailbox_id INTEGER,
    direction TEXT NOT NULL,
    kind TEXT NOT NULL,
    message_id TEXT,
    in_reply_to TEXT,
    references_hdr TEXT,
    from_email TEXT,
    to_email TEXT,
    subject TEXT,
    body TEXT,
    received_at TEXT NOT NULL,
    imap_uid INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, received_at);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_uid ON messages(mailbox_id, imap_uid);
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_mailbox_msgid
    ON messages(mailbox_id, message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ------------------------------------------------------------- A/B step variants
-- Per-step content arms. The step's own subject/body is arm 'A' implicitly (everywhere
-- else `variant_id IS NULL` means "the base content"); rows here are the extra arms
-- ('B', 'C', ...). `steps.weight` is A's weight. lead_step_variant pins a lead to one
-- arm per step, so a retry never switches content.
CREATE TABLE IF NOT EXISTS step_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    weight INTEGER NOT NULL DEFAULT 100,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE (step_id, label)
);
CREATE INDEX IF NOT EXISTS idx_step_variants_step ON step_variants(step_id);
CREATE TABLE IF NOT EXISTS lead_step_variant (
    lead_id INTEGER NOT NULL,
    step_id INTEGER NOT NULL,
    variant_id INTEGER,
    PRIMARY KEY (lead_id, step_id)
);

-- --------------------------------------------------------------- optional AI layer
-- A single row of OpenAI-compatible provider settings (Gemini, OpenAI, OpenRouter,
-- Groq, ... all work with just a base URL change). The API key is encrypted with the
-- same crypto as mailbox passwords; it is never serialized back to a client.
-- `enabled` is the master switch: while it is 0 every AI endpoint answers 409 and the
-- worker makes no provider calls at all.
CREATE TABLE IF NOT EXISTS llm_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL DEFAULT '',
    api_key_enc TEXT,
    model TEXT NOT NULL DEFAULT '',
    draft_system_prompt TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
-- Latest classification per thread (labels + summary only; AI never sends).
CREATE TABLE IF NOT EXISTS thread_ai (
    lead_id INTEGER PRIMARY KEY,
    sentiment TEXT,
    intent TEXT,
    meeting_intent INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    classified_message_id INTEGER,
    model TEXT,
    updated_at TEXT NOT NULL
);
-- Failure counter that caps automatic re-classification of one message at 3 tries.
CREATE TABLE IF NOT EXISTS ai_attempts (
    message_id INTEGER PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TEXT NOT NULL
);
-- Manual "a meeting was booked" flag. Purely human-set: nothing here books anything.
CREATE TABLE IF NOT EXISTS lead_meetings (
    lead_id INTEGER PRIMARY KEY,
    booked_at TEXT NOT NULL,
    note TEXT
);
"""


def connect(path=None):
    conn = sqlite3.connect(path or config.db_path(), timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def _column_names(conn, table):
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _migrate(conn):
    """Guarded ALTER TABLEs for databases created before a schema change. Idempotent:
    safe to run on every startup, never touches existing data."""
    # `sends` gained `subject`/`body` so the final rendered outbound content can be
    # reconstructed even for rows written before the `messages` table existed.
    sends_cols = _column_names(conn, "sends")
    if "subject" not in sends_cols:
        conn.execute("ALTER TABLE sends ADD COLUMN subject TEXT")
    if "body" not in sends_cols:
        conn.execute("ALTER TABLE sends ADD COLUMN body TEXT")
    # A/B testing: `sends.variant_id` records which arm actually went out (NULL = the
    # step's base content, i.e. arm 'A') and `steps.weight` is arm 'A''s weight.
    if "variant_id" not in sends_cols:
        conn.execute("ALTER TABLE sends ADD COLUMN variant_id INTEGER")
    if "weight" not in _column_names(conn, "steps"):
        conn.execute("ALTER TABLE steps ADD COLUMN weight INTEGER NOT NULL DEFAULT 100")


def init_db(path=None):
    path = path or config.db_path()
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    conn = connect(path)
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
    finally:
        conn.close()


def get_setting(conn, key):
    """Return the stored value, or None when the key was never saved."""
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return None if row is None else (row["value"] or "")


def set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )


def delete_setting(conn, key):
    conn.execute("DELETE FROM settings WHERE key=?", (key,))


def get_state(conn, key):
    row = conn.execute("SELECT value FROM worker_state WHERE key=?", (key,)).fetchone()
    return None if row is None else row["value"]


def set_state(conn, key, value):
    conn.execute(
        "INSERT INTO worker_state(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(value)),
    )


# ---------------------------------------------------------------- messages (unibox)
def insert_message(conn, *, lead_id=None, campaign_id=None, mailbox_id=None, direction, kind,
                   message_id=None, in_reply_to=None, references_hdr=None,
                   from_email=None, to_email=None, subject=None, body=None,
                   received_at, imap_uid=None, is_read=0):
    """Insert one full message row (outbound or inbound).

    Uses INSERT OR IGNORE so re-processing the same physical email (matched by
    the unique (mailbox_id, message_id) index) can never create a duplicate row;
    this is what makes IMAP re-polls and worker restarts safe.
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO messages(lead_id, campaign_id, mailbox_id, direction, kind, message_id, "
        "in_reply_to, references_hdr, from_email, to_email, subject, body, received_at, imap_uid, is_read) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (lead_id, campaign_id, mailbox_id, direction, kind, message_id, in_reply_to, references_hdr,
         from_email, to_email, subject, body, received_at, imap_uid, is_read),
    )
    return cur.lastrowid
