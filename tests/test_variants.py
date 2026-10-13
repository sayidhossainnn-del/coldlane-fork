"""A/B step variant tests: schema migration, weighted selection, sticky assignment,
threading from the subject actually sent, and the /api variant endpoints.

Run: python -m unittest discover -s tests
"""
import datetime as dt
import os
import random
import socket
import sqlite3
import sys
import tempfile
import unittest
import uuid
from email import message_from_bytes, policy

from cryptography.fernet import Fernet

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aiosmtpd.controller import Controller  # noqa: E402

from coldlane import core, crypto, db, engine  # noqa: E402

API_KEY = "test-api-key"
WEDNESDAY = dt.datetime(2026, 10, 7, 15, 0, tzinfo=dt.timezone.utc)  # inside the 9-17 UTC window


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class SmtpHandler:
    """Records what was sent; 451s anything addressed to tempfail*."""

    def __init__(self):
        self.messages = []

    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        if address.startswith("tempfail"):
            return "451 4.3.0 Try again later"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        self.messages.append({"from": envelope.mail_from, "to": list(envelope.rcpt_tos),
                              "raw": envelope.content})
        return "250 Message accepted"


class TestVariantMigration(unittest.TestCase):
    """init_db() must upgrade a database created before A/B existed, without data loss."""

    LEGACY = """
        CREATE TABLE steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, position INTEGER NOT NULL,
            subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', delay_minutes INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE sends (
            id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, lead_id INTEGER NOT NULL,
            step_id INTEGER, step_pos INTEGER NOT NULL, mailbox_id INTEGER NOT NULL, recipient TEXT NOT NULL,
            recipient_domain TEXT NOT NULL, message_id TEXT, sent_at TEXT NOT NULL, status TEXT NOT NULL,
            smtp_result TEXT, attempt INTEGER NOT NULL DEFAULT 1, subject TEXT, body TEXT);
        INSERT INTO steps(campaign_id, position, subject, body, delay_minutes)
            VALUES(1, 1, 'Old subject', 'Old body', 0);
        INSERT INTO sends(campaign_id, lead_id, step_pos, mailbox_id, recipient, recipient_domain, sent_at,
                          status, attempt, subject, body)
            VALUES(1, 1, 1, 1, 'old@example.test', 'example.test', '2026-01-01 00:00:00', 'sent', 1,
                   'Old subject', 'Old body');
    """

    def test_migration_on_existing_db_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "legacy.db")
            legacy = sqlite3.connect(path)
            legacy.executescript(self.LEGACY)
            legacy.commit()
            legacy.close()

            db.init_db(path)  # upgrade
            db.init_db(path)  # and again: must be a no-op

            conn = db.connect(path)
            try:
                steps_cols = {row["name"] for row in conn.execute("PRAGMA table_info(steps)")}
                sends_cols = {row["name"] for row in conn.execute("PRAGMA table_info(sends)")}
                tables = {row["name"] for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'")}
                self.assertIn("weight", steps_cols)
                self.assertIn("variant_id", sends_cols)
                self.assertTrue({"step_variants", "lead_step_variant"} <= tables)

                step = conn.execute("SELECT * FROM steps").fetchone()
                self.assertEqual((step["subject"], step["body"], step["weight"]), ("Old subject", "Old body", 100))
                send = conn.execute("SELECT * FROM sends").fetchone()
                self.assertEqual(send["subject"], "Old subject")
                self.assertIsNone(send["variant_id"])
                # New tables are usable straight away.
                cur = conn.execute("INSERT INTO step_variants(step_id, label, subject, body, weight, enabled, "
                                   "created_at) VALUES(?,?,?,?,?,?,?)",
                                   (step["id"], "B", "s", "b", 100, 1, "2026-01-01 00:00:00"))
                conn.execute("INSERT INTO lead_step_variant(lead_id, step_id, variant_id) VALUES(1,?,?)",
                             (step["id"], cur.lastrowid))
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM lead_step_variant").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM steps").fetchone()[0], 1)
                self.assertEqual(conn.execute("SELECT COUNT(*) FROM sends").fetchone()[0], 1)
            finally:
                conn.close()


