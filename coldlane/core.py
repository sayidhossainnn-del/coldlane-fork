"""Shared business rules: time, suppression, stop rules, caps, start validation, stats."""
import datetime as dt
import json
import random
import re

from . import config, db

UTC = dt.timezone.utc
EMAIL_RE = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)
DOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")

LEAD_STATUSES = ["queued", "active", "replied", "bounced", "unsubscribed", "suppressed",
                 "merge_error", "error", "completed"]


# ---------------------------------------------------------------- time helpers
def utcnow():
    return dt.datetime.now(UTC).replace(microsecond=0)


def ts(value):
    return value.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S")


def parse_ts(value):
    if not value:
        return None
    return dt.datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC)


def local_day_start(now):
    """Start of the current day in the server's local timezone (UTC in the container by default)."""
    local = now.astimezone()
    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(UTC)


def local_date(now):
    return now.astimezone().date()


# ---------------------------------------------------------------- validation
def valid_email(value):
    return bool(value) and len(value) <= 254 and bool(EMAIL_RE.match(value))


def domain_of(email):
    return email.rsplit("@", 1)[-1].lower()


def norm_key(key):
    return re.sub(r"\s+", "_", (key or "").strip().lower())


# ---------------------------------------------------------------- events
def log_event(conn, kind, detail="", lead_id=None, campaign_id=None, email=None, at=None):
    conn.execute(
        "INSERT INTO events(lead_id, campaign_id, email, kind, detail, at) VALUES(?,?,?,?,?,?)",
        (lead_id, campaign_id, email, kind, detail, ts(at or utcnow())),
    )


# ---------------------------------------------------------------- sender identity
def sender_business_name(conn):
    stored = db.get_setting(conn, "sender_business_name")
    return (stored if stored is not None else config.env("SENDER_BUSINESS_NAME", "")).strip()


def global_sender_address(conn):
    """Settings override env. A value saved blank in Settings counts as empty (it does NOT fall back)."""
    stored = db.get_setting(conn, "sender_address")
    return (stored if stored is not None else config.env("SENDER_ADDRESS", "")).strip()


def resolve_sender(conn, mailbox):
    address = (mailbox["sender_address"] or "").strip() or global_sender_address(conn)
    business = sender_business_name(conn) or (mailbox["from_name"] or "").strip()
    return business, address


# ---------------------------------------------------------------- suppression
def is_suppressed(conn, email):
    email = (email or "").lower()
    row = conn.execute(
        "SELECT 1 FROM suppression WHERE email=? OR domain=? LIMIT 1", (email, domain_of(email))
    ).fetchone()
    return row is not None


def add_suppression(conn, email=None, domain=None, source="manual", note=""):
    email = (email or "").strip().lower() or None
    domain = (domain or "").strip().lower().lstrip("@") or None
    if email:
        if conn.execute("SELECT 1 FROM suppression WHERE email=?", (email,)).fetchone():
            return False
    elif domain:
        if conn.execute("SELECT 1 FROM suppression WHERE domain=? AND email IS NULL", (domain,)).fetchone():
            return False
    else:
        return False
    conn.execute(
        "INSERT INTO suppression(email, domain, source, note, created_at) VALUES(?,?,?,?,?)",
        (email, None if email else domain, source, note, ts(utcnow())),
    )
    return True


# ---------------------------------------------------------------- stop rules
STOP_FROM = {
    "replied": ("queued", "active", "completed", "error", "merge_error"),
    "bounced": ("queued", "active", "completed", "error", "merge_error"),
    "unsubscribed": ("queued", "active", "completed", "error", "merge_error", "replied", "suppressed"),
}
EVENT_FOR = {"replied": "reply", "bounced": "bounce_hard", "unsubscribed": "unsubscribe"}


