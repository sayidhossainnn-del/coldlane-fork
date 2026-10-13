"""JSON REST API for external frontends, mounted at ``/api``.

Enabled only when ``API_KEY`` is set; every request must send the matching
``X-API-Key`` header. CORS is implemented by hand (no extra dependency) from
``API_CORS_ORIGIN``, including OPTIONS preflight.

This module deliberately reuses the web UI's rules instead of re-implementing
them: campaign start runs the same ``core.validate_start`` checks and
``core.enqueue_suppression_check`` suppression sweep, counters/caps come from
``core``, and mailbox connectivity uses ``mailer.test_connection``. Mailbox
passwords and their encrypted form (``smtp_pass_enc`` / ``imap_pass_enc``) are
never serialized: each mailbox payload is built from a column whitelist.

The API cannot send email; the worker does that, so the send-time suppression,
cap, throttle, footer and lawful-basis rules are unchanged by this layer. Campaign
creation and lead import reuse the web UI's rules: the parts that live in
``core``/``db`` are called directly, and the validation/storage that is trapped
inside ``create_app`` closures is mirrored line-for-line with a comment pointing
at the original (``web.py`` is deliberately not refactored).
"""
import csv
import hmac
import io
import json
import secrets
from zoneinfo import ZoneInfo

from flask import Blueprint, g, jsonify, make_response, request

from . import config, core, crypto, db, engine, mailer

bp = Blueprint("api", __name__, url_prefix="/api")

CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS"
CORS_HEADERS = "Content-Type, X-API-Key"
DEFAULT_LIMIT = 50
MAX_LIMIT = 200

# Mirrors web.py's MAX_STEPS / UNIT_MINUTES (module-level constants there).
MAX_STEPS = 5
UNIT_MINUTES = {"minutes": 1, "hours": 60, "days": 1440}
LAWFUL_BASIS_MESSAGE = ("Import rejected: tick the lawful-basis confirmation (\"I confirm I have a lawful basis "
                        "to email these contacts and will honor opt-outs.\").")
REJECTED_LIMIT = 20

# Whitelists (never blocklists) so a password or encrypted secret can never leak
# even if the schema grows later.
MAILBOX_PUBLIC_FIELDS = (
    "id", "label", "from_name", "from_email", "smtp_host", "smtp_port", "smtp_user", "smtp_security",
    "imap_host", "imap_port", "imap_user", "imap_ssl", "daily_cap", "ramp_enabled", "first_send_date",
    "sender_address", "signature", "active", "paused_reason", "fail_count", "last_error", "last_error_at",
    "next_send_at", "last_imap_uid", "last_imap_poll", "created_at",
)
LEAD_PUBLIC_FIELDS = (
    "id", "campaign_id", "campaign_name", "email", "status", "mailbox_id", "mailbox_label", "mailbox_email",
    "current_step", "last_sent_at", "last_message_id", "reply_snippet", "wait_reason", "attempts",
    "next_attempt_at", "updated_at",
)
MESSAGE_PUBLIC_FIELDS = (
    "id", "lead_id", "campaign_id", "mailbox_id", "direction", "kind", "message_id", "in_reply_to",
    "references_hdr", "from_email", "to_email", "subject", "body", "received_at", "is_read",
)
TEXT_MAILBOX_FIELDS = ("label", "from_name", "from_email", "smtp_host", "smtp_user",
                       "imap_host", "imap_user", "sender_address", "signature")


# ---------------------------------------------------------------- helpers
def _error(message, status, **extra):
    payload = {"error": message}
    payload.update(extra)
    resp = jsonify(payload)
    resp.status_code = status
    return resp


def _conn():
    if "api_db" not in g:
        g.api_db = db.connect()
    return g.api_db


def _payload():
    """Return the JSON body as a dict, {} when there is no body, or None when invalid."""
    data = request.get_json(silent=True)
    if data is None:
        # No body at all is fine for endpoints with optional input; unparseable input is not.
        return {} if not request.get_data(as_text=True).strip() else None
    return data if isinstance(data, dict) else None


def _row_data(row, fields):
    names = row.keys()
    return {name: row[name] for name in fields if name in names}


def _paging(default=DEFAULT_LIMIT, maximum=MAX_LIMIT):
    def number(name, fallback):
        raw = request.args.get(name)
        if raw is None or raw == "":
            return fallback
        try:
            return int(raw)
        except (TypeError, ValueError):
            return fallback

    return max(1, min(number("limit", default), maximum)), max(0, number("offset", 0))


def _as_bool(value, default):
    if value is None:
        return int(default or 0)
    if isinstance(value, str):
        return 1 if value.strip().lower() in ("1", "true", "yes", "on") else 0
    return 1 if value else 0


def _mailbox_public(conn, row):
    data = _row_data(row, MAILBOX_PUBLIC_FIELDS)
    data["has_smtp_password"] = bool(row["smtp_pass_enc"])
    data["has_imap_password"] = bool(row["imap_pass_enc"])
    data["today_sent"] = core.today_sent(conn, row["id"])
    data["effective_cap"] = core.effective_cap(row)
    return data


def _lead_public(row):
    data = _row_data(row, LEAD_PUBLIC_FIELDS)
    try:
        data["fields"] = json.loads(row["fields_json"] or "{}")
    except (ValueError, TypeError):
        data["fields"] = {}
    return data


def _mailbox_fields(data, existing):
    """Validate a mailbox payload the same way the web form does (``web._mailbox_form``).

    Returns ``(columns, errors)``. Passwords are encrypted with crypto.encrypt;
    a blank password on update keeps the stored one. ``data`` is a JSON object.
    """
    errors = []

    def text(key, default=""):
        if key not in data or data[key] is None:
            return existing[key] if existing is not None else default
        return str(data[key]).strip()

    fields = {key: text(key) for key in TEXT_MAILBOX_FIELDS}
    fields["from_email"] = fields["from_email"].lower()
    if not fields["label"]:
        fields["label"] = fields["from_email"]
    if not core.valid_email(fields["from_email"]):
        errors.append("from_email is not a valid address.")
    if not fields["smtp_host"]:
        errors.append("smtp_host is required.")
    if not fields["imap_host"]:
        fields["imap_host"] = fields["smtp_host"]
    if not fields["imap_user"]:
        fields["imap_user"] = fields["smtp_user"]

    security = text("smtp_security", "starttls")
    fields["smtp_security"] = security
    if security not in ("starttls", "ssl", "none"):
        errors.append("smtp_security must be starttls, ssl or none.")

    for key, default in (("smtp_port", 587), ("imap_port", 993)):
        value = data.get(key, existing[key] if existing is not None else default)
        try:
            port = int(value)
            if not 1 <= port <= 65535:
                raise ValueError
        except (TypeError, ValueError):
            errors.append(f"{key} must be a port number.")
            port = default
        fields[key] = port

    fields["imap_ssl"] = _as_bool(data.get("imap_ssl"), existing["imap_ssl"] if existing is not None else 1)
    fields["ramp_enabled"] = _as_bool(data.get("ramp_enabled"), existing["ramp_enabled"] if existing else 1)
    fields["active"] = _as_bool(data.get("active"), existing["active"] if existing else 1)

    cap_value = data.get("daily_cap", existing["daily_cap"] if existing is not None else config.default_daily_cap())
    try:
        cap = int(cap_value)
    except (TypeError, ValueError):
        cap = -1
    if cap < 1 or cap > config.HARD_MAX_DAILY_CAP:
        errors.append(f"daily_cap must be between 1 and {config.HARD_MAX_DAILY_CAP}.")
    fields["daily_cap"] = cap

    smtp_pw = str(data.get("smtp_password") or "")
    imap_pw = str(data.get("imap_password") or "")
    if existing is None:
        fields["smtp_pass_enc"] = crypto.encrypt(smtp_pw)
        fields["imap_pass_enc"] = crypto.encrypt(imap_pw or smtp_pw)
    else:
        fields["smtp_pass_enc"] = crypto.encrypt(smtp_pw) if smtp_pw else existing["smtp_pass_enc"]
        fields["imap_pass_enc"] = crypto.encrypt(imap_pw) if imap_pw else existing["imap_pass_enc"]
    return fields, errors