class VariantBase(unittest.TestCase):
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
        self.tmp = tempfile.TemporaryDirectory()
        self.env_backup = dict(os.environ)
        os.environ.update({
            "DATABASE_PATH": os.path.join(self.tmp.name, "variants.db"),
            "ENCRYPTION_KEY": Fernet.generate_key().decode(),
            "SECRET_KEY": "test-secret",
            "OWNER_PASSWORD": "testpass",
            "PUBLIC_BASE_URL": "http://127.0.0.1:8080",
            "SENDER_BUSINESS_NAME": "Harbor Growth Agency",
            "SENDER_ADDRESS": "12 Test Street, Testville, CA 90000, USA",
            "MIN_GAP_SECONDS": "0",
            "MAX_GAP_SECONDS": "0",
            "RECIPIENT_DOMAIN_PER_HOUR": "100",
            "API_KEY": API_KEY,
        })
        crypto.reset_cache()
        db.init_db()
        self.conn = db.connect()
        self.handler.messages.clear()
        self.now = WEDNESDAY

    def tearDown(self):
        self.conn.close()
        os.environ.clear()
        os.environ.update(self.env_backup)
        crypto.reset_cache()
        self.tmp.cleanup()

    # ---------------------------------------------------------------- helpers
    def seed_mailbox(self, cap=50):
        now = core.ts(core.utcnow())
        cur = self.conn.execute(
            "INSERT INTO mailboxes(label, from_name, from_email, smtp_host, smtp_port, smtp_security, daily_cap, "
            "ramp_enabled, active, created_at) VALUES('A','Sam Sender','a@agency.test','127.0.0.1',?,'none',?,0,1,?)",
            (self.port, cap, now))
        return cur.lastrowid

    def seed_campaign(self, mailbox_id, steps, status="active"):
        now = core.ts(core.utcnow())
        cur = self.conn.execute("INSERT INTO campaigns(name, status, created_at) VALUES('Variants', ?, ?)",
                                (status, now))
        campaign_id = cur.lastrowid
        self.conn.execute("INSERT INTO campaign_mailboxes(campaign_id, mailbox_id) VALUES(?,?)",
                          (campaign_id, mailbox_id))
        step_ids = []
        for position, (subject, body, delay) in enumerate(steps, 1):
            cur = self.conn.execute(
                "INSERT INTO steps(campaign_id, position, subject, body, delay_minutes) VALUES(?,?,?,?,?)",
                (campaign_id, position, subject, body, delay))
            step_ids.append(cur.lastrowid)
        return campaign_id, step_ids

    def add_lead(self, campaign_id, email_addr, fields=None, status="queued"):
        now = core.ts(core.utcnow())
        cur = self.conn.execute(
            "INSERT INTO leads(campaign_id, email, fields_json, status, unsub_token, updated_at) "
            "VALUES(?,?,?,?,?,?)",
            (campaign_id, email_addr, _json(fields or {}), status, f"tok-{uuid.uuid4().hex}", now))
        return cur.lastrowid

    def add_variant(self, step_id, label, subject, body, weight=100, enabled=1):
        cur = self.conn.execute(
            "INSERT INTO step_variants(step_id, label, subject, body, weight, enabled, created_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (step_id, label, subject, body, weight, enabled, core.ts(core.utcnow())))
        return cur.lastrowid

    def add_send(self, campaign_id, lead_id, step_id, step_pos, variant_id, at, status="sent", mailbox_id=1,
                 subject="s", body="b"):
        self.conn.execute(
            "INSERT INTO sends(campaign_id, lead_id, step_id, step_pos, mailbox_id, recipient, recipient_domain, "
            "message_id, sent_at, status, smtp_result, attempt, subject, body, variant_id) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)",
            (campaign_id, lead_id, step_id, step_pos, mailbox_id, "lead@example.test", "example.test",
             f"<m{uuid.uuid4().hex[:6]}@agency.test>", core.ts(at), status, "250 OK", subject, body, variant_id))

    def lead_row(self, lead_id):
        return self.conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()


def _json(payload):
    import json
    return json.dumps(payload)


class TestVariantSelection(VariantBase):
    def setUp(self):
        super().setUp()
        self.mailbox = self.seed_mailbox()
        self.campaign_id, self.step_ids = self.seed_campaign(
            self.mailbox, [("Base subject {{company}}", "Base body", 0)])
        self.step = self.conn.execute("SELECT * FROM steps WHERE id=?", (self.step_ids[0],)).fetchone()

    def test_pick_weighted_distribution_with_a_seeded_rng(self):
        pool = [{"id": 1, "label": "A", "weight": 90}, {"id": 2, "label": "B", "weight": 10}]
        rng = random.Random(2026)
        picks = [core.pick_weighted(pool, rng)["id"] for _ in range(4000)]
        self.assertGreater(picks.count(1), picks.count(2))
        self.assertAlmostEqual(picks.count(1) / 4000, 0.9, delta=0.03)
        # Same seed, same sequence.
        self.assertEqual(picks[:5], [core.pick_weighted(pool, random.Random(2026))["id"] for _ in range(5)])
        # Edge cases: a single arm and all-zero weights stay deterministic.
        self.assertEqual(core.pick_weighted([{"id": 7, "weight": 0}])["id"], 7)
        self.assertEqual(core.pick_weighted([{"id": 1, "weight": 0}, {"id": 2, "weight": 0}])["id"], 1)

    def test_no_variants_means_base_content_and_no_assignment(self):
        self.assertEqual(core.variant_pool(self.conn, self.step), [])
        lead = self.add_lead(self.campaign_id, "plain@example.test")
        self.assertIsNone(engine.resolve_variant(self.conn, self.lead_row(lead), self.step))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM lead_step_variant").fetchone()[0], 0)
        # Even a disabled variant keeps the step on its base content.
        self.add_variant(self.step["id"], "B", "B subject", "B body", enabled=0)
        self.assertEqual([arm["label"] for arm in core.variant_pool(self.conn, self.step)], [])
        self.assertIsNone(engine.resolve_variant(self.conn, self.lead_row(lead), self.step))

    def test_weighted_assignment_is_persisted_and_sticky(self):
        self.add_variant(self.step["id"], "B", "B subject", "B body", weight=100)
        lead = self.add_lead(self.campaign_id, "sticky@example.test")
        row = self.lead_row(lead)
        first = engine.resolve_variant(self.conn, row, self.step, random.Random(4))
        stored = core.assigned_variant(self.conn, lead, self.step["id"])
        self.assertIsNotNone(stored)
        self.assertEqual(stored["variant_id"], first["id"] if first is not None else None)
        # Every later attempt reuses the stored arm, even with a different rng.
        for _ in range(5):
            again = engine.resolve_variant(self.conn, self.lead_row(lead), self.step, random.Random(99))
            self.assertEqual(again["id"] if again is not None else None, stored["variant_id"])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM lead_step_variant").fetchone()[0], 1)

    def test_disabled_variants_are_never_newly_assigned(self):
        # The pool is base 'A' + enabled 'B' only: the disabled 'C' must never be picked.
        variant_b = self.add_variant(self.step["id"], "B", "B subject", "B body", weight=0, enabled=1)
        variant_c = self.add_variant(self.step["id"], "C", "C subject", "C body", enabled=0)
        self.assertEqual([arm["label"] for arm in core.variant_pool(self.conn, self.step)], ["A", "B"])
        for i in range(15):
            lead = self.add_lead(self.campaign_id, f"lead{i}@example.test")
            chosen = engine.resolve_variant(self.conn, self.lead_row(lead), self.step, random.Random(i))
            self.assertIsNone(chosen)  # weight 0 on B, so every lead lands on base 'A'
        rows = self.conn.execute("SELECT * FROM lead_step_variant").fetchall()
        self.assertEqual(len(rows), 15)
        self.assertTrue(all(row["variant_id"] is None for row in rows))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM lead_step_variant WHERE variant_id IN (?,?)",
                                           (variant_b, variant_c)).fetchone()[0], 0)
        # With no enabled variants at all the step simply stays on its base content.
        self.conn.execute("UPDATE step_variants SET enabled=0 WHERE id=?", (variant_b,))
        self.assertEqual(core.variant_pool(self.conn, self.step), [])
        other = self.add_lead(self.campaign_id, "noarms@example.test")
        self.assertIsNone(engine.resolve_variant(self.conn, self.lead_row(other), self.step, random.Random(0)))

    def test_disabled_but_already_assigned_variant_is_reused(self):
        variant_b = self.add_variant(self.step["id"], "B", "B subject", "B body", enabled=0)
        lead = self.add_lead(self.campaign_id, "legacy@example.test")
        core.assign_variant(self.conn, lead, self.step["id"], variant_b)
        chosen = engine.resolve_variant(self.conn, self.lead_row(lead), self.step, random.Random(1))
        self.assertIsNotNone(chosen)
        self.assertEqual(chosen["id"], variant_b)
        # Re-enabling a variant makes it assignable again.
        self.conn.execute("UPDATE step_variants SET enabled=1 WHERE id=?", (variant_b,))
        pool = core.variant_pool(self.conn, self.step)
        self.assertEqual([arm["label"] for arm in pool], ["A", "B"])
        self.assertEqual([arm["weight"] for arm in pool], [100, 100])

    def test_deleted_variant_falls_back_to_a_fresh_pick(self):
        variant_b = self.add_variant(self.step["id"], "B", "B subject", "B body")
        lead = self.add_lead(self.campaign_id, "gone@example.test")
        core.assign_variant(self.conn, lead, self.step["id"], variant_b)
        self.conn.execute("DELETE FROM step_variants WHERE id=?", (variant_b,))
        chosen = engine.resolve_variant(self.conn, self.lead_row(lead), self.step, random.Random(2))
        self.assertIsNone(chosen)  # falls back to base 'A'
        self.assertIsNone(core.assigned_variant(self.conn, lead, self.step["id"])["variant_id"])


