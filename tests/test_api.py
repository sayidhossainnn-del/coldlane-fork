"""Tests for the /api JSON blueprint (coldlane/api.py).

Run: python -m unittest discover -s tests
"""
import datetime as dt
import json
import os
import socket
import sys
import tempfile
import unittest
import uuid
from email import message_from_bytes, policy

from cryptography.fernet import Fernet

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aiosmtpd.controller import Controller  # noqa: E402

from coldlane import core, crypto, db  # noqa: E402

API_KEY = "test-api-key"
CORS_ORIGIN = "https://frontend.example.test"
SMTP_PW = "secret-pw-123"
IMAP_PW = "imap-pw-456"
SECRET_SUBSTRINGS = (SMTP_PW, IMAP_PW, "smtp_pass_enc", "imap_pass_enc")


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class SmtpHandler:
    """aiosmtpd handler that records what was actually sent; rejects bounce* recipients."""

    def __init__(self):
        self.messages = []

    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        if address.startswith("bounce"):
            return "550 5.1.1 No such user"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        self.messages.append({"from": envelope.mail_from, "to": list(envelope.rcpt_tos),
                              "raw": envelope.content})
        return "250 Message accepted"


def all_keys(value):
    """Every dict key anywhere in a decoded JSON response."""
    keys = set()
    if isinstance(value, dict):
        for key, item in value.items():
            keys.add(key)
            keys |= all_keys(item)
    elif isinstance(value, list):
        for item in value:
            keys |= all_keys(item)
    return keys


class ApiBase(unittest.TestCase):
    api_key = API_KEY
    cors_origin = CORS_ORIGIN

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env_backup = dict(os.environ)
        os.environ.update({
            "DATABASE_PATH": os.path.join(self.tmp.name, "coldlane.db"),
            "ENCRYPTION_KEY": Fernet.generate_key().decode(),
            "SECRET_KEY": "test-secret",
            "OWNER_PASSWORD": "testpass",
            "PUBLIC_BASE_URL": "http://127.0.0.1:8080",
            "SENDER_BUSINESS_NAME": "Harbor Growth Agency",
            "SENDER_ADDRESS": "12 Test Street, Testville, CA 90000, USA",
            "MIN_GAP_SECONDS": "0",
            "MAX_GAP_SECONDS": "0",
        })
        if self.api_key:
            os.environ["API_KEY"] = self.api_key
        else:
            os.environ.pop("API_KEY", None)
        if self.cors_origin:
            os.environ["API_CORS_ORIGIN"] = self.cors_origin
        else:
            os.environ.pop("API_CORS_ORIGIN", None)
        crypto.reset_cache()
        from coldlane.web import create_app
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        self.conn = db.connect()

    def tearDown(self):
        self.conn.close()
        os.environ.clear()
        os.environ.update(self.env_backup)
        crypto.reset_cache()
        self.tmp.cleanup()

    # ---------------------------------------------------------------- helpers
    def api(self, method, path, key=API_KEY, headers=None, **kwargs):
        headers = dict(headers or {})
        if key is not None:
            headers["X-API-Key"] = key
        return getattr(self.client, method)(path, headers=headers, **kwargs)

    def seed_thread(self):
        """One mailbox, one campaign, one lead and a two-message (out then in) thread."""
        now = core.ts(core.utcnow())
        later = core.ts(core.utcnow() + dt.timedelta(minutes=1))
        cur = self.conn.execute(
            "INSERT INTO mailboxes(label, from_name, from_email, smtp_host, created_at) "
            "VALUES('A','Sam','a@agency.test','127.0.0.1',?)", (now,))
        mailbox_id = cur.lastrowid
        cur = self.conn.execute("INSERT INTO campaigns(name, created_at) VALUES('Test campaign', ?)", (now,))
        campaign_id = cur.lastrowid
        cur = self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, unsub_token, current_step, "
            "last_sent_at, updated_at) VALUES(?,?,?,?,?,?,?,?)",
            (campaign_id, "lead1@example.test", json.dumps({"first_name": "Ava", "company": "Brightline"}),
             "replied", "tok-lead1", 1, now, now))
        lead_id = cur.lastrowid
        db.insert_message(self.conn, lead_id=lead_id, campaign_id=campaign_id, mailbox_id=mailbox_id,
                          direction="out", kind="sent", message_id="<out-1@agency.test>",
                          from_email="a@agency.test", to_email="lead1@example.test",
                          subject="Hello there", body="Hi Ava, quick question.", received_at=now, is_read=1)
        db.insert_message(self.conn, lead_id=lead_id, campaign_id=campaign_id, mailbox_id=mailbox_id,
                          direction="in", kind="reply", message_id="<in-1@example.test>",
                          in_reply_to="<out-1@agency.test>", from_email="lead1@example.test",
                          to_email="a@agency.test", subject="Re: Hello there",
                          body="Sounds good, let's talk Tuesday.", received_at=later, is_read=0)
        return {"mailbox_id": mailbox_id, "campaign_id": campaign_id, "lead_id": lead_id}

    def make_startable(self, email_addr="queued1@example.test"):
        """A draft campaign with one active mailbox, one step and one queued lead."""
        now = core.ts(core.utcnow())
        cur = self.conn.execute(
            "INSERT INTO mailboxes(label, from_name, from_email, smtp_host, created_at) "
            "VALUES('Sender','Sam','sender@agency.test','127.0.0.1',?)", (now,))
        mailbox_id = cur.lastrowid
        cur = self.conn.execute("INSERT INTO campaigns(name, created_at) VALUES('Startable', ?)", (now,))
        campaign_id = cur.lastrowid
        self.conn.execute("INSERT INTO campaign_mailboxes(campaign_id, mailbox_id) VALUES(?,?)",
                          (campaign_id, mailbox_id))
        self.conn.execute("INSERT INTO steps(campaign_id, position, subject, body, delay_minutes) "
                          "VALUES(?,1,'Quick question','Hi there',0)", (campaign_id,))
        self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, unsub_token, updated_at) "
            "VALUES(?,?,?,'queued',?,?)",
            (campaign_id, email_addr, json.dumps({"first_name": "Ava"}), "tok-queued", now))
        return campaign_id, mailbox_id