# ---------------------------------------------------------------- gate + CORS
@bp.before_request
def _api_gate():
    """Disable without a key (404), authenticate with X-API-Key (401), answer preflight."""
    if not config.env("API_KEY"):
        return _error("API is disabled: set API_KEY to enable it.", 404)
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        resp.headers["Access-Control-Allow-Methods"] = CORS_METHODS
        resp.headers["Access-Control-Allow-Headers"] = CORS_HEADERS
        resp.headers["Access-Control-Max-Age"] = "600"
        return resp
    supplied = request.headers.get("X-API-Key") or ""
    if not hmac.compare_digest(supplied.encode("utf-8"), config.env("API_KEY").encode("utf-8")):
        return _error("Unauthorized: missing or invalid X-API-Key.", 401)
    return None


@bp.after_request
def _cors_headers(resp):
    origin = config.env("API_CORS_ORIGIN")
    if origin:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers.add("Vary", "Origin")
    return resp


@bp.teardown_request
def _close_db(exc):  # noqa: ARG001
    conn = g.pop("api_db", None)
    if conn is not None:
        conn.close()


# ---------------------------------------------------------------- threads
@bp.get("/threads")
def threads_list():
    wanted = request.args.get("filter") or "all"
    if wanted not in core.THREAD_FILTERS:
        return _error(f"filter must be one of: {', '.join(core.THREAD_FILTERS)}", 400)
    limit, offset = _paging()
    rows = core.list_threads(_conn(), limit=limit, offset=offset, filter=wanted)
    return jsonify({"filter": wanted, "limit": limit, "offset": offset,
                    "threads": [dict(row) for row in rows]})


@bp.get("/threads/<int:lead_id>")
def thread_detail(lead_id):
    conn = _conn()
    lead = conn.execute(
        "SELECT l.*, c.name AS campaign_name, m.label AS mailbox_label, m.from_email AS mailbox_email "
        "FROM leads l LEFT JOIN campaigns c ON c.id=l.campaign_id "
        "LEFT JOIN mailboxes m ON m.id=l.mailbox_id WHERE l.id=?", (lead_id,)).fetchone()
    if lead is None:
        return _error("Lead not found.", 404)
    messages = [_row_data(row, MESSAGE_PUBLIC_FIELDS) for row in core.get_thread(conn, lead_id)]
    return jsonify({"lead": _lead_public(lead), "messages": messages})


@bp.post("/threads/<int:lead_id>/read")
def thread_mark_read(lead_id):
    conn = _conn()
    if conn.execute("SELECT 1 FROM leads WHERE id=?", (lead_id,)).fetchone() is None:
        return _error("Lead not found.", 404)
    return jsonify({"lead_id": lead_id, "marked_read": core.mark_thread_read(conn, lead_id)})


def _reply_mailbox_id(conn, lead):
    """The mailbox that sent to this lead: latest outbound message, then the lead, then sends."""
    row = conn.execute(
        "SELECT mailbox_id FROM messages WHERE lead_id=? AND direction='out' AND mailbox_id IS NOT NULL "
        "ORDER BY received_at DESC, id DESC LIMIT 1", (lead["id"],)).fetchone()
    if row is not None and row["mailbox_id"]:
        return row["mailbox_id"]
    if lead["mailbox_id"]:
        return lead["mailbox_id"]
    row = conn.execute("SELECT mailbox_id FROM sends WHERE lead_id=? ORDER BY id DESC LIMIT 1",
                       (lead["id"],)).fetchone()
    return row["mailbox_id"] if row is not None else None