def stop_address(conn, email, new_status, detail="", snippet=None):
    """Stop an address in every campaign. Returns [(lead_id, campaign_id, previous_status)]."""
    email = email.lower()
    allowed = STOP_FROM[new_status]
    marks = ",".join("?" for _ in allowed)
    rows = conn.execute(
        f"SELECT id, campaign_id, status FROM leads WHERE email=? AND status IN ({marks})",
        (email, *allowed),
    ).fetchall()
    now = ts(utcnow())
    changed = []
    for row in rows:
        if snippet is not None:
            conn.execute(
                "UPDATE leads SET status=?, reply_snippet=?, wait_reason=NULL, updated_at=? WHERE id=?",
                (new_status, snippet, now, row["id"]),
            )
        else:
            conn.execute(
                "UPDATE leads SET status=?, wait_reason=NULL, updated_at=? WHERE id=?",
                (new_status, now, row["id"]),
            )
        payload = json.dumps({"prev_status": row["status"], "detail": detail})
        log_event(conn, EVENT_FOR[new_status], payload, row["id"], row["campaign_id"], email)
        changed.append((row["id"], row["campaign_id"], row["status"]))
    return changed


def unsubscribe_lead(conn, lead, source="unsubscribe", note="one-click link"):
    add_suppression(conn, email=lead["email"], source=source, note=note)
    return stop_address(conn, lead["email"], "unsubscribed", detail=note)


def undo_unsubscribe(conn, lead):
    email = lead["email"].lower()
    conn.execute("DELETE FROM suppression WHERE email=? AND source='unsubscribe'", (email,))
    restored = 0
    for row in conn.execute("SELECT id, campaign_id FROM leads WHERE email=? AND status='unsubscribed'", (email,)).fetchall():
        ev = conn.execute(
            "SELECT detail FROM events WHERE lead_id=? AND kind='unsubscribe' ORDER BY id DESC LIMIT 1", (row["id"],)
        ).fetchone()
        prev = "queued"
        if ev:
            try:
                prev = json.loads(ev["detail"]).get("prev_status") or "queued"
            except (ValueError, TypeError):
                pass
        conn.execute("UPDATE leads SET status=?, updated_at=? WHERE id=?", (prev, ts(utcnow()), row["id"]))
        log_event(conn, "unsubscribe_undo", json.dumps({"restored_status": prev}), row["id"], row["campaign_id"], email)
        restored += 1
    return restored


# ---------------------------------------------------------------- caps
def mailbox_usable(mb):
    return bool(mb["active"]) and not mb["paused_reason"]


def today_sent(conn, mailbox_id, now=None):
    now = now or utcnow()
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM sends WHERE mailbox_id=? AND status IN ('sent','bounce_hard') AND sent_at>=?",
        (mailbox_id, ts(local_day_start(now))),
    ).fetchone()
    return row["n"]


def effective_cap(mb, now=None):
    now = now or utcnow()
    cap = max(0, min(int(mb["daily_cap"]), config.HARD_MAX_DAILY_CAP))
    if mb["ramp_enabled"]:
        days = 0
        if mb["first_send_date"]:
            first = dt.date.fromisoformat(mb["first_send_date"])
            days = max(0, (local_date(now) - first).days)
        cap = min(cap, config.ramp_start() + config.ramp_step() * days)
    return cap


def remaining_capacity(conn, mb, now=None):
    return max(0, effective_cap(mb, now) - today_sent(conn, mb["id"], now))


# ---------------------------------------------------------------- campaigns
def campaign_mailboxes(conn, campaign_id):
    return conn.execute(
        "SELECT m.* FROM mailboxes m JOIN campaign_mailboxes cm ON cm.mailbox_id=m.id "
        "WHERE cm.campaign_id=? ORDER BY m.id",
        (campaign_id,),
    ).fetchall()


def campaign_steps(conn, campaign_id):
    return conn.execute(
        "SELECT * FROM steps WHERE campaign_id=? ORDER BY position", (campaign_id,)
    ).fetchall()


# ---------------------------------------------------------------- step variants (A/B)
# A step's own subject/body is arm 'A' (implicit); step_variants rows are the extra arms.
# "variant_id IS NULL" therefore always means "the base content".
VARIANT_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def step_variants(conn, step_id):
    """The extra content arms of a step, ordered by label."""
    return conn.execute("SELECT * FROM step_variants WHERE step_id=? ORDER BY label", (step_id,)).fetchall()