class TestApiAuth(ApiBase):
    def test_missing_or_wrong_key_returns_401(self):
        for path in ("/api/threads", "/api/templates", "/api/mailboxes", "/api/campaigns", "/api/leads",
                     "/api/stats"):
            r = self.client.get(path)
            self.assertEqual(r.status_code, 401, path)
            self.assertIn("error", r.get_json(), path)
        # A wrong key is rejected the same way, and never a login redirect.
        r = self.api("get", "/api/threads", key="nope")
        self.assertEqual(r.status_code, 401)
        self.assertNotIn("Location", r.headers)
        # Mutating methods are gated too.
        self.assertEqual(self.client.post("/api/threads/1/read").status_code, 401)
        self.assertEqual(self.client.post("/api/templates", json={"name": "x"}).status_code, 401)
        self.assertEqual(self.client.put("/api/templates/1", json={"name": "x"}).status_code, 401)
        self.assertEqual(self.client.delete("/api/templates/1").status_code, 401)
        # The right key works and is JSON.
        r = self.api("get", "/api/threads")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.is_json)

    def test_web_login_unchanged_and_api_does_not_use_the_session(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/login", r.headers["Location"])
        # Logged in, the API still requires its key.
        self.client.post("/login", data={"password": "testpass"})
        self.assertEqual(self.client.get("/api/threads").status_code, 401)
        self.assertEqual(self.api("get", "/api/threads").status_code, 200)

    def test_unknown_api_path_is_json(self):
        r = self.api("get", "/api/nope")
        self.assertEqual(r.status_code, 404)
        self.assertTrue(r.is_json)
        # Without a key it is 401, not a redirect or an HTML 404.
        r = self.client.get("/api/nope")
        self.assertEqual(r.status_code, 401)


class TestApiDisabled(ApiBase):
    api_key = None

    def test_api_disabled_without_key(self):
        for method, path in (("get", "/api/threads"), ("post", "/api/templates"), ("get", "/api/stats")):
            r = self.api(method, path, key="anything")
            self.assertEqual(r.status_code, 404, path)
        # OPTIONS is disabled too.
        self.assertEqual(self.client.options("/api/threads").status_code, 404)


class TestApiCors(ApiBase):
    def test_preflight_and_headers(self):
        r = self.client.options("/api/threads", headers={
            "Origin": CORS_ORIGIN, "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-API-Key"})
        self.assertEqual(r.status_code, 204)
        self.assertEqual(r.headers["Access-Control-Allow-Origin"], CORS_ORIGIN)
        self.assertIn("GET", r.headers["Access-Control-Allow-Methods"])
        self.assertIn("X-API-Key", r.headers["Access-Control-Allow-Headers"])
        # Real responses carry the CORS header too.
        r = self.api("get", "/api/threads")
        self.assertEqual(r.headers["Access-Control-Allow-Origin"], CORS_ORIGIN)
        # The 401 path carries it as well, so the browser can read the error.
        r = self.client.get("/api/threads")
        self.assertEqual(r.headers["Access-Control-Allow-Origin"], CORS_ORIGIN)


class TestApiNoCors(ApiBase):
    cors_origin = None

    def test_no_cors_headers_without_origin(self):
        r = self.api("get", "/api/threads")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("Access-Control-Allow-Origin", r.headers)


class TestApiThreads(ApiBase):
    def test_list_filter_and_paging(self):
        ids = self.seed_thread()
        r = self.api("get", "/api/threads")
        self.assertEqual(r.status_code, 200)
        body = r.get_json()
        self.assertEqual(len(body["threads"]), 1)
        thread = body["threads"][0]
        self.assertEqual(thread["lead_id"], ids["lead_id"])
        self.assertEqual(thread["lead_email"], "lead1@example.test")
        self.assertEqual(thread["last_direction"], "in")
        self.assertEqual(thread["unread_count"], 1)
        self.assertEqual(thread["campaign_name"], "Test campaign")

        self.assertEqual(len(self.api("get", "/api/threads?filter=replied").get_json()["threads"]), 1)
        self.assertEqual(len(self.api("get", "/api/threads?filter=unread").get_json()["threads"]), 1)
        self.assertEqual(self.api("get", "/api/threads?filter=bogus").status_code, 400)
        self.assertEqual(self.api("get", "/api/threads?limit=0&offset=-3").status_code, 200)
        self.assertEqual(len(self.api("get", "/api/threads?limit=1&offset=1").get_json()["threads"]), 0)

    def test_detail_oldest_first_and_mark_read(self):
        ids = self.seed_thread()
        r = self.api("get", f"/api/threads/{ids['lead_id']}")
        self.assertEqual(r.status_code, 200)
        body = r.get_json()
        self.assertEqual(body["lead"]["email"], "lead1@example.test")
        self.assertEqual([m["direction"] for m in body["messages"]], ["out", "in"])
        self.assertIn("quick question", body["messages"][0]["body"])
        self.assertEqual(body["messages"][0]["subject"], "Hello there")

        r = self.api("post", f"/api/threads/{ids['lead_id']}/read")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["marked_read"], 1)
        body = self.api("get", f"/api/threads/{ids['lead_id']}").get_json()
        self.assertTrue(all(m["is_read"] == 1 for m in body["messages"]))
        self.assertEqual(len(self.api("get", "/api/threads?filter=unread").get_json()["threads"]), 0)
        # Idempotent.
        self.assertEqual(self.api("post", f"/api/threads/{ids['lead_id']}/read").get_json()["marked_read"], 0)

    def test_unknown_lead_404(self):
        self.assertEqual(self.api("get", "/api/threads/9999").status_code, 404)
        self.assertEqual(self.api("post", "/api/threads/9999/read").status_code, 404)