@bp.post("/threads/<int:lead_id>/reply")
def thread_reply(lead_id):
    """Send a manual in-thread reply. Not a campaign step: lead status and step are untouched."""
    conn = _conn()
    lead = conn.execute(
        "SELECT l.*, c.name AS campaign_name, m.label AS mailbox_label, m.from_email AS mailbox_email "
        "FROM leads l LEFT JOIN campaigns c ON c.id=l.campaign_id "
        "LEFT JOIN mailboxes m ON m.id=l.mailbox_id WHERE l.id=?", (lead_id,)).fetchone()
    if lead is None:
        return _error("Lead not found.", 404)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    body = data.get("body")
    if not isinstance(body, str) or not body.strip():
        return _error("body is required and must be a non-empty string.", 400)

    # Same stop rules as the rest of ColdLane: never email a suppressed/stopped address.
    if lead["status"] in ("suppressed", "unsubscribed", "bounced") or core.is_suppressed(conn, lead["email"]):
        return _error("Cannot reply: this lead is suppressed, unsubscribed or bounced.", 409)

    if data.get("mailbox_id") is not None:
        raw = data["mailbox_id"]
        if isinstance(raw, bool) or not str(raw).isdigit():
            return _error("mailbox_id must be an integer.", 400)
        mailbox_id = int(raw)
    else:
        mailbox_id = _reply_mailbox_id(conn, lead)
    if mailbox_id is None:
        return _error("No mailbox has sent to this lead yet; pass mailbox_id.", 400)
    mb = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    if mb is None:
        return _error("Mailbox not found.", 404)
    if not core.mailbox_usable(mb):
        return _error("Mailbox is inactive or paused.", 400)

    business, address = core.resolve_sender(conn, mb)
    base_url = config.public_base_url()
    if not base_url:
        return _error("PUBLIC_BASE_URL is not set in .env, so the unsubscribe link cannot be built.", 400)
    if not address:
        return _error("Sender postal address is empty: set it in Settings or as a per-mailbox override.", 400)

    if core.remaining_capacity(conn, mb) <= 0:
        return _error(f"Mailbox daily cap reached ({core.today_sent(conn, mb['id'])}/{core.effective_cap(mb)} today).",
                      429)

    # Thread on the newest stored Message-ID (and its References chain) so it lands in the same thread.
    anchor = conn.execute(
        "SELECT * FROM messages WHERE lead_id=? AND message_id IS NOT NULL AND message_id != '' "
        "ORDER BY received_at DESC, id DESC LIMIT 1", (lead_id,)).fetchone()
    in_reply_to = (anchor["message_id"] if anchor else None) or lead["last_message_id"] or None
    references = " ".join(part for part in (anchor["references_hdr"] if anchor else None, in_reply_to)
                           if part).strip() or None

    latest = conn.execute("SELECT subject FROM messages WHERE lead_id=? AND subject IS NOT NULL AND subject != '' "
                          "ORDER BY received_at DESC, id DESC LIMIT 1", (lead_id,)).fetchone()
    base = (latest["subject"] if latest else None) or lead["thread_subject"] or "your email"
    subject = base if base.lower().startswith("re:") else f"Re: {base}"

    unsub_url = f"{base_url}/u/{lead['unsub_token']}"
    msg, message_id = mailer.build_message(mb, lead["email"], subject, body, unsub_url, business, address,
                                           in_reply_to=in_reply_to, references=references)
    try:
        result = mailer.send_message(mb, msg, lead["email"])
    except mailer.HardBounce as exc:
        # Mirror the engine: a 5xx recipient is a hard bounce, so it is suppressed everywhere.
        core.add_suppression(conn, email=lead["email"], source="bounce", note=str(exc)[:200])
        core.stop_address(conn, lead["email"], "bounced", detail=str(exc))
        return _error(f"Recipient rejected the message: {exc}", 502)
    except (mailer.MailboxError, mailer.SoftFail) as exc:
        return _error(f"Send failed: {exc}", 502)

    # step_pos=0 marks a manual reply: it consumes the mailbox's daily cap and shows in sends.csv,
    # but it is not a sequence step and the lead's current_step/status are left alone.
    now = core.utcnow()
    conn.execute(
        "INSERT INTO sends(campaign_id, lead_id, step_id, step_pos, mailbox_id, recipient, recipient_domain, "
        "message_id, sent_at, status, smtp_result, attempt, subject, body) "
        "VALUES(?,?,NULL,0,?,?,?,?,?,'sent',?,1,?,?)",
        (lead["campaign_id"], lead_id, mb["id"], lead["email"], core.domain_of(lead["email"]), message_id,
         core.ts(now), result, subject, body))
    db.insert_message(conn, lead_id=lead_id, campaign_id=lead["campaign_id"], mailbox_id=mb["id"], direction="out",
                      kind="sent", message_id=message_id, in_reply_to=in_reply_to, references_hdr=references,
                      from_email=mb["from_email"], to_email=lead["email"], subject=subject, body=body,
                      received_at=core.ts(now), imap_uid=None, is_read=1)
    saved = conn.execute("SELECT * FROM messages WHERE mailbox_id=? AND message_id=?",
                         (mb["id"], message_id)).fetchone()
    return jsonify({
        "lead_id": lead_id,
        "mailbox_id": mb["id"],
        "message_id": message_id,
        "subject": subject,
        "smtp_result": result,
        "remaining_capacity": core.remaining_capacity(conn, mb),
        "message": _row_data(saved, MESSAGE_PUBLIC_FIELDS) if saved is not None else None,
    }), 201


# ---------------------------------------------------------------- templates
@bp.get("/templates")
def templates_list():
    rows = _conn().execute("SELECT * FROM templates ORDER BY id").fetchall()
    return jsonify({"templates": [dict(row) for row in rows]})