def all_variants(conn, step):
    """Every arm of a step, base 'A' first, including disabled and already-sent arms so
    their history stays reportable."""
    try:
        base_weight = step["weight"]
    except (IndexError, KeyError):
        base_weight = 100
    base = {"id": None, "step_id": step["id"], "label": "A", "subject": step["subject"], "body": step["body"],
            "weight": base_weight, "enabled": 1, "created_at": None}
    return [base, *[dict(row) for row in step_variants(conn, step["id"])]]


def variant_pool(conn, step):
    """The arms a lead may be assigned to: none while the step has no enabled variants,
    otherwise base 'A' plus every enabled row. Disabled variants are never newly assigned."""
    rows = step_variants(conn, step["id"])
    if not any(row["enabled"] for row in rows):
        return []
    return [arm for arm in all_variants(conn, step) if arm["enabled"]]


def pick_weighted(variants, rng=None):
    """Weighted random pick over arms carrying a `weight`. `rng` only needs .random()."""
    rng = rng or random
    weights = [max(0, int(v["weight"] or 0)) for v in variants]
    total = sum(weights)
    if total <= 0:
        return variants[0]
    roll = rng.random() * total
    upto = 0.0
    for variant, weight in zip(variants, weights):
        upto += weight
        if roll < upto:
            return variant
    return variants[-1]


def assigned_variant(conn, lead_id, step_id):
    """The sticky arm for this lead+step, or None when nothing has been assigned yet."""
    return conn.execute("SELECT * FROM lead_step_variant WHERE lead_id=? AND step_id=?",
                        (lead_id, step_id)).fetchone()


def assign_variant(conn, lead_id, step_id, variant_id):
    """Pin a lead to one arm for a step (variant_id None = the base content)."""
    conn.execute("INSERT OR REPLACE INTO lead_step_variant(lead_id, step_id, variant_id) VALUES(?,?,?)",
                 (lead_id, step_id, variant_id))


def variant_stats(conn, campaign_id):
    """Per step and per arm: sent, replied, bounced, unsubscribed and reply_rate.

    Attribution: an event counts for the arm of the LAST send that reached that lead
    before the event, so a reply is credited to the content the lead actually saw.
    Stats only: nothing here disables, pauses or promotes an arm (no opens/clicks exist).
    """
    steps = campaign_steps(conn, campaign_id)
    counts = {(step["id"], arm["id"]): {"sent": 0, "replied": 0, "bounced": 0, "unsubscribed": 0}
              for step in steps for arm in all_variants(conn, step)}
    for row in conn.execute(
            "SELECT step_id, variant_id, COUNT(*) AS n FROM sends WHERE campaign_id=? AND status='sent' "
            "GROUP BY step_id, variant_id", (campaign_id,)):
        key = (row["step_id"], row["variant_id"])
        if key in counts:
            counts[key]["sent"] = row["n"]
    def last_send(column):
        """The send that reached this lead most recently before the event (e.at)."""
        return (f"(SELECT s.{column} FROM sends s WHERE s.campaign_id=? AND s.lead_id=e.lead_id "
                "AND s.status='sent' AND s.sent_at<=e.at ORDER BY s.sent_at DESC, s.id DESC LIMIT 1)")

    for kind, field in (("reply", "replied"), ("bounce_hard", "bounced"), ("unsubscribe", "unsubscribed")):
        for row in conn.execute(
                f"SELECT {last_send('step_id')} AS step_id, {last_send('variant_id')} AS variant_id "
                "FROM (SELECT lead_id, MIN(at) AS at FROM events WHERE campaign_id=? AND kind=? "
                "AND lead_id IS NOT NULL GROUP BY lead_id) e",
                (campaign_id, campaign_id, campaign_id, kind)):
            key = (row["step_id"], row["variant_id"])
            if key in counts:
                counts[key][field] += 1
    report = []
    for step in steps:
        arms = []
        for arm in all_variants(conn, step):
            totals = counts[(step["id"], arm["id"])]
            arms.append({**arm, **totals,
                         "reply_rate": round(100.0 * totals["replied"] / totals["sent"], 1)
                         if totals["sent"] else 0.0})
        report.append({"step_id": step["id"], "position": step["position"], "subject": step["subject"],
                       "variants": arms})
    return {"campaign_id": campaign_id, "steps": report}