class TestApiTemplates(ApiBase):
    def test_crud(self):
        r = self.api("post", "/api/templates", json={"name": "Follow-up 1",
                                                     "subject": "Re: {{company}}", "body": "Hi {{first_name|there}},"})
        self.assertEqual(r.status_code, 201)
        created = r.get_json()
        tid = created["id"]
        self.assertEqual(created["name"], "Follow-up 1")
        self.assertTrue(created["created_at"] and created["updated_at"])

        self.assertEqual(self.api("post", "/api/templates", json={"subject": "no name"}).status_code, 400)
        self.assertEqual(self.api("post", "/api/templates", data="not json",
                                  headers={"Content-Type": "application/json"}).status_code, 400)

        listed = self.api("get", "/api/templates").get_json()["templates"]
        self.assertEqual([t["id"] for t in listed], [tid])

        r = self.api("put", f"/api/templates/{tid}", json={"name": "Follow-up 2", "body": "Bumping this."})
        self.assertEqual(r.status_code, 200)
        updated = r.get_json()
        self.assertEqual((updated["name"], updated["body"]), ("Follow-up 2", "Bumping this."))
        self.assertEqual(updated["subject"], "Re: {{company}}")  # untouched when not sent
        self.assertEqual(self.api("put", f"/api/templates/{tid}", json={"name": ""}).status_code, 400)
        self.assertEqual(self.api("put", "/api/templates/9999", json={"name": "x"}).status_code, 404)

        self.assertEqual(self.api("delete", f"/api/templates/{tid}").status_code, 200)
        self.assertEqual(self.api("get", "/api/templates").get_json()["templates"], [])
        self.assertEqual(self.api("delete", f"/api/templates/{tid}").status_code, 404)