@bp.post("/templates")
def template_create():
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    name = str(data.get("name") or "").strip()
    if not name:
        return _error("name is required.", 400)
    subject = None if data.get("subject") is None else str(data["subject"])
    body = None if data.get("body") is None else str(data["body"])
    conn = _conn()
    now = core.ts(core.utcnow())
    cur = conn.execute("INSERT INTO templates(name, subject, body, created_at, updated_at) VALUES(?,?,?,?,?)",
                       (name, subject, body, now, now))
    row = conn.execute("SELECT * FROM templates WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.put("/templates/<int:template_id>")
def template_update(template_id):
    conn = _conn()
    row = conn.execute("SELECT * FROM templates WHERE id=?", (template_id,)).fetchone()
    if row is None:
        return _error("Template not found.", 404)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    name = (str(data["name"]).strip() if "name" in data and data["name"] is not None else row["name"]) or ""
    if not name:
        return _error("name is required.", 400)
    subject = (None if data["subject"] is None else str(data["subject"])) if "subject" in data else row["subject"]
    body = (None if data["body"] is None else str(data["body"])) if "body" in data else row["body"]
    conn.execute("UPDATE templates SET name=?, subject=?, body=?, updated_at=? WHERE id=?",
                 (name, subject, body, core.ts(core.utcnow()), template_id))
    row = conn.execute("SELECT * FROM templates WHERE id=?", (template_id,)).fetchone()
    return jsonify(dict(row))


@bp.delete("/templates/<int:template_id>")
def template_delete(template_id):
    conn = _conn()
    if conn.execute("SELECT 1 FROM templates WHERE id=?", (template_id,)).fetchone() is None:
        return _error("Template not found.", 404)
    conn.execute("DELETE FROM templates WHERE id=?", (template_id,))
    return jsonify({"deleted": template_id})


# ---------------------------------------------------------------- mailboxes
@bp.get("/mailboxes")
def mailboxes_list():
    conn = _conn()
    rows = conn.execute("SELECT * FROM mailboxes ORDER BY id").fetchall()
    return jsonify({"mailboxes": [_mailbox_public(conn, row) for row in rows]})


@bp.post("/mailboxes")
def mailbox_create():
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    fields, errors = _mailbox_fields(data, None)
    if errors:
        return _error("Mailbox validation failed.", 400, details=errors)
    conn = _conn()
    fields["created_at"] = core.ts(core.utcnow())
    cols = ",".join(fields)
    marks = ",".join("?" for _ in fields)
    cur = conn.execute(f"INSERT INTO mailboxes({cols}) VALUES({marks})", tuple(fields.values()))
    row = conn.execute("SELECT * FROM mailboxes WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(_mailbox_public(conn, row)), 201


@bp.put("/mailboxes/<int:mailbox_id>")
def mailbox_update(mailbox_id):
    conn = _conn()
    mb = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    if mb is None:
        return _error("Mailbox not found.", 404)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    fields, errors = _mailbox_fields(data, mb)
    if errors:
        return _error("Mailbox validation failed.", 400, details=errors)
    if data.get("clear_pause"):
        fields["paused_reason"] = None
        fields["fail_count"] = 0
    sets = ",".join(f"{key}=?" for key in fields)
    conn.execute(f"UPDATE mailboxes SET {sets} WHERE id=?", (*fields.values(), mailbox_id))
    row = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    return jsonify(_mailbox_public(conn, row))


@bp.post("/mailboxes/<int:mailbox_id>/test")
def mailbox_test(mailbox_id):
    conn = _conn()
    mb = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    if mb is None:
        return _error("Mailbox not found.", 404)
    ok, results = mailer.test_connection(mb)
    if ok:
        conn.execute("UPDATE mailboxes SET fail_count=0, paused_reason=NULL WHERE id=?", (mailbox_id,))
    else:
        conn.execute("UPDATE mailboxes SET last_error=?, last_error_at=? WHERE id=?",
                     ("; ".join(r for r in results if "FAILED" in r)[:500], core.ts(core.utcnow()), mailbox_id))
    row = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    return jsonify({"ok": ok, "results": results, "mailbox": _mailbox_public(conn, row)})


@bp.post("/mailboxes/<int:mailbox_id>/pause")
def mailbox_pause(mailbox_id):
    conn = _conn()
    if conn.execute("SELECT 1 FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone() is None:
        return _error("Mailbox not found.", 404)
    conn.execute("UPDATE mailboxes SET paused_reason=? WHERE id=?", ("Paused via API", mailbox_id))
    row = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    return jsonify(_mailbox_public(conn, row))


@bp.post("/mailboxes/<int:mailbox_id>/resume")
def mailbox_resume(mailbox_id):
    conn = _conn()
    if conn.execute("SELECT 1 FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone() is None:
        return _error("Mailbox not found.", 404)
    conn.execute("UPDATE mailboxes SET paused_reason=NULL, fail_count=0 WHERE id=?", (mailbox_id,))
    row = conn.execute("SELECT * FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone()
    return jsonify(_mailbox_public(conn, row))


# ---------------------------------------------------------------- campaigns
def _campaign_detail(conn, campaign):
    return {
        "campaign": dict(campaign),
        "steps": [{**dict(row), "variants": _step_variants_payload(conn, row)}
                  for row in core.campaign_steps(conn, campaign["id"])],
        "mailboxes": [_mailbox_public(conn, row) for row in core.campaign_mailboxes(conn, campaign["id"])],
        "stats": core.campaign_stats(conn, campaign["id"]),
        "start_errors": (core.validate_start(conn, campaign["id"])
                         if campaign["status"] in ("draft", "completed") else []),
    }


def _sent_step_ids(conn, campaign_id):
    """Steps that already went out to at least one lead: never rewritten or deleted again."""
    return {row["step_id"] for row in conn.execute(
        "SELECT DISTINCT step_id FROM sends WHERE campaign_id=? AND step_id IS NOT NULL", (campaign_id,))}


def _campaign_schedule(data):
    """Mirror of the schedule half of web._campaign_form (a closure in create_app)."""
    errors = []
    fields = {
        "name": str(data.get("name") or "").strip() or "Untitled campaign",
        "timezone": str(data.get("timezone") or "UTC").strip(),
    }
    try:
        ZoneInfo(fields["timezone"])
    except Exception:  # noqa: BLE001
        errors.append(f"Unknown timezone '{fields['timezone']}'. Use an IANA name like America/New_York or UTC.")
    raw_days = data.get("days")
    raw_days = raw_days if isinstance(raw_days, (list, tuple)) else []
    days = sorted({int(d) for d in raw_days if str(d).strip().isdigit() and 0 <= int(d) <= 6})
    if not days:
        errors.append("Pick at least one send day.")
    fields["window_days"] = ",".join(str(d) for d in days)
    try:
        start = int(str(data["window_start"]).strip()) if "window_start" in data else 9
        end = int(str(data["window_end"]).strip()) if "window_end" in data else 17
    except (KeyError, TypeError, ValueError):
        start, end = 9, 17
        errors.append("Window hours must be numbers.")
    if not (0 <= start < end <= 24):
        errors.append("Send window must satisfy 0 <= start hour < end hour <= 24.")
    fields["window_start_hour"], fields["window_end_hour"] = start, end
    return fields, errors


def _campaign_steps(raw_steps):
    """Mirror of the steps half of web._campaign_form.

    The web form uses fixed slots 1..MAX_STEPS; here the list order defines the
    position, empty entries are ignored and the positions stay contiguous.
    """
    errors = []
    steps = []
    if raw_steps is None:
        return steps, errors
    if not isinstance(raw_steps, (list, tuple)):
        return [], ["steps must be a list."]
    if len(raw_steps) > MAX_STEPS:
        return [], [f"A campaign can have at most {MAX_STEPS} steps."]
    for index, entry in enumerate(raw_steps):
        slot = index + 1
        if not isinstance(entry, dict):
            errors.append(f"Step {slot} must be an object with subject/body.")
            continue
        subject = str(entry.get("subject") or "").strip()
        body = str(entry.get("body") or "").replace("\r\n", "\n").strip()
        if not subject and not body:
            continue
        if not body:
            errors.append(f"Step {slot} needs a body.")
        if entry.get("delay_minutes") is not None:
            raw_delay = entry["delay_minutes"]
        elif entry.get("delay_days") is not None:
            try:
                raw_delay = int(str(entry["delay_days"]).strip()) * UNIT_MINUTES["days"]
            except (TypeError, ValueError):
                errors.append(f"Step {slot} delay_days must be a number.")
                raw_delay = None
        else:
            raw_delay = 0
        try:
            minutes = max(0, int(str(raw_delay).strip())) if raw_delay is not None else 0
        except (TypeError, ValueError):
            errors.append(f"Step {slot} delay must be a number.")
            minutes = 0
        steps.append({"position": len(steps) + 1, "subject": subject, "body": body, "delay_minutes": minutes})
    positions = [step["position"] for step in steps]
    if positions and positions != list(range(1, len(positions) + 1)):
        errors.append("Steps must be filled in order without gaps (step 1, 2, 3...).")
    if steps:
        steps[0]["delay_minutes"] = 0
        if not steps[0]["subject"]:
            errors.append("Step 1 needs a subject.")
    for step in steps:
        for text in (step["subject"], step["body"]):
            if text.count("{{") != text.count("}}"):
                errors.append(f"Step {step['position']} has unbalanced {{{{ }}}} merge braces.")
    return steps, errors


def _campaign_mailbox_ids(conn, data):
    """Mailbox ids that must exist.

    The web form inserts with INSERT OR IGNORE and so never notices a bad id;
    this explicit existence check is the one place the API is stricter on purpose.
    """
    raw = data.get("mailbox_ids")
    if raw is None:
        return [], []
    if not isinstance(raw, (list, tuple)):
        return [], ["mailbox_ids must be a list of mailbox ids."]
    ids, errors = [], []
    for value in raw:
        if isinstance(value, bool) or not str(value).strip().isdigit():
            errors.append(f"mailbox_ids must contain integers, got {value!r}.")
            continue
        mailbox_id = int(str(value).strip())
        if conn.execute("SELECT 1 FROM mailboxes WHERE id=?", (mailbox_id,)).fetchone() is None:
            errors.append(f"Mailbox {mailbox_id} does not exist.")
            continue
        ids.append(mailbox_id)
    return ids, errors


def _write_campaign(conn, campaign_id, fields, mailbox_ids=None, steps=None):
    """Mirror of web._save_campaign, plus step locking.

    ``None`` leaves that part untouched (PUT uses it so a partial edit cannot wipe
    steps or mailbox assignments). Steps that already appear in ``sends`` are never
    rewritten or deleted; their positions are returned so the caller can report them.
    """
    sent_ids = _sent_step_ids(conn, campaign_id)
    sets = ",".join(f"{key}=?" for key in fields)
    conn.execute(f"UPDATE campaigns SET {sets} WHERE id=?", (*fields.values(), campaign_id))
    if mailbox_ids is not None:
        conn.execute("DELETE FROM campaign_mailboxes WHERE campaign_id=?", (campaign_id,))
        for mailbox_id in mailbox_ids:
            conn.execute("INSERT OR IGNORE INTO campaign_mailboxes(campaign_id, mailbox_id) VALUES(?,?)",
                         (campaign_id, mailbox_id))
    locked = []
    if steps is not None:
        existing = {step["position"]: step for step in core.campaign_steps(conn, campaign_id)}
        for step in steps:
            current = existing.get(step["position"])
            if current is not None and current["id"] in sent_ids:
                locked.append(step["position"])
                continue
            if current is not None:
                conn.execute("UPDATE steps SET subject=?, body=?, delay_minutes=? WHERE id=?",
                             (step["subject"], step["body"], step["delay_minutes"], current["id"]))
            else:
                conn.execute("INSERT INTO steps(campaign_id, position, subject, body, delay_minutes) "
                             "VALUES(?,?,?,?,?)",
                             (campaign_id, step["position"], step["subject"], step["body"],
                              step["delay_minutes"]))
        keep = {step["position"] for step in steps}
        for position, row in existing.items():
            if position not in keep and row["id"] not in sent_ids:
                # A step that never sent can go, along with its arms and assignments
                # (a step that was sent is kept, so its variants keep their stats).
                conn.execute("DELETE FROM step_variants WHERE step_id=?", (row["id"],))
                conn.execute("DELETE FROM lead_step_variant WHERE step_id=?", (row["id"],))
                conn.execute("DELETE FROM steps WHERE id=?", (row["id"],))
    return locked


# ---------------------------------------------------------------- step variants (A/B)
def _step_at(conn, campaign_id, position):
    return conn.execute("SELECT * FROM steps WHERE campaign_id=? AND position=?",
                        (campaign_id, position)).fetchone()


def _editable_campaign_or_error(conn, campaign_id):
    """Variant edits follow the step-edit rule: only draft or paused campaigns."""
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return None, _error("Campaign not found.", 404)
    if campaign["status"] not in ("draft", "paused"):
        return None, _error(f"Cannot edit a campaign with status '{campaign['status']}': only draft and paused "
                            "campaigns are editable.", 409)
    return campaign, None


def _step_variants_payload(conn, step):
    """Base arm 'A' first (NULL id, the step's own content), then the stored arms.

    `locked` means the content can no longer be changed: a sent step locks 'A', and a
    variant with sends is locked too (add a new variant instead).
    """
    used = {row["variant_id"] for row in conn.execute(
        "SELECT DISTINCT variant_id FROM sends WHERE step_id=? AND variant_id IS NOT NULL", (step["id"],))}
    step_sent = conn.execute("SELECT 1 FROM sends WHERE step_id=? AND status='sent' LIMIT 1",
                             (step["id"],)).fetchone() is not None
    return [{**arm, "locked": step_sent if arm["id"] is None else arm["id"] in used}
            for arm in core.all_variants(conn, step)]


def _weight_value(value, name):
    try:
        weight = int(str(value).strip())
    except (TypeError, ValueError):
        return None, f"{name} must be an integer between 1 and 100."
    if not 1 <= weight <= 100:
        return None, f"{name} must be between 1 and 100 (got {weight})."
    return weight, None


def _variant_fields(data, existing=None):
    """Validate variant content with the same rules a step's subject/body get.

    A variant may have an empty subject (it then threads as "Re: <step 1 subject>"),
    exactly like a follow-up step.
    """
    errors = []
    subject = existing["subject"] if existing is not None else ""
    body = existing["body"] if existing is not None else ""
    if existing is None or "subject" in data:
        subject = str(data.get("subject") or "").strip()
    if existing is None or "body" in data:
        body = str(data.get("body") or "").replace("\r\n", "\n").strip()
    if not body:
        errors.append("body is required for a variant.")
    for text in (subject or "", body or ""):
        if text.count("{{") != text.count("}}"):
            errors.append("Variant content has unbalanced {{ }} merge braces.")
    weight = existing["weight"] if existing is not None else 100
    if data.get("weight") is not None:
        weight, problem = _weight_value(data["weight"], "weight")
        if problem:
            errors.append(problem)
            weight = existing["weight"] if existing is not None else 100
    enabled = existing["enabled"] if existing is not None else 1
    if data.get("enabled") is not None:
        enabled = _as_bool(data["enabled"], enabled)
    return {"subject": subject, "body": body, "weight": weight, "enabled": enabled}, errors


@bp.get("/campaigns")
def campaigns_list():
    conn = _conn()
    campaigns = conn.execute("SELECT * FROM campaigns ORDER BY id DESC").fetchall()
    return jsonify({"campaigns": [{**dict(row), "stats": core.campaign_stats(conn, row["id"])}
                                  for row in campaigns]})


@bp.get("/campaigns/<int:campaign_id>")
def campaign_detail(campaign_id):
    conn = _conn()
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return _error("Campaign not found.", 404)
    return jsonify(_campaign_detail(conn, campaign))


@bp.post("/campaigns")
def campaign_create():
    """Create a draft campaign. Mirrors web.campaign_new + web._campaign_form/_save_campaign."""
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    conn = _conn()
    fields, errors = _campaign_schedule(data)
    steps, step_errors = _campaign_steps(data.get("steps"))
    mailbox_ids, mailbox_errors = _campaign_mailbox_ids(conn, data)
    errors += step_errors + mailbox_errors
    if errors:
        return _error("Campaign validation failed.", 400, details=errors)
    cur = conn.execute("INSERT INTO campaigns(name, created_at) VALUES(?, ?)",
                       (fields["name"], core.ts(core.utcnow())))
    campaign_id = cur.lastrowid
    _write_campaign(conn, campaign_id, fields, mailbox_ids, steps)
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    return jsonify(_campaign_detail(conn, campaign)), 201


@bp.put("/campaigns/<int:campaign_id>")
def campaign_update(campaign_id):
    """Edit a draft or paused campaign. Omitted keys keep their stored value."""
    conn = _conn()
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return _error("Campaign not found.", 404)
    if campaign["status"] not in ("draft", "paused"):
        return _error(f"Cannot edit a campaign with status '{campaign['status']}': only draft and paused "
                      "campaigns are editable.", 409)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    merged = {
        "name": data["name"] if "name" in data else campaign["name"],
        "timezone": data["timezone"] if "timezone" in data else campaign["timezone"],
        "days": (data["days"] if "days" in data
                 else [d for d in (campaign["window_days"] or "").split(",") if d.strip()]),
        "window_start": data["window_start"] if "window_start" in data else campaign["window_start_hour"],
        "window_end": data["window_end"] if "window_end" in data else campaign["window_end_hour"],
    }
    fields, errors = _campaign_schedule(merged)
    steps = None
    if "steps" in data:
        steps, step_errors = _campaign_steps(data["steps"])
        errors += step_errors
    mailbox_ids = None
    if "mailbox_ids" in data:
        mailbox_ids, mailbox_errors = _campaign_mailbox_ids(conn, data)
        errors += mailbox_errors
    if errors:
        return _error("Campaign validation failed.", 400, details=errors)
    locked = _write_campaign(conn, campaign_id, fields, mailbox_ids, steps)
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    payload = _campaign_detail(conn, campaign)
    payload["locked_steps"] = locked
    return jsonify(payload)


@bp.delete("/campaigns/<int:campaign_id>")
def campaign_delete(campaign_id):
    """Delete a draft and everything that belongs to it. Non-drafts are refused."""
    conn = _conn()
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return _error("Campaign not found.", 404)
    if campaign["status"] != "draft":
        return _error(f"Cannot delete a campaign with status '{campaign['status']}': only drafts can be deleted.",
                      409)
    lead_ids = [row["id"] for row in conn.execute("SELECT id FROM leads WHERE campaign_id=?", (campaign_id,))]
    marks = ",".join("?" for _ in lead_ids) or "NULL"
    deleted = {}
    step_filter = "step_id IN (SELECT id FROM steps WHERE campaign_id=?)"
    for table, where, args in (
            ("messages", f"campaign_id=? OR lead_id IN ({marks})", (campaign_id, *lead_ids)),
            ("events", f"campaign_id=? OR lead_id IN ({marks})", (campaign_id, *lead_ids)),
            ("sends", "campaign_id=?", (campaign_id,)),
            ("leads", "campaign_id=?", (campaign_id,)),
            ("imports", "campaign_id=?", (campaign_id,)),
            ("step_variants", step_filter, (campaign_id,)),
            ("lead_step_variant", step_filter, (campaign_id,)),
            ("steps", "campaign_id=?", (campaign_id,)),
            ("campaign_mailboxes", "campaign_id=?", (campaign_id,))):
        deleted[table] = conn.execute(f"DELETE FROM {table} WHERE {where}", args).rowcount
    conn.execute("DELETE FROM campaigns WHERE id=?", (campaign_id,))
    return jsonify({"deleted": campaign_id, "campaign_name": campaign["name"],
                    "leads_deleted": deleted["leads"], "steps_deleted": deleted["steps"],
                    "imports_deleted": deleted["imports"], "messages_deleted": deleted["messages"]})


@bp.get("/campaigns/<int:campaign_id>/steps")
def campaign_steps_list(campaign_id):
    conn = _conn()
    if conn.execute("SELECT 1 FROM campaigns WHERE id=?", (campaign_id,)).fetchone() is None:
        return _error("Campaign not found.", 404)
    sent_ids = _sent_step_ids(conn, campaign_id)
    return jsonify({"campaign_id": campaign_id, "steps": [
        {**dict(row), "locked": row["id"] in sent_ids, "variants": _step_variants_payload(conn, row)}
        for row in core.campaign_steps(conn, campaign_id)]})


@bp.get("/campaigns/<int:campaign_id>/fields")
def campaign_fields(campaign_id):
    """Merge fields available from this campaign's imported leads (for the editor)."""
    conn = _conn()
    if conn.execute("SELECT 1 FROM campaigns WHERE id=?", (campaign_id,)).fetchone() is None:
        return _error("Campaign not found.", 404)
    names = set()
    for row in conn.execute("SELECT fields_json FROM leads WHERE campaign_id=?", (campaign_id,)):
        try:
            names.update(json.loads(row["fields_json"] or "{}").keys())
        except (ValueError, TypeError):
            continue
    names.discard("email")
    return jsonify({"campaign_id": campaign_id, "fields": ["email", *sorted(names)]})


@bp.post("/campaigns/<int:campaign_id>/steps/<int:position>/variants")
def campaign_step_variant_create(campaign_id, position):
    """Add a content arm to a step. The step's own subject/body stays arm 'A'."""
    conn = _conn()
    campaign, error = _editable_campaign_or_error(conn, campaign_id)
    if error:
        return error
    step = _step_at(conn, campaign_id, position)
    if step is None:
        return _error("Step not found in this campaign.", 404)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    fields, errors = _variant_fields(data)
    if errors:
        return _error("Variant validation failed.", 400, details=errors)
    taken = {row["label"] for row in core.step_variants(conn, step["id"])}
    label = next((letter for letter in core.VARIANT_LABELS if letter != "A" and letter not in taken), None)
    if label is None:
        return _error("This step already has the maximum number of variants (B-Z).", 400)
    cur = conn.execute(
        "INSERT INTO step_variants(step_id, label, subject, body, weight, enabled, created_at) "
        "VALUES(?,?,?,?,?,?,?)",
        (step["id"], label, fields["subject"], fields["body"], fields["weight"], fields["enabled"],
         core.ts(core.utcnow())))
    row = conn.execute("SELECT * FROM step_variants WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify({"step_id": step["id"], "position": position,
                    "variant": {**dict(row), "locked": False}}), 201


@bp.put("/variants/<int:variant_id>")
def variant_update(variant_id):
    """Weight and `enabled` always change; subject/body are locked once it has sends."""
    conn = _conn()
    variant = conn.execute("SELECT * FROM step_variants WHERE id=?", (variant_id,)).fetchone()
    if variant is None:
        return _error("Variant not found.", 404)
    step = conn.execute("SELECT * FROM steps WHERE id=?", (variant["step_id"],)).fetchone()
    if step is None:
        return _error("Variant not found.", 404)
    campaign, error = _editable_campaign_or_error(conn, step["campaign_id"])
    if error:
        return error
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    sent_count = conn.execute("SELECT COUNT(*) FROM sends WHERE variant_id=?", (variant_id,)).fetchone()[0]
    if sent_count and ("subject" in data or "body" in data):
        return _error("This variant has already been sent, so its content is locked. "
                      "Create a new variant instead.", 409)
    fields, errors = _variant_fields(data, existing=variant)
    if errors:
        return _error("Variant validation failed.", 400, details=errors)
    conn.execute("UPDATE step_variants SET subject=?, body=?, weight=?, enabled=? WHERE id=?",
                 (fields["subject"], fields["body"], fields["weight"], fields["enabled"], variant_id))
    row = conn.execute("SELECT * FROM step_variants WHERE id=?", (variant_id,)).fetchone()
    return jsonify({"variant": {**dict(row), "locked": bool(sent_count)}})


@bp.delete("/variants/<int:variant_id>")
def variant_delete(variant_id):
    """Delete an unsent variant; one that already has sends is disabled instead."""
    conn = _conn()
    variant = conn.execute("SELECT * FROM step_variants WHERE id=?", (variant_id,)).fetchone()
    if variant is None:
        return _error("Variant not found.", 404)
    step = conn.execute("SELECT * FROM steps WHERE id=?", (variant["step_id"],)).fetchone()
    if step is None:
        return _error("Variant not found.", 404)
    campaign, error = _editable_campaign_or_error(conn, step["campaign_id"])
    if error:
        return error
    sent_count = conn.execute("SELECT COUNT(*) FROM sends WHERE variant_id=?", (variant_id,)).fetchone()[0]
    if sent_count:
        conn.execute("UPDATE step_variants SET enabled=0 WHERE id=?", (variant_id,))
        return jsonify({"id": variant_id, "deleted": False, "disabled": True,
                        "reason": "Already sent: disabled instead of deleted so the results stay reportable."})
    conn.execute("DELETE FROM step_variants WHERE id=?", (variant_id,))
    conn.execute("DELETE FROM lead_step_variant WHERE variant_id=?", (variant_id,))
    return jsonify({"id": variant_id, "deleted": True, "disabled": False})


@bp.put("/campaigns/<int:campaign_id>/steps/<int:position>/weights")
def campaign_step_weights(campaign_id, position):
    """Set several arms' weights in one call: {"weights": {"A": 50, "B": 50}}."""
    conn = _conn()
    campaign, error = _editable_campaign_or_error(conn, campaign_id)
    if error:
        return error
    step = _step_at(conn, campaign_id, position)
    if step is None:
        return _error("Step not found in this campaign.", 404)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    weights = data.get("weights")
    if not isinstance(weights, dict) or not weights:
        return _error('weights must be an object of label -> 1-100, e.g. {"A": 50, "B": 50}.', 400)
    rows = {row["label"]: row for row in core.step_variants(conn, step["id"])}
    errors, parsed = [], {}
    for raw_label, value in weights.items():
        label = str(raw_label).strip().upper()
        if label != "A" and label not in rows:
            errors.append(f"Unknown variant label '{label}' for step {position}.")
            continue
        weight, problem = _weight_value(value, f"weights.{label}")
        if problem:
            errors.append(problem)
            continue
        parsed[label] = weight
    if errors:
        return _error("Weight validation failed.", 400, details=errors)
    for label, weight in parsed.items():
        if label == "A":
            conn.execute("UPDATE steps SET weight=? WHERE id=?", (weight, step["id"]))
        else:
            conn.execute("UPDATE step_variants SET weight=? WHERE id=?", (weight, rows[label]["id"]))
    step = conn.execute("SELECT * FROM steps WHERE id=?", (step["id"],)).fetchone()
    return jsonify({"step_id": step["id"], "position": position,
                    "variants": _step_variants_payload(conn, step)})


@bp.get("/campaigns/<int:campaign_id>/variants")
def campaign_variant_stats(campaign_id):
    """Per step and arm: sent / replied / bounced / unsubscribed / reply_rate.

    A reply is credited to the arm of the last send that reached that lead before the
    reply. Stats only: nothing is auto-promoted, disabled or paused.
    """
    conn = _conn()
    if conn.execute("SELECT 1 FROM campaigns WHERE id=?", (campaign_id,)).fetchone() is None:
        return _error("Campaign not found.", 404)
    return jsonify(core.variant_stats(conn, campaign_id))


@bp.post("/campaigns/<int:campaign_id>/preview")
def campaign_preview(campaign_id):
    """Render one lead's next (or a chosen) step with the worker's own renderer."""
    conn = _conn()
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return _error("Campaign not found.", 404)
    data = _payload()
    if data is None:
        return _error("Request body must be a JSON object.", 400)
    raw_lead = data.get("lead_id")
    if isinstance(raw_lead, bool) or not str(raw_lead).strip().isdigit():
        return _error("lead_id is required and must be an integer.", 400)
    lead = conn.execute("SELECT * FROM leads WHERE id=? AND campaign_id=?",
                        (int(str(raw_lead).strip()), campaign_id)).fetchone()
    if lead is None:
        return _error("Lead not found in this campaign.", 404)
    steps = core.campaign_steps(conn, campaign_id)
    if not steps:
        return _error("Campaign has no steps to preview.", 400)
    by_position = {step["position"]: step for step in steps}
    if data.get("step") is not None:
        raw_step = data["step"]
        if isinstance(raw_step, bool) or not str(raw_step).strip().isdigit():
            return _error("step must be an integer position.", 400)
        position = int(str(raw_step).strip())
        step = by_position.get(position)
        if step is None:
            return _error("Step not found in this campaign.", 404)
    else:
        # The worker sends steps[current_step] next, so preview that one (clamped to the last step).
        position = min((lead["current_step"] or 0) + 1, steps[-1]["position"])
        step = by_position[position]
    # Arm: an explicit label wins, otherwise the lead's sticky assignment, otherwise base 'A'.
    arms = {arm["label"]: arm for arm in core.all_variants(conn, step)}
    if data.get("variant") is not None:
        label = str(data["variant"]).strip().upper()
        if label not in arms:
            return _error("Variant not found in this step.", 404)
    else:
        label = "A"
        assigned = core.assigned_variant(conn, lead["id"], step["id"])
        if assigned is not None and assigned["variant_id"] is not None:
            stored = conn.execute("SELECT label FROM step_variants WHERE id=?",
                                  (assigned["variant_id"],)).fetchone()
            if stored is not None and stored["label"] in arms:
                label = stored["label"]
    arm = arms[label]
    fields = json.loads(lead["fields_json"] or "{}")
    fields.setdefault("email", lead["email"])
    result = {"campaign_id": campaign_id, "lead_id": lead["id"], "email": lead["email"],
              "position": position, "variant": label, "fields": fields, "merge_error": None}
    try:
        body = mailer.render(arm["body"], fields)
        if (arm["subject"] or "").strip():
            subject = mailer.render(arm["subject"], fields)
        else:
            subject = engine.reply_subject(conn, lead, steps, fields)
    except mailer.MergeError as exc:
        result["merge_error"] = str(exc)
        result["subject"] = result["body"] = result["text"] = None
        return jsonify(result)
    result["subject"], result["body"] = subject, body
    # Same footer assembly as web.campaign_preview (first assigned mailbox, or a placeholder).
    mailboxes = core.campaign_mailboxes(conn, campaign_id)
    if mailboxes:
        business, address = core.resolve_sender(conn, mailboxes[0])
        url = f"{config.public_base_url() or '{PUBLIC_BASE_URL}'}/u/{lead['unsub_token']}"
        signature = mailboxes[0]["signature"]
        text = body + (("\n\n" + signature.strip()) if signature and signature.strip() else "")
        result["text"] = text + "\n\n--\n" + mailer.footer_text(business, address or "(SENDER ADDRESS MISSING)", url)
    else:
        result["text"] = body + "\n\n--\n(footer added at send: business name, postal address, unsubscribe link)"
    return jsonify(result)


@bp.post("/campaigns/<int:campaign_id>/start")
def campaign_start(campaign_id):
    conn = _conn()
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return _error("Campaign not found.", 404)
    core.enqueue_suppression_check(conn, campaign_id)
    errors = core.validate_start(conn, campaign_id)
    if errors:
        return _error("Cannot start campaign.", 400, details=errors)
    conn.execute("UPDATE campaigns SET status='active', paused_reason=NULL WHERE id=?", (campaign_id,))
    return jsonify({"id": campaign_id, "status": "active"})


@bp.post("/campaigns/<int:campaign_id>/pause")
def campaign_pause(campaign_id):
    conn = _conn()
    campaign = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    if campaign is None:
        return _error("Campaign not found.", 404)
    conn.execute("UPDATE campaigns SET status='paused', paused_reason='Paused manually' "
                 "WHERE id=? AND status='active'", (campaign_id,))
    row = conn.execute("SELECT * FROM campaigns WHERE id=?", (campaign_id,)).fetchone()
    return jsonify({"id": row["id"], "status": row["status"], "paused_reason": row["paused_reason"]})


@bp.post("/campaigns/<int:campaign_id>/leads/import")
def campaign_leads_import(campaign_id):
    """Import leads, mirroring web.campaign_import (a closure in create_app).

    Accepts a multipart CSV upload (like the web form) or JSON
    {filename, lawful_basis_confirmed, csv_text}. The lawful-basis acknowledgement is
    stored in `imports` exactly as the web route stores it: who, when, filename.
    """
    conn = _conn()
    if conn.execute("SELECT 1 FROM campaigns WHERE id=?", (campaign_id,)).fetchone() is None:
        return _error("Campaign not found.", 404)

    if request.mimetype == "multipart/form-data":
        if not _as_bool(request.form.get("lawful_basis_confirmed") or request.form.get("lawful_basis"), 0):
            return _error(LAWFUL_BASIS_MESSAGE, 400)
        upload = request.files.get("file")
        if upload is None or not upload.filename:
            return _error("Choose a CSV file to import.", 400)
        from .web import _read_upload  # web.py's own CSV decoder (lazy: web imports api at load)
        csv_text = _read_upload(upload)
        filename = upload.filename
        acknowledged_by = (request.form.get("acknowledged_by") or "owner").strip()[:200]
    else:
        data = _payload()
        if data is None:
            return _error("Request body must be a JSON object.", 400)
        if _as_bool(data.get("lawful_basis_confirmed"), 0) != 1:
            return _error(LAWFUL_BASIS_MESSAGE, 400)
        csv_text = data.get("csv_text")
        if not isinstance(csv_text, str) or not csv_text.strip():
            return _error("csv_text is required.", 400)
        filename = str(data.get("filename") or "api-import.csv").strip() or "api-import.csv"
        acknowledged_by = str(data.get("acknowledged_by") or "owner").strip()[:200]

    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames or "email" not in [core.norm_key(f) for f in reader.fieldnames]:
        return _error("Import rejected: the CSV needs an 'email' column.", 400)

    now = core.ts(core.utcnow())
    cur = conn.execute("INSERT INTO imports(campaign_id, filename, acknowledged_at, acknowledged_by) "
                       "VALUES(?,?,?,?)", (campaign_id, filename[:255], now, acknowledged_by))
    import_id = cur.lastrowid
    existing = {row["email"] for row in conn.execute("SELECT email FROM leads WHERE campaign_id=?",
                                                      (campaign_id,))}
    counts = {"rows": 0, "imported": 0, "suppressed": 0, "invalid": 0, "duplicates": 0}
    rejected, rejected_total = [], [0]

    def reject(row_no, address, reason):
        rejected_total[0] += 1
        if len(rejected) < REJECTED_LIMIT:
            rejected.append({"row": row_no, "email": address, "reason": reason})

    for row in reader:
        counts["rows"] += 1
        # Every column except `email` is kept as a merge field, exactly like the web import.
        fields = {core.norm_key(key): (value or "").strip() for key, value in row.items() if key}
        email_addr = fields.pop("email", "").strip().lower()
        if not core.valid_email(email_addr):
            counts["invalid"] += 1
            reject(counts["rows"], email_addr, "invalid email")
            continue
        if email_addr in existing:
            counts["duplicates"] += 1
            reject(counts["rows"], email_addr, "duplicate")
            continue
        existing.add(email_addr)
        status = "suppressed" if core.is_suppressed(conn, email_addr) else "queued"
        cur = conn.execute(
            "INSERT INTO leads(campaign_id, import_id, email, fields_json, status, unsub_token, updated_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (campaign_id, import_id, email_addr, json.dumps(fields), status,
             secrets.token_urlsafe(24), now))
        if status == "suppressed":
            counts["suppressed"] += 1
            core.log_event(conn, "suppressed_skip", "on suppression list at import", cur.lastrowid,
                           campaign_id, email_addr)
            reject(counts["rows"], email_addr, "suppressed")
        else:
            counts["imported"] += 1
    # Same `imports` bookkeeping columns the web route writes after the loop (accepted == imported).
    conn.execute("UPDATE imports SET rows=?, accepted=?, suppressed=?, invalid=?, duplicates=? WHERE id=?",
                 (counts["rows"], counts["imported"], counts["suppressed"], counts["invalid"],
                  counts["duplicates"], import_id))
    return jsonify({"import_id": import_id, "campaign_id": campaign_id, "filename": filename[:255],
                    "acknowledged_at": now, "acknowledged_by": acknowledged_by, "counts": counts,
                    "rejected": rejected, "rejected_total": rejected_total[0],
                    "rejected_truncated": rejected_total[0] > len(rejected)}), 201


# ---------------------------------------------------------------- leads + stats
@bp.get("/leads")
def leads_list():
    campaign_id = request.args.get("campaign_id")
    status = (request.args.get("status") or "").strip()
    if status and status != "waiting_cap" and status not in core.LEAD_STATUSES:
        return _error(f"status must be one of: {', '.join(core.LEAD_STATUSES)} (or waiting_cap)", 400)
    where, args = " WHERE 1=1", []
    if campaign_id:
        if not campaign_id.isdigit():
            return _error("campaign_id must be an integer.", 400)
        where += " AND l.campaign_id=?"
        args.append(int(campaign_id))
    if status == "waiting_cap":
        where += " AND l.wait_reason='waiting on cap' AND l.status IN ('queued','active')"
    elif status:
        where += " AND l.status=?"
        args.append(status)
    limit, offset = _paging(default=100, maximum=500)
    conn = _conn()
    total = conn.execute(f"SELECT COUNT(*) FROM leads l{where}", args).fetchone()[0]
    rows = conn.execute(
        "SELECT l.*, c.name AS campaign_name, m.label AS mailbox_label, m.from_email AS mailbox_email "
        f"FROM leads l LEFT JOIN campaigns c ON c.id=l.campaign_id "
        f"LEFT JOIN mailboxes m ON m.id=l.mailbox_id{where} ORDER BY l.id LIMIT ? OFFSET ?",
        (*args, limit, offset)).fetchall()
    return jsonify({"total": total, "limit": limit, "offset": offset,
                    "leads": [_lead_public(row) for row in rows]})


@bp.get("/stats")
def stats():
    conn = _conn()
    keys = ("sent", "replied", "bounced", "unsubscribed")
    total = {key: 0 for key in keys}
    per_campaign = []
    for campaign in conn.execute("SELECT * FROM campaigns ORDER BY id").fetchall():
        campaign_stats = core.campaign_stats(conn, campaign["id"])
        for key in keys:
            total[key] += campaign_stats[key]
        per_campaign.append({
            "campaign_id": campaign["id"],
            "name": campaign["name"],
            "status": campaign["status"],
            **{key: campaign_stats[key] for key in keys},
            "queued": campaign_stats["queued"],
            "active": campaign_stats["active"],
        })
    return jsonify({"total": total, "campaigns": per_campaign})


# ---------------------------------------------------------------- fallback
@bp.route("/<path:subpath>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def api_not_found(subpath):  # noqa: ARG001
    """JSON 404 for unknown /api paths (keeps the API from returning the login redirect)."""
    return _error("Not found.", 404)
