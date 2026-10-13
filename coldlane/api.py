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
cap, throttle, footer and lawful-basis rules are unchanged by this layer.
"""
import hmac
import json

from flask import Blueprint, g, jsonify, make_response, request

from . import config, core, crypto, db, mailer

bp = Blueprint("api", __name__, url_prefix="/api")

CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS"
CORS_HEADERS = "Content-Type, X-API-Key"
DEFAULT_LIMIT = 50
MAX_LIMIT = 200

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
    return jsonify({
        "campaign": dict(campaign),
        "steps": [dict(row) for row in core.campaign_steps(conn, campaign_id)],
        "mailboxes": [_mailbox_public(conn, row) for row in core.campaign_mailboxes(conn, campaign_id)],
        "stats": core.campaign_stats(conn, campaign_id),
        "start_errors": core.validate_start(conn, campaign_id) if campaign["status"] in ("draft", "completed") else [],
    })


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