class TestApiMailboxes(ApiBase):
    def test_no_secrets_in_any_response(self):
        r = self.api("post", "/api/mailboxes", json={
            "from_email": "a@agency.test", "label": "A", "smtp_host": "127.0.0.1", "smtp_port": 587,
            "smtp_security": "starttls", "smtp_user": "a@agency.test", "smtp_password": SMTP_PW,
            "imap_host": "127.0.0.1", "imap_port": 993, "imap_user": "a@agency.test",
            "imap_password": IMAP_PW, "daily_cap": 30})
        self.assertEqual(r.status_code, 201, r.data)
        created = r.get_json()
        self.assertTrue(created["has_smtp_password"] and created["has_imap_password"])
        mid = created["id"]

        responses = [r.data.decode(), self.api("get", "/api/mailboxes").data.decode(),
                     self.api("put", f"/api/mailboxes/{mid}", json={"label": "A2"}).data.decode()]
        for text in responses:
            for secret in SECRET_SUBSTRINGS:
                self.assertNotIn(secret, text)

        # Nothing in any serialized payload is named like a password column.
        for payload in (created, self.api("get", "/api/mailboxes").get_json(),
                        self.api("get", f"/api/campaigns").get_json()):
            self.assertEqual(all_keys(payload) & {"smtp_pass_enc", "imap_pass_enc"}, set())

        # The password is still encrypted at rest and unchanged by a password-less update.
        row = self.conn.execute("SELECT * FROM mailboxes WHERE id=?", (mid,)).fetchone()
        self.assertNotIn(SMTP_PW, row["smtp_pass_enc"])
        self.assertEqual(crypto.decrypt(row["smtp_pass_enc"]), SMTP_PW)
        self.assertEqual(crypto.decrypt(row["imap_pass_enc"]), IMAP_PW)

    def test_validation_pause_resume_and_test(self):
        bad = self.api("post", "/api/mailboxes", json={"from_email": "not-an-email", "smtp_host": "h",
                                                        "daily_cap": 150})
        self.assertEqual(bad.status_code, 400)
        details = " ".join(bad.get_json()["details"])
        self.assertIn("from_email", details)
        self.assertIn("daily_cap", details)
        self.assertEqual(self.api("post", "/api/mailboxes", json={"from_email": "a@agency.test"}).status_code, 400)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM mailboxes").fetchone()[0], 0)

        ok = self.api("post", "/api/mailboxes", json={"from_email": "a@agency.test", "smtp_host": "127.0.0.1",
                                                       "smtp_port": free_port(), "smtp_security": "none"})
        self.assertEqual(ok.status_code, 201)
        mid = ok.get_json()["id"]

        r = self.api("post", f"/api/mailboxes/{mid}/pause")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["paused_reason"], "Paused via API")
        self.assertEqual(r.get_json()["active"], 1)
        r = self.api("post", f"/api/mailboxes/{mid}/resume")
        self.assertEqual(r.get_json()["paused_reason"], None)

        r = self.api("post", f"/api/mailboxes/{mid}/test")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.get_json()["ok"])  # closed port
        self.assertTrue(any("FAILED" in line for line in r.get_json()["results"]))

        self.assertEqual(self.api("post", "/api/mailboxes/9999/test").status_code, 404)
        self.assertEqual(self.api("post", "/api/mailboxes/9999/pause").status_code, 404)
        self.assertEqual(self.api("post", "/api/mailboxes/9999/resume").status_code, 404)
        self.assertEqual(self.api("put", "/api/mailboxes/9999", json={"label": "x"}).status_code, 404)