class TestVariantSending(VariantBase):
    def test_variant_content_is_rendered_and_recorded_on_the_send(self):
        mailbox = self.seed_mailbox()
        campaign_id, (step_id,) = self.seed_campaign(
            mailbox, [("Base {{company}}", "Base body", 0)])
        variant_b = self.add_variant(step_id, "B", "Variant B {{company}}", "Variant body")
        on_b = self.add_lead(campaign_id, "b@example.test", {"company": "Brightline"})
        on_base = self.add_lead(campaign_id, "base@example.test", {"company": "Brightline"})
        core.assign_variant(self.conn, on_b, step_id, variant_b)
        core.assign_variant(self.conn, on_base, step_id, None)

        engine.send_pass(self.conn, self.now, random.Random(3))
        by_recipient = {msg["to"][0]: message_from_bytes(msg["raw"], policy=policy.default)
                        for msg in self.handler.messages}
        self.assertEqual(by_recipient["b@example.test"]["Subject"], "Variant B Brightline")
        self.assertIn("Variant body", by_recipient["b@example.test"].get_body(("plain",)).get_content())
        self.assertEqual(by_recipient["base@example.test"]["Subject"], "Base Brightline")
        self.assertIn("Base body", by_recipient["base@example.test"].get_body(("plain",)).get_content())

        rows = {row["recipient"]: row for row in
                self.conn.execute("SELECT * FROM sends WHERE campaign_id=?", (campaign_id,))}
        self.assertEqual(rows["b@example.test"]["variant_id"], variant_b)
        self.assertEqual(rows["b@example.test"]["subject"], "Variant B Brightline")
        self.assertEqual(rows["b@example.test"]["body"], "Variant body")
        self.assertIsNone(rows["base@example.test"]["variant_id"])
        stored = self.conn.execute("SELECT * FROM messages WHERE lead_id=? AND direction='out'",
                                   (on_b,)).fetchone()
        self.assertEqual(stored["subject"], "Variant B Brightline")
        self.assertEqual(stored["body"], "Variant body")

    def test_retry_reuses_the_assigned_variant_even_when_disabled(self):
        mailbox = self.seed_mailbox()
        campaign_id, (step_id,) = self.seed_campaign(mailbox, [("Hello", "Body A", 0)])
        variant_b = self.add_variant(step_id, "B", "Subject B", "Body B")
        lead = self.add_lead(campaign_id, "tempfail1@example.test", {"company": "X"})
        core.assign_variant(self.conn, lead, step_id, variant_b)
        self.conn.execute("UPDATE step_variants SET enabled=0 WHERE id=?", (variant_b,))  # now disabled

        engine.send_pass(self.conn, self.now, random.Random(5))
        first = self.conn.execute("SELECT * FROM sends WHERE lead_id=? ORDER BY id DESC", (lead,)).fetchone()
        self.assertEqual(first["variant_id"], variant_b)
        self.assertEqual(first["status"], "retry")
        self.assertEqual(core.assigned_variant(self.conn, lead, step_id)["variant_id"], variant_b)

        engine.send_pass(self.conn, self.now + dt.timedelta(minutes=5), random.Random(6))
        rows = self.conn.execute("SELECT * FROM sends WHERE lead_id=? ORDER BY id", (lead,)).fetchall()
        self.assertEqual(len(rows), 2)
        self.assertEqual({row["variant_id"] for row in rows}, {variant_b})  # same arm both times
        self.assertTrue(all(row["status"] == "retry" for row in rows))
        self.assertEqual(self.handler.messages, [])

    def test_engine_persists_the_weighted_pick_for_the_base_arm_too(self):
        mailbox = self.seed_mailbox()
        campaign_id, (step_id,) = self.seed_campaign(mailbox, [("Base {{company}}", "Base body", 0)])
        variant_b = self.add_variant(step_id, "B", "B {{company}}", "B body", weight=100)
        self.conn.execute("UPDATE steps SET weight=? WHERE id=?", (1, step_id))  # 1:100 towards B
        leads = [self.add_lead(campaign_id, f"pick{i}@example.test", {"company": "Z"}) for i in range(6)]
        engine.send_pass(self.conn, self.now, random.Random(11))
        assignments = {row["lead_id"]: row["variant_id"] for row in
                       self.conn.execute("SELECT * FROM lead_step_variant")}
        self.assertEqual(set(assignments), set(leads))
        self.assertTrue(all(assignments[lead] == variant_b for lead in leads))
        sent = self.conn.execute("SELECT COUNT(*) FROM sends WHERE status='sent'").fetchone()[0]
        self.assertEqual(sent, 6)

    def test_merge_error_in_a_variant_skips_the_lead(self):
        mailbox = self.seed_mailbox()
        campaign_id, (step_id,) = self.seed_campaign(mailbox, [("Base", "Base body", 0)])
        variant_b = self.add_variant(step_id, "B", "Hi {{company}}", "About {{company}}")
        bad = self.add_lead(campaign_id, "missing@example.test", {})  # no company, no fallback
        good = self.add_lead(campaign_id, "fine@example.test", {"company": "Acme"})
        core.assign_variant(self.conn, bad, step_id, variant_b)
        core.assign_variant(self.conn, good, step_id, None)
        engine.send_pass(self.conn, self.now, random.Random(7))
        self.assertEqual(self.lead_row(bad)["status"], "merge_error")
        self.assertEqual([m["to"][0] for m in self.handler.messages], ["fine@example.test"])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM sends WHERE lead_id=?", (bad,)).fetchone()[0], 0)
        self.assertEqual(self.conn.execute(
            "SELECT COUNT(*) FROM events WHERE lead_id=? AND kind='merge_error'", (bad,)).fetchone()[0], 1)

    def test_followup_threads_from_the_subject_that_was_actually_sent(self):
        mailbox = self.seed_mailbox()
        campaign_id, (step1, step2) = self.seed_campaign(
            mailbox, [("Base subject", "Base body", 0), ("", "Just bumping this.", 0)])
        variant_b = self.add_variant(step1, "B", "Variant subject", "Variant body")
        lead = self.add_lead(campaign_id, "thread@example.test", {})
        core.assign_variant(self.conn, lead, step1, variant_b)

        engine.send_pass(self.conn, self.now, random.Random(8))
        first = message_from_bytes(self.handler.messages[0]["raw"], policy=policy.default)
        self.assertEqual(first["Subject"], "Variant subject")
        stored = self.conn.execute("SELECT subject FROM sends WHERE lead_id=? AND step_id=?", (lead, step1)).fetchone()
        self.assertEqual(stored["subject"], "Variant subject")

        engine.send_pass(self.conn, self.now + dt.timedelta(minutes=1), random.Random(9))
        follow = [message_from_bytes(m["raw"], policy=policy.default)
                  for m in self.handler.messages if message_from_bytes(m["raw"], policy=policy.default)
                  .get("In-Reply-To") == first["Message-ID"]]
        self.assertEqual(len(follow), 1)
        # "Re: <what the lead received>", not the step's base subject.
        self.assertEqual(follow[0]["Subject"], "Re: Variant subject")
        self.assertNotIn("Base subject", follow[0]["Subject"])
        self.assertEqual(follow[0]["In-Reply-To"], first["Message-ID"])
        self.assertIn(first["Message-ID"], follow[0]["References"])