def validate_start(conn, campaign_id, resume=False):
    errors = []
    mailboxes = campaign_mailboxes(conn, campaign_id)
    if not any(mailbox_usable(m) for m in mailboxes):
        errors.append("Assign at least 1 active (not paused) mailbox to this campaign.")
    if not campaign_steps(conn, campaign_id):
        errors.append("Add at least 1 step (step 1 needs a subject and body).")
    statuses = ("queued", "active") if resume else ("queued",)
    marks = ",".join("?" for _ in statuses)
    queued = conn.execute(
        f"SELECT COUNT(*) AS n FROM leads WHERE campaign_id=? AND status IN ({marks})", (campaign_id, *statuses)
    ).fetchone()["n"]
    if not queued:
        errors.append("Import at least 1 lead that is queued (not suppressed or invalid).")
    for mb in mailboxes:
        _, address = resolve_sender(conn, mb)
        if not address:
            errors.append(
                f"Sender postal address is empty for mailbox '{mb['label']}'. Set it in Settings "
                "(or SENDER_ADDRESS in .env) or as a per-mailbox override. It is required in every email footer."
            )
    if not mailboxes:
        errors.append("No mailboxes assigned, so no sender address can be resolved.")
    if not config.public_base_url():
        errors.append("PUBLIC_BASE_URL is not set in .env. It is required for one-click unsubscribe links.")
    return errors


def enqueue_suppression_check(conn, campaign_id):
    """At enqueue (start/resume): mark queued leads that are now suppressed."""
    count = 0
    for lead in conn.execute(
        "SELECT id, email FROM leads WHERE campaign_id=? AND status IN ('queued','active')", (campaign_id,)
    ).fetchall():
        if is_suppressed(conn, lead["email"]):
            conn.execute("UPDATE leads SET status='suppressed', updated_at=? WHERE id=?", (ts(utcnow()), lead["id"]))
            log_event(conn, "suppressed_skip", "on suppression list at enqueue", lead["id"], campaign_id, lead["email"])
            count += 1
    return count


def campaign_stats(conn, campaign_id):
    def one(sql, *args):
        return conn.execute(sql, args).fetchone()[0]

    sent = one("SELECT COUNT(*) FROM sends WHERE campaign_id=? AND status='sent'", campaign_id)
    gone_out = one("SELECT COUNT(*) FROM sends WHERE campaign_id=? AND status IN ('sent','bounce_hard')", campaign_id)
    contacted = one("SELECT COUNT(DISTINCT lead_id) FROM sends WHERE campaign_id=? AND status IN ('sent','bounce_hard')", campaign_id)
    counts = {s: 0 for s in LEAD_STATUSES}
    for row in conn.execute("SELECT status, COUNT(*) AS n FROM leads WHERE campaign_id=? GROUP BY status", (campaign_id,)):
        counts[row["status"]] = row["n"]
    per_step = {
        row["step_pos"]: row["n"]
        for row in conn.execute(
            "SELECT step_pos, COUNT(*) AS n FROM sends WHERE campaign_id=? AND status='sent' GROUP BY step_pos",
            (campaign_id,),
        )
    }
    waiting_cap = one("SELECT COUNT(*) FROM leads WHERE campaign_id=? AND status IN ('queued','active') AND wait_reason='waiting on cap'", campaign_id)
    return {
        "sent": sent,
        "gone_out": gone_out,
        "contacted": contacted,
        "replied": counts["replied"],
        "bounced": counts["bounced"],
        "unsubscribed": counts["unsubscribed"],
        "meetings": meeting_count(conn, campaign_id),
        "queued": counts["queued"],
        "active": counts["active"],
        "statuses": counts,
        "total": sum(counts.values()),
        "waiting_cap": waiting_cap,
        "reply_rate": round(100.0 * counts["replied"] / contacted, 1) if contacted else 0.0,
        "bounce_rate": round(100.0 * counts["bounced"] / gone_out, 1) if gone_out else 0.0,
        "per_step": per_step,
    }