class TestApiCampaignsAndStats(ApiBase):
    def test_start_validation_and_stats(self):
        ids = self.seed_thread()  # draft campaign, no steps, no queued leads
        r = self.api("get", "/api/campaigns")
        self.assertEqual(r.status_code, 200)
        body = r.get_json()
        self.assertEqual(len(body["campaigns"]), 1)
        self.assertIn("stats", body["campaigns"][0])

        r = self.api("get", f"/api/campaigns/{ids['campaign_id']}")
        self.assertEqual(r.status_code, 200)
        detail = r.get_json()
        self.assertEqual(detail["steps"], [])
        self.assertTrue(detail["start_errors"])

        # Same validation as the web route: refuse to start an empty campaign.
        r = self.api("post", f"/api/campaigns/{ids['campaign_id']}/start")
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.get_json()["details"])
        self.assertEqual(self.conn.execute("SELECT status FROM campaigns WHERE id=?",
                                          (ids["campaign_id"],)).fetchone()[0], "draft")
        # Pausing a non-active campaign changes nothing.
        self.assertEqual(self.api("post", f"/api/campaigns/{ids['campaign_id']}/pause").get_json()["status"], "draft")
        self.assertEqual(self.api("get", "/api/campaigns/9999").status_code, 404)
        self.assertEqual(self.api("post", "/api/campaigns/9999/start").status_code, 404)
        self.assertEqual(self.api("post", "/api/campaigns/9999/pause").status_code, 404)

    def test_start_succeeds_and_stats_counts(self):
        campaign_id, mailbox_id = self.make_startable()
        r = self.api("post", f"/api/campaigns/{campaign_id}/start")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.get_json()["status"], "active")

        # One sent email, one reply, one bounce, one unsubscribe.
        now = core.ts(core.utcnow())
        lead_id = self.conn.execute("SELECT id FROM leads WHERE campaign_id=?", (campaign_id,)).fetchone()[0]
        self.conn.execute(
            "INSERT INTO sends(campaign_id, lead_id, step_pos, mailbox_id, recipient, recipient_domain, "
            "message_id, sent_at, status, attempt) VALUES(?,?,1,?,?,?,?,?,'sent',1)",
            (campaign_id, lead_id, mailbox_id, "queued1@example.test", "example.test", "<s1@x>", now))
        self.conn.execute("UPDATE leads SET status='replied' WHERE id=?", (lead_id,))
        self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, unsub_token, updated_at) "
            "VALUES(?, 'bounced1@example.test', '{}', 'bounced', 'tok-b', ?)", (campaign_id, now))
        self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, unsub_token, updated_at) "
            "VALUES(?, 'unsub1@example.test', '{}', 'unsubscribed', 'tok-u', ?)", (campaign_id, now))

        stats = self.api("get", "/api/stats").get_json()
        self.assertEqual(stats["total"], {"sent": 1, "replied": 1, "bounced": 1, "unsubscribed": 1})
        entry = stats["campaigns"][0]
        self.assertEqual(entry["campaign_id"], campaign_id)
        self.assertEqual((entry["sent"], entry["replied"], entry["bounced"], entry["unsubscribed"]),
                         (1, 1, 1, 1))

        # Pause then reports the manual reason, and start again is refused (no queued leads left).
        self.assertEqual(self.api("post", f"/api/campaigns/{campaign_id}/pause").get_json()["status"], "paused")
        self.assertEqual(self.api("post", f"/api/campaigns/{campaign_id}/start").status_code, 400)


class TestApiLeads(ApiBase):
    def test_filters_and_paging(self):
        ids = self.seed_thread()
        body = self.api("get", "/api/leads").get_json()
        self.assertEqual(body["total"], 1)
        lead = body["leads"][0]
        self.assertEqual(lead["email"], "lead1@example.test")
        self.assertEqual(lead["fields"], {"first_name": "Ava", "company": "Brightline"})
        self.assertEqual(lead["campaign_name"], "Test campaign")
        self.assertNotIn("unsub_token", lead)
        self.assertNotIn("fields_json", lead)

        self.assertEqual(self.api("get", f"/api/leads?campaign_id={ids['campaign_id']}").get_json()["total"], 1)
        self.assertEqual(self.api("get", "/api/leads?campaign_id=9999").get_json()["total"], 0)
        self.assertEqual(self.api("get", "/api/leads?status=replied").get_json()["total"], 1)
        self.assertEqual(self.api("get", "/api/leads?status=queued").get_json()["total"], 0)
        self.assertEqual(self.api("get", "/api/leads?status=waiting_cap").get_json()["total"], 0)
        self.assertEqual(self.api("get", "/api/leads?status=nonsense").status_code, 400)
        self.assertEqual(self.api("get", "/api/leads?campaign_id=abc").status_code, 400)