class ApiVariantBase(VariantBase):
    def setUp(self):
        super().setUp()
        from coldlane.web import create_app
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def api(self, method, path, key=API_KEY, **kwargs):
        headers = dict(kwargs.pop("headers", {}))
        if key is not None:
            headers["X-API-Key"] = key
        return getattr(self.client, method)(path, headers=headers, **kwargs)


class TestVariantApi(ApiVariantBase):
    def seed_draft(self, steps=(("Base subject", "Base body", 0),)):
        mailbox = self.seed_mailbox()
        campaign_id, step_ids = self.seed_campaign(mailbox, list(steps), status="draft")
        return campaign_id, step_ids

    def arms(self, campaign_id, position=1):
        steps = self.api("get", f"/api/campaigns/{campaign_id}/steps").get_json()["steps"]
        return next(step for step in steps if step["position"] == position)["variants"]

    def test_steps_endpoint_includes_variants(self):
        campaign_id, _ = self.seed_draft()
        arms = self.arms(campaign_id)
        self.assertEqual([arm["label"] for arm in arms], ["A"])
        self.assertIsNone(arms[0]["id"])
        self.assertEqual((arms[0]["subject"], arms[0]["weight"], arms[0]["enabled"]), ("Base subject", 100, 1))
        self.assertFalse(arms[0]["locked"])

        r = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                     json={"subject": "B subject", "body": "B body", "weight": 40})
        self.assertEqual(r.status_code, 201, r.data)
        created = r.get_json()["variant"]
        self.assertEqual((created["label"], created["weight"], created["enabled"]), ("B", 40, 1))
        self.assertFalse(created["locked"])
        r = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants", json={"subject": "", "body": "third"})
        self.assertEqual(r.get_json()["variant"]["label"], "C")
        self.assertEqual([arm["label"] for arm in self.arms(campaign_id)], ["A", "B", "C"])

        # The campaign detail carries the arms too.
        detail = self.api("get", f"/api/campaigns/{campaign_id}").get_json()
        self.assertEqual([arm["label"] for arm in detail["steps"][0]["variants"]], ["A", "B", "C"])

    def test_variant_validation_and_campaign_state(self):
        campaign_id, _ = self.seed_draft()
        for payload, expected in (({"subject": "s"}, "body is required"),
                                  ({"body": "b", "weight": 0}, "between 1 and 100"),
                                  ({"body": "b", "weight": 101}, "between 1 and 100"),
                                  ({"body": "Hi {{company", "weight": 5}, "unbalanced")):
            r = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants", json=payload)
            self.assertEqual(r.status_code, 400, expected)
            self.assertIn(expected, " ".join(r.get_json()["details"]))
        self.assertEqual(self.api("post", f"/api/campaigns/{campaign_id}/steps/9/variants",
                                  json={"body": "b"}).status_code, 404)
        self.assertEqual(self.api("post", "/api/campaigns/999/steps/1/variants",
                                  json={"body": "b"}).status_code, 404)

        # Only drafts and paused campaigns accept edits.
        self.conn.execute("UPDATE campaigns SET status='active' WHERE id=?", (campaign_id,))
        r = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants", json={"body": "b"})
        self.assertEqual(r.status_code, 409)
        self.conn.execute("UPDATE campaigns SET status='paused' WHERE id=?", (campaign_id,))
        self.assertEqual(self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                                  json={"body": "b"}).status_code, 201)

    def test_variant_content_locks_after_it_has_sends(self):
        campaign_id, step_ids = self.seed_draft()
        variant_id = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                              json={"subject": "B", "body": "B body"}).get_json()["variant"]["id"]
        self.assertFalse(self.arms(campaign_id)[1]["locked"])

        lead = self.add_lead(campaign_id, "used@example.test")
        self.add_send(campaign_id, lead, step_ids[0], 1, variant_id, self.now)
        self.assertTrue(self.arms(campaign_id)[1]["locked"])

        r = self.api("put", f"/api/variants/{variant_id}", json={"body": "rewritten"})
        self.assertEqual(r.status_code, 409)
        self.assertIn("Create a new variant instead", r.get_json()["error"])
        self.assertEqual(self.conn.execute("SELECT body FROM step_variants WHERE id=?",
                                           (variant_id,)).fetchone()[0], "B body")
        # Weight and enabled are always editable.
        r = self.api("put", f"/api/variants/{variant_id}", json={"weight": 25, "enabled": False})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.get_json()["variant"]["weight"], r.get_json()["variant"]["enabled"]), (25, 0))
        self.assertTrue(r.get_json()["variant"]["locked"])

    def test_variant_delete_disables_when_already_sent(self):
        campaign_id, step_ids = self.seed_draft()
        unused = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                          json={"body": "unused"}).get_json()["variant"]["id"]
        used = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                        json={"body": "used"}).get_json()["variant"]["id"]
        lead = self.add_lead(campaign_id, "used@example.test")
        self.add_send(campaign_id, lead, step_ids[0], 1, used, self.now)

        r = self.api("delete", f"/api/variants/{unused}")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.get_json()["deleted"])
        self.assertIsNone(self.conn.execute("SELECT 1 FROM step_variants WHERE id=?", (unused,)).fetchone())

        r = self.api("delete", f"/api/variants/{used}")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.get_json()["deleted"])
        self.assertTrue(r.get_json()["disabled"])
        row = self.conn.execute("SELECT * FROM step_variants WHERE id=?", (used,)).fetchone()
        self.assertEqual(row["enabled"], 0)  # kept so its results stay reportable
        self.assertEqual(self.api("delete", "/api/variants/999").status_code, 404)

    def test_weights_endpoint_sets_several_arms_at_once(self):
        campaign_id, step_ids = self.seed_draft()
        variant_b = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                             json={"body": "B body"}).get_json()["variant"]["id"]
        r = self.api("put", f"/api/campaigns/{campaign_id}/steps/1/weights", json={"weights": {"A": 50, "B": 50}})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([arm["weight"] for arm in r.get_json()["variants"]], [50, 50])
        step = self.conn.execute("SELECT * FROM steps WHERE id=?", (step_ids[0],)).fetchone()
        self.assertEqual(step["weight"], 50)
        self.assertEqual(self.conn.execute("SELECT weight FROM step_variants WHERE id=?",
                                           (variant_b,)).fetchone()[0], 50)

        bad = self.api("put", f"/api/campaigns/{campaign_id}/steps/1/weights",
                       json={"weights": {"A": 50, "Z": 50}})
        self.assertEqual(bad.status_code, 400)
        self.assertIn("Unknown variant label 'Z'", " ".join(bad.get_json()["details"]))
        self.assertEqual(self.api("put", f"/api/campaigns/{campaign_id}/steps/1/weights",
                                  json={"weights": {"A": 0}}).status_code, 400)
        self.assertEqual(self.api("put", f"/api/campaigns/{campaign_id}/steps/1/weights",
                                  json={"weights": {}}).status_code, 400)
        # Weights apply to the base arm even before any variant exists.
        campaign_two, _ = self.seed_draft()
        r = self.api("put", f"/api/campaigns/{campaign_two}/steps/1/weights", json={"weights": {"a": 42}})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["variants"][0]["weight"], 42)
        self.conn.execute("UPDATE campaigns SET status='active' WHERE id=?", (campaign_id,))
        self.assertEqual(self.api("put", f"/api/campaigns/{campaign_id}/steps/1/weights",
                                  json={"weights": {"A": 10}}).status_code, 409)

    def test_variant_stats_and_reply_attribution(self):
        campaign_id, (step1, step2) = self.seed_draft(steps=[("Step one", "one", 0), ("", "two", 0)])
        variant_b = self.add_variant(step1, "B", "B subject", "B body")
        day = dt.datetime(2026, 10, 7, 10, 0, tzinfo=dt.timezone.utc)
        replied_a = self.add_lead(campaign_id, "a@example.test", status="replied")
        replied_b = self.add_lead(campaign_id, "b@example.test", status="replied")
        unsubbed = self.add_lead(campaign_id, "c@example.test", status="unsubscribed")
        never_sent = self.add_lead(campaign_id, "d@example.test", status="replied")

        self.add_send(campaign_id, replied_a, step1, 1, None, day)
        self.add_send(campaign_id, replied_b, step1, 1, variant_b, day)
        self.add_send(campaign_id, unsubbed, step1, 1, None, day)
        self.add_send(campaign_id, unsubbed, step2, 2, None, day + dt.timedelta(minutes=30))
        core.log_event(self.conn, "reply", "", replied_a, campaign_id, "a@example.test",
                       at=day + dt.timedelta(minutes=5))
        core.log_event(self.conn, "reply", "", replied_b, campaign_id, "b@example.test",
                       at=day + dt.timedelta(minutes=5))
        # This lead replied without any send in this campaign: nothing to attribute it to.
        core.log_event(self.conn, "reply", "", never_sent, campaign_id, "d@example.test",
                       at=day + dt.timedelta(minutes=5))
        core.log_event(self.conn, "unsubscribe", "", unsubbed, campaign_id, "c@example.test",
                       at=day + dt.timedelta(minutes=40))

        r = self.api("get", f"/api/campaigns/{campaign_id}/variants")
        self.assertEqual(r.status_code, 200, r.data)
        report = r.get_json()
        by_step = {step["position"]: step for step in report["steps"]}
        arms = {arm["label"]: arm for arm in by_step[1]["variants"]}
        self.assertEqual(arms["A"]["sent"], 2)
        self.assertEqual((arms["A"]["replied"], arms["A"]["bounced"], arms["A"]["unsubscribed"]), (1, 0, 0))
        self.assertEqual(arms["A"]["reply_rate"], 50.0)
        self.assertEqual(arms["B"]["sent"], 1)
        self.assertEqual((arms["B"]["replied"], arms["B"]["reply_rate"]), (1, 100.0))
        # Credited to the LAST send before the event (step 2), not the first one.
        step_two = {arm["label"]: arm for arm in by_step[2]["variants"]}
        self.assertEqual(step_two["A"]["sent"], 1)
        self.assertEqual(step_two["A"]["unsubscribed"], 1)
        self.assertEqual(step_two["A"]["replied"], 0)
        self.assertEqual(arms["A"]["unsubscribed"], 0)
        # Step 2 has no variants of its own, only the implicit base arm.
        self.assertEqual([arm["label"] for arm in by_step[2]["variants"]], ["A"])
        self.assertEqual(step_two["A"]["reply_rate"], 0.0)
        self.assertEqual(self.api("get", "/api/campaigns/999/variants").status_code, 404)

    def test_preview_accepts_a_variant_label(self):
        campaign_id, step_ids = self.seed_draft(steps=[("Base {{company}}", "Base body", 0)])
        variant_b = self.api("post", f"/api/campaigns/{campaign_id}/steps/1/variants",
                             json={"subject": "B {{company}}", "body": "B body"}).get_json()["variant"]["id"]
        lead = self.add_lead(campaign_id, "preview@example.test", {"company": "Brightline"})

        body = self.api("post", f"/api/campaigns/{campaign_id}/preview",
                        json={"lead_id": lead, "variant": "B"}).get_json()
        self.assertEqual((body["variant"], body["subject"], body["body"]),
                         ("B", "B Brightline", "B body"))
        self.assertIn("12 Test Street", body["text"])  # footer still added
        body = self.api("post", f"/api/campaigns/{campaign_id}/preview",
                        json={"lead_id": lead, "variant": "a"}).get_json()
        self.assertEqual((body["variant"], body["subject"], body["body"]),
                         ("A", "Base Brightline", "Base body"))
        r = self.api("post", f"/api/campaigns/{campaign_id}/preview", json={"lead_id": lead, "variant": "Z"})
        self.assertEqual(r.status_code, 404)

        # Without a label the preview shows this lead's assigned arm, else base 'A'.
        body = self.api("post", f"/api/campaigns/{campaign_id}/preview", json={"lead_id": lead}).get_json()
        self.assertEqual(body["variant"], "A")
        core.assign_variant(self.conn, lead, step_ids[0], variant_b)
        body = self.api("post", f"/api/campaigns/{campaign_id}/preview", json={"lead_id": lead}).get_json()
        self.assertEqual((body["variant"], body["subject"]), ("B", "B Brightline"))

    def test_variant_endpoints_require_the_api_key(self):
        campaign_id, step_ids = self.seed_draft()
        variant_id = self.add_variant(step_ids[0], "B", "B", "B body")
        for method, path, payload in (
                ("post", f"/api/campaigns/{campaign_id}/steps/1/variants", {"body": "b"}),
                ("put", f"/api/variants/{variant_id}", {"weight": 10}),
                ("delete", f"/api/variants/{variant_id}", None),
                ("put", f"/api/campaigns/{campaign_id}/steps/1/weights", {"weights": {"A": 10}}),
                ("get", f"/api/campaigns/{campaign_id}/variants", None)):
            r = self.api(method, path, key=None, **({"json": payload} if payload is not None else {}))
            self.assertEqual(r.status_code, 401, path)
        self.assertEqual(self.api("get", f"/api/campaigns/{campaign_id}/variants").status_code, 200)


if __name__ == "__main__":
    unittest.main()