def check_bounce_rate(conn, campaign_id):
    """Auto-pause a campaign once >=20 emails went out and the bounce rate exceeds MAX_BOUNCE_RATE."""
    stats = campaign_stats(conn, campaign_id)
    if stats["gone_out"] < 20:
        return False
    rate = stats["bounced"] / stats["gone_out"]
    if rate > config.max_bounce_rate():
        row = conn.execute("SELECT status FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
        if row and row["status"] == "active":
            reason = (
                f"Auto-paused: bounce rate {rate:.1%} after {stats['gone_out']} emails exceeds "
                f"MAX_BOUNCE_RATE {config.max_bounce_rate():.1%}. Clean the list before resuming."
            )
            conn.execute("UPDATE campaigns SET status='paused', paused_reason=? WHERE id=?", (reason, campaign_id))
            log_event(conn, "campaign_paused", reason, campaign_id=campaign_id)
            return True
    return False


def worker_status(conn, now=None):
    now = now or utcnow()
    last = db.get_state(conn, "last_tick")
    last_dt = parse_ts(last) if last else None
    ok = bool(last_dt) and (now - last_dt).total_seconds() <= 3 * config.tick_seconds()
    return last, ok


# ---------------------------------------------------------------- unibox (messages)
# Plain data-access helpers for the future external dashboard's unified inbox. No
# Flask routes live here; they just read/write the `messages` table (full outbound
# and inbound content) added alongside `sends.subject`/`sends.body`.
THREAD_FILTERS = ("all", "replied", "unread")


def get_thread(conn, lead_id):
    """All messages (outbound + inbound) for one lead, oldest first."""
    return conn.execute(
        "SELECT * FROM messages WHERE lead_id=? ORDER BY received_at, id", (lead_id,)
    ).fetchall()


def list_threads(conn, limit=50, offset=0, filter="all"):  # noqa: A002 - matches spec's parameter name
    """One row per lead that has at least one stored message, most recent activity first.

    Each row carries: lead_id, lead_email, lead_status, campaign_id, campaign_name,
    mailbox_id, mailbox_email, last_message_at, last_kind, last_direction,
    last_snippet, unread_count, plus the optional AI labels (ai_sentiment, ai_intent,
    ai_meeting_intent, ai_summary; NULL until the thread has been classified) and the
    manual meeting flag (meeting_booked_at, meeting_note).

    `filter` is one of "all", "replied" (lead status == replied), or "unread"
    (lead has at least one unread inbound message).
    """
    if filter not in THREAD_FILTERS:
        filter = "all"
    extra = ""
    if filter == "replied":
        extra = "AND l.status = 'replied'"
    elif filter == "unread":
        extra = ("AND EXISTS (SELECT 1 FROM messages mu WHERE mu.lead_id = l.id "
                "AND mu.direction='in' AND mu.is_read=0)")
    sql = f"""
        SELECT
            l.id AS lead_id,
            l.email AS lead_email,
            l.status AS lead_status,
            c.id AS campaign_id,
            c.name AS campaign_name,
            mb.id AS mailbox_id,
            mb.from_email AS mailbox_email,
            last.received_at AS last_message_at,
            last.kind AS last_kind,
            last.direction AS last_direction,
            COALESCE(SUBSTR(last.body, 1, 300), '') AS last_snippet,
            (SELECT COUNT(*) FROM messages mu WHERE mu.lead_id = l.id
                AND mu.direction='in' AND mu.is_read=0) AS unread_count,
            ta.sentiment AS ai_sentiment,
            ta.intent AS ai_intent,
            ta.meeting_intent AS ai_meeting_intent,
            ta.summary AS ai_summary,
            lm.booked_at AS meeting_booked_at,
            lm.note AS meeting_note
        FROM leads l
        JOIN campaigns c ON c.id = l.campaign_id
        LEFT JOIN mailboxes mb ON mb.id = l.mailbox_id
        LEFT JOIN thread_ai ta ON ta.lead_id = l.id
        LEFT JOIN lead_meetings lm ON lm.lead_id = l.id
        JOIN (
            SELECT m1.lead_id, m1.received_at, m1.kind, m1.direction, m1.body
            FROM messages m1
            WHERE m1.id = (
                SELECT m2.id FROM messages m2
                WHERE m2.lead_id = m1.lead_id
                ORDER BY m2.received_at DESC, m2.id DESC
                LIMIT 1
            )
        ) last ON last.lead_id = l.id
        WHERE 1=1 {extra}
        ORDER BY last.received_at DESC, l.id DESC
        LIMIT ? OFFSET ?
    """
    return conn.execute(sql, (limit, offset)).fetchall()


def mark_thread_read(conn, lead_id):
    """Mark every inbound message in a lead's thread as read. Returns rows affected."""
    cur = conn.execute(
        "UPDATE messages SET is_read=1 WHERE lead_id=? AND direction='in' AND is_read=0", (lead_id,)
    )
    return cur.rowcount


def backfill_sent_messages(conn):
    """One-off upgrade helper: create `messages` rows for `sends` rows that predate
    full-content storage. Only outbound 'sent' sends are backfilled (inbound history
    cannot be reconstructed after the fact, so it is intentionally left alone).

    Subject/body will be NULL here for any `sends` row that itself has no
    subject/body recorded (i.e. rows written before the `sends.subject`/`sends.body`
    migration ran); those rows are still inserted so the thread's send timeline stays
    complete, just without content. Safe to run multiple times: relies on the same
    (mailbox_id, message_id) uniqueness as live inserts, so nothing is duplicated.
    """
    rows = conn.execute(
        "SELECT s.* FROM sends s WHERE s.status='sent' AND NOT EXISTS ("
        "SELECT 1 FROM messages m WHERE m.mailbox_id = s.mailbox_id AND m.message_id = s.message_id)"
    ).fetchall()
    created = 0
    for row in rows:
        lead = conn.execute("SELECT email FROM leads WHERE id=?", (row["lead_id"],)).fetchone()
        to_email = lead["email"] if lead else row["recipient"]
        mb = conn.execute("SELECT from_email FROM mailboxes WHERE id=?", (row["mailbox_id"],)).fetchone()
        from_email = mb["from_email"] if mb else None
        new_id = db.insert_message(
            conn,
            lead_id=row["lead_id"],
            campaign_id=row["campaign_id"],
            mailbox_id=row["mailbox_id"],
            direction="out",
            kind="sent",
            message_id=row["message_id"],
            in_reply_to=None,
            references_hdr=None,
            from_email=from_email,
            to_email=to_email,
            subject=row["subject"],
            body=row["body"],
            received_at=row["sent_at"],
            imap_uid=None,
            is_read=1,
        )
        if new_id:
            created += 1
    return created


# ---------------------------------------------------------------- optional AI layer
# Rule-based lead scoring plus the small read/write helpers the AI endpoints and the
# worker need. Nothing in here sends anything: AI produces labels and draft text only.
AI_SENTIMENTS = ("positive", "neutral", "negative")
AI_INTENTS = ("interested", "not_interested", "question", "out_of_office", "referral",
              "unsubscribe", "other")
REPLY_KINDS = ("reply", "auto_reply")
SCORE_REPLIED = 40
SCORE_SENTIMENT = {"positive": 25, "neutral": 5, "negative": -30}
SCORE_MEETING_INTENT = 15
SCORE_MEETING_BOOKED = 20
SCORE_FORCE_ZERO = ("bounced", "unsubscribed")
SCORE_MAX = 100


def score_lead(status=None, sentiment=None, meeting_intent=0, meeting_booked=False):
    """0-100 lead score from plain rules -- no LLM is involved (formula in README).

    replied +40, sentiment positive +25 / neutral +5 / negative -30, meeting intent
    +15, meeting booked +20. A bounced or unsubscribed lead is forced to 0. Clamped.
    """
    if status in SCORE_FORCE_ZERO:
        return 0
    score = SCORE_REPLIED if status == "replied" else 0
    score += SCORE_SENTIMENT.get(sentiment or "", 0)
    score += SCORE_MEETING_INTENT if meeting_intent else 0
    score += SCORE_MEETING_BOOKED if meeting_booked else 0
    return max(0, min(SCORE_MAX, score))


def llm_settings(conn):
    """The single provider-settings row as a dict (blank defaults until something is saved)."""
    row = conn.execute("SELECT * FROM llm_settings WHERE id=1").fetchone()
    if row is None:
        return {"id": 1, "base_url": "", "api_key_enc": None, "model": "",
                "draft_system_prompt": "", "enabled": 0, "updated_at": None}
    return dict(row)


def llm_configured(conn):
    """True only while AI is switched on *and* usable. The key stays optional so local
    OpenAI-compatible servers (Ollama, LM Studio, ...) work with a base URL alone."""
    settings = llm_settings(conn)
    return bool(settings["enabled"] and (settings["base_url"] or "").strip()
                and (settings["model"] or "").strip())


def thread_ai(conn, lead_id):
    """The stored classification for a thread, or None when it was never classified."""
    row = conn.execute("SELECT * FROM thread_ai WHERE lead_id=?", (lead_id,)).fetchone()
    return dict(row) if row is not None else None


def save_thread_ai(conn, lead_id, sentiment=None, intent=None, meeting_intent=0, summary=None,
                   message_id=None, model=None, at=None):
    """Upsert the latest classification for a thread."""
    conn.execute(
        "INSERT INTO thread_ai(lead_id, sentiment, intent, meeting_intent, summary, "
        "classified_message_id, model, updated_at) VALUES(?,?,?,?,?,?,?,?) "
        "ON CONFLICT(lead_id) DO UPDATE SET sentiment=excluded.sentiment, intent=excluded.intent, "
        "meeting_intent=excluded.meeting_intent, summary=excluded.summary, "
        "classified_message_id=excluded.classified_message_id, model=excluded.model, "
        "updated_at=excluded.updated_at",
        (lead_id, sentiment, intent, 1 if meeting_intent else 0, summary, message_id, model,
         ts(at or utcnow())),
    )


def lead_meeting(conn, lead_id):
    row = conn.execute("SELECT * FROM lead_meetings WHERE lead_id=?", (lead_id,)).fetchone()
    return dict(row) if row is not None else None


def set_meeting(conn, lead_id, note="", at=None):
    """Manual 'a meeting was booked' flag. Re-posting keeps the original booked_at and
    only refreshes the note; nothing here books, sends or schedules anything."""
    conn.execute(
        "INSERT INTO lead_meetings(lead_id, booked_at, note) VALUES(?,?,?) "
        "ON CONFLICT(lead_id) DO UPDATE SET note=excluded.note",
        (lead_id, ts(at or utcnow()), (note or "").strip()[:500]),
    )


def clear_meeting(conn, lead_id):
    return conn.execute("DELETE FROM lead_meetings WHERE lead_id=?", (lead_id,)).rowcount


def meeting_count(conn, campaign_id):
    return conn.execute(
        "SELECT COUNT(*) FROM lead_meetings mm JOIN leads l ON l.id = mm.lead_id "
        "WHERE l.campaign_id=?", (campaign_id,),
    ).fetchone()[0]


def latest_inbound_message(conn, lead_id, kinds=REPLY_KINDS):
    """The newest inbound message worth classifying (a human reply or an auto-reply)."""
    marks = ",".join("?" for _ in kinds)
    return conn.execute(
        f"SELECT * FROM messages WHERE lead_id=? AND direction='in' AND kind IN ({marks}) "
        "ORDER BY received_at DESC, id DESC LIMIT 1", (lead_id, *kinds),
    ).fetchone()


def unclassified_replies(conn, limit=5):
    """Threads whose newest inbound human reply still needs classifying, oldest first.

    One message per thread (a classification describes the whole thread), skipping threads
    whose newest reply was already classified and any message that already failed 3 times.
    """
    return conn.execute(
        "SELECT m.* FROM messages m "
        "JOIN (SELECT lead_id, MAX(id) AS newest_id FROM messages "
        "      WHERE direction='in' AND kind='reply' GROUP BY lead_id) newest "
        "  ON newest.newest_id = m.id "
        "LEFT JOIN thread_ai ta ON ta.lead_id = m.lead_id "
        "LEFT JOIN ai_attempts a ON a.message_id = m.id "
        "WHERE (ta.classified_message_id IS NULL OR ta.classified_message_id < m.id) "
        "AND COALESCE(a.attempts, 0) < 3 "
        "ORDER BY m.id LIMIT ?", (limit,),
    ).fetchall()