class TestApiThreadReply(ApiBase):
    """A real aiosmtpd server records exactly what goes out on the wire."""

    @classmethod
    def setUpClass(cls):
        cls.handler = SmtpHandler()
        cls.port = free_port()
        cls.controller = Controller(cls.handler, hostname="127.0.0.1", port=cls.port)
        cls.controller.start()

    @classmethod
    def tearDownClass(cls):
        cls.controller.stop()

    def setUp(self):
        super().setUp()
        self.handler.messages.clear()

    # ---------------------------------------------------------------- helpers
    def seed_reply_thread(self, cap=10, status="replied", email_addr="lead1@example.test", suppress=False):
        now = core.ts(core.utcnow())
        # The stored history is in the past so the reply we send now sorts after it.
        sent_at = core.ts(core.utcnow() - dt.timedelta(minutes=5))
        replied_at = core.ts(core.utcnow() - dt.timedelta(minutes=4))
        boxes = []
        for label, addr in (("A", "a@agency.test"), ("B", "b@agency.test")):
            cur = self.conn.execute(
                "INSERT INTO mailboxes(label, from_name, from_email, smtp_host, smtp_port, smtp_security, "
                "daily_cap, ramp_enabled, active, created_at) VALUES(?,?,?,?,?,'none',?,0,1,?)",
                (label, "Sam Sender", addr, "127.0.0.1", self.port, cap, now))
            boxes.append(cur.lastrowid)
        box_a, box_b = boxes
        cur = self.conn.execute("INSERT INTO campaigns(name, created_at) VALUES('Reply campaign', ?)", (now,))
        campaign_id = cur.lastrowid
        cur = self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, mailbox_id, current_step, last_sent_at, "
            "last_message_id, thread_subject, unsub_token, updated_at) VALUES(?,?,?,?,?,1,?,?,?,?,?)",
            (campaign_id, email_addr, json.dumps({"first_name": "Ava"}), status, box_a, sent_at,
             "<out-1@agency.test>", "Hello there", f"tok-reply-{uuid.uuid4().hex[:8]}", now))
        lead_id = cur.lastrowid
        db.insert_message(self.conn, lead_id=lead_id, campaign_id=campaign_id, mailbox_id=box_a,
                          direction="out", kind="sent", message_id="<out-1@agency.test>",
                          from_email="a@agency.test", to_email=email_addr, subject="Hello there",
                          body="Hi Ava, quick question.", received_at=sent_at, is_read=1)
        db.insert_message(self.conn, lead_id=lead_id, campaign_id=campaign_id, mailbox_id=box_a,
                          direction="in", kind="reply", message_id="<in-1@example.test>",
                          in_reply_to="<out-1@agency.test>", references_hdr="<out-1@agency.test>",
                          from_email=email_addr, to_email="a@agency.test", subject="Re: Hello there",
                          body="Sure, what time?", received_at=replied_at, is_read=0)
        if suppress:
            core.add_suppression(self.conn, email=email_addr, source="manual", note="test")
        return {"mailbox_a": box_a, "mailbox_b": box_b, "campaign_id": campaign_id, "lead_id": lead_id}

    def reply(self, lead_id, body="Sure, Tuesday 10am works.", mailbox_id=None, key=API_KEY):
        payload = {"body": body}
        if mailbox_id is not None:
            payload["mailbox_id"] = mailbox_id
        return self.api("post", f"/api/threads/{lead_id}/reply", key=key, json=payload)

    def lead_row(self, lead_id):
        return self.conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()

    # ---------------------------------------------------------------- tests
    def test_requires_api_key(self):
        ids = self.seed_reply_thread()
        without = self.client.post(f"/api/threads/{ids['lead_id']}/reply", json={"body": "hi"})
        self.assertEqual(without.status_code, 401)
        self.assertEqual(self.handler.messages, [])

    def test_sends_threaded_reply_with_footer_and_saves_message(self):
        ids = self.seed_reply_thread()
        before = self.lead_row(ids["lead_id"])
        r = self.reply(ids["lead_id"], body="Sure, Tuesday 10am works.\n\nSam")
        self.assertEqual(r.status_code, 201, r.data)
        payload = r.get_json()
        self.assertEqual(payload["mailbox_id"], ids["mailbox_a"])  # the mailbox that emailed the lead
        self.assertEqual(payload["subject"], "Re: Hello there")
        self.assertTrue(payload["message_id"].startswith("<"))

        # What actually went out.
        self.assertEqual(len(self.handler.messages), 1)
        sent = self.handler.messages[0]
        self.assertEqual(sent["from"], "a@agency.test")
        self.assertEqual(sent["to"], ["lead1@example.test"])
        msg = message_from_bytes(sent["raw"], policy=policy.default)
        self.assertEqual(msg["Subject"], "Re: Hello there")
        self.assertEqual(msg["In-Reply-To"], "<in-1@example.test>")  # newest message in the thread
        self.assertIn("<in-1@example.test>", msg["References"])
        self.assertIn("<out-1@agency.test>", msg["References"])
        self.assertIn("http://127.0.0.1:8080/u/tok-reply", msg["List-Unsubscribe"])
        self.assertEqual(msg["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click")
        text = msg.get_body(("plain",)).get_content()
        html_body = msg.get_body(("html",)).get_content()
        self.assertIn("Tuesday 10am works", text)
        self.assertIn("12 Test Street, Testville, CA 90000, USA", text)  # mandatory footer
        self.assertIn("Harbor Growth Agency", text)
        self.assertIn("Don't want these emails? Unsubscribe: http://127.0.0.1:8080/u/tok-reply", text)
        self.assertIn("http://127.0.0.1:8080/u/tok-reply", html_body)
        self.assertNotIn("<img", html_body.lower())

        # Saved in the unibox as an outbound 'sent' message.
        row = self.conn.execute(
            "SELECT * FROM messages WHERE lead_id=? AND direction='out' ORDER BY id DESC LIMIT 1",
            (ids["lead_id"],)).fetchone()
        self.assertEqual(row["kind"], "sent")
        self.assertEqual(row["body"], "Sure, Tuesday 10am works.\n\nSam")
        self.assertEqual(row["subject"], "Re: Hello there")
        self.assertEqual(row["message_id"], payload["message_id"])
        self.assertEqual(row["mailbox_id"], ids["mailbox_a"])
        self.assertEqual(row["is_read"], 1)

        thread = self.api("get", f"/api/threads/{ids['lead_id']}").get_json()
        self.assertEqual([m["direction"] for m in thread["messages"]], ["out", "in", "out"])
        self.assertEqual(thread["messages"][-1]["body"], "Sure, Tuesday 10am works.\n\nSam")

        # It is not a sequence step: the lead is untouched, and no cap is bypassed.
        after = self.lead_row(ids["lead_id"])
        self.assertEqual((after["status"], after["current_step"], after["last_sent_at"]),
                         (before["status"], before["current_step"], before["last_sent_at"]))
        send = self.conn.execute("SELECT * FROM sends WHERE lead_id=?", (ids["lead_id"],)).fetchone()
        self.assertEqual((send["step_pos"], send["status"], send["mailbox_id"]),
                         (0, "sent", ids["mailbox_a"]))
        self.assertEqual(core.today_sent(self.conn, ids["mailbox_a"]), 1)
        self.assertEqual(payload["remaining_capacity"], 9)

    def test_explicit_mailbox_overrides_the_sending_mailbox(self):
        ids = self.seed_reply_thread()
        r = self.reply(ids["lead_id"], mailbox_id=ids["mailbox_b"])
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.handler.messages[-1]["from"], "b@agency.test")
        row = self.conn.execute("SELECT * FROM messages WHERE lead_id=? AND direction='out' "
                                "ORDER BY id DESC LIMIT 1", (ids["lead_id"],)).fetchone()
        self.assertEqual(row["mailbox_id"], ids["mailbox_b"])

    def test_refuses_suppressed_unsubscribed_and_bounced(self):
        for status in ("suppressed", "unsubscribed", "bounced"):
            ids = self.seed_reply_thread(status=status)
            r = self.reply(ids["lead_id"])
            self.assertEqual(r.status_code, 409, status)
            self.assertIn("suppressed, unsubscribed or bounced", r.get_json()["error"])
        # A suppressed address is refused even when the lead status still looks active.
        ids = self.seed_reply_thread(suppress=True)
        self.assertEqual(self.reply(ids["lead_id"]).status_code, 409)
        self.assertEqual(self.handler.messages, [])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM messages WHERE direction='out' AND lead_id=?",
                                           (ids["lead_id"],)).fetchone()[0], 1)  # only the seeded send

    def test_daily_cap_exceeded_returns_429(self):
        ids = self.seed_reply_thread(cap=1)
        now = core.ts(core.utcnow())
        self.conn.execute(
            "INSERT INTO sends(campaign_id, lead_id, step_pos, mailbox_id, recipient, recipient_domain, "
            "message_id, sent_at, status, attempt) VALUES(?,?,1,?,?,?,?,?,'sent',1)",
            (ids["campaign_id"], ids["lead_id"], ids["mailbox_a"], "lead1@example.test", "example.test",
             "<prior@agency.test>", now))
        before = self.conn.execute("SELECT COUNT(*) FROM messages WHERE direction='out' AND lead_id=?",
                                   (ids["lead_id"],)).fetchone()[0]
        r = self.reply(ids["lead_id"])
        self.assertEqual(r.status_code, 429)
        self.assertIn("daily cap", r.get_json()["error"])
        self.assertEqual(self.handler.messages, [])
        after = self.conn.execute("SELECT COUNT(*) FROM messages WHERE direction='out' AND lead_id=?",
                                  (ids["lead_id"],)).fetchone()[0]
        self.assertEqual(after, before)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM sends WHERE lead_id=?",
                                           (ids["lead_id"],)).fetchone()[0], 1)

    def test_bad_request_and_not_found(self):
        ids = self.seed_reply_thread()
        self.assertEqual(self.api("post", f"/api/threads/{ids['lead_id']}/reply", json={}).status_code, 400)
        self.assertEqual(self.api("post", f"/api/threads/{ids['lead_id']}/reply",
                                  json={"body": "   "}).status_code, 400)
        self.assertEqual(self.api("post", f"/api/threads/{ids['lead_id']}/reply",
                                  json={"body": 42}).status_code, 400)
        self.assertEqual(self.reply(ids["lead_id"], mailbox_id="nope").status_code, 400)
        self.assertEqual(self.reply(ids["lead_id"], mailbox_id=9999).status_code, 404)
        self.assertEqual(self.reply(9999).status_code, 404)

        # Nothing has ever been sent to this lead and it has no mailbox: nothing to send from.
        now = core.ts(core.utcnow())
        cur = self.conn.execute("INSERT INTO campaigns(name, created_at) VALUES('empty', ?)", (now,))
        cur = self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, unsub_token, updated_at) "
            "VALUES(?,?,'{}','replied',?,?)", (cur.lastrowid, "fresh@example.test", "tok-fresh", now))
        r = self.reply(cur.lastrowid)
        self.assertEqual(r.status_code, 400)
        self.assertIn("mailbox_id", r.get_json()["error"])

    def test_paused_mailbox_is_refused(self):
        ids = self.seed_reply_thread()
        self.conn.execute("UPDATE mailboxes SET paused_reason='paused by hand' WHERE id=?", (ids["mailbox_a"],))
        r = self.reply(ids["lead_id"])
        self.assertEqual(r.status_code, 400)
        self.assertIn("paused", r.get_json()["error"])
        self.assertEqual(self.handler.messages, [])

    def test_hard_bounce_suppresses_the_address(self):
        # 'active' is in core.STOP_FROM['bounced'], so the same stop rule the worker uses applies here.
        ids = self.seed_reply_thread(email_addr="bounce1@example.test", status="active")
        r = self.reply(ids["lead_id"])
        self.assertEqual(r.status_code, 502)
        self.assertTrue(core.is_suppressed(self.conn, "bounce1@example.test"))
        self.assertEqual(self.lead_row(ids["lead_id"])["status"], "bounced")
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM messages WHERE lead_id=? AND direction='out'",
                                           (ids["lead_id"],)).fetchone()[0], 1)  # only the seeded send
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM sends WHERE lead_id=?",
                                           (ids["lead_id"],)).fetchone()[0], 0)  # nothing was accepted


if __name__ == "__main__":
    unittest.main()
