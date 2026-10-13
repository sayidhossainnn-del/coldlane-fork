"""Worker service: `python -m coldlane.worker`. Send loop + IMAP poll + heartbeat.

After each IMAP poll it also runs the optional AI auto-classifier (at most 5 unclassified
replies per tick, best effort). That step never raises, never blocks sending or polling,
and does nothing at all while the LLM is not enabled -- see ``coldlane/ai.py``.
"""
import signal
import sys
import time
import traceback

from . import ai, config, core, crypto, db, engine

_running = {"value": True}

# Settings key guarding the one-off `messages` backfill so it only ever runs once
# per database, even across worker restarts.
BACKFILL_SETTING_KEY = "messages_backfill_done"


def _stop(signum, frame):  # noqa: ARG001
    _running["value"] = False


def _run_backfill_once(conn):
    """Populate `messages` rows for historical `sends` on first startup after the
    unibox storage upgrade. Idempotent: guarded by a settings flag plus the
    (mailbox_id, message_id) unique index on `messages`, so it is always safe to
    call, even if the flag write races across multiple worker starts."""
    if db.get_setting(conn, BACKFILL_SETTING_KEY) == "1":
        return
    try:
        created = core.backfill_sent_messages(conn)
        db.set_setting(conn, BACKFILL_SETTING_KEY, "1")
        if created:
            print(f"ColdLane worker: backfilled {created} historical sent message(s) into the messages table.",
                  flush=True)
    except Exception:  # noqa: BLE001
        # Never block worker startup on a best-effort backfill; it will simply be
        # retried on the next restart since the settings flag was not written.
        traceback.print_exc()


def main():
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    db.init_db()
    crypto.get_key()
    if crypto.using_generated_key():
        print("WARNING: ENCRYPTION_KEY is not set; using an auto-generated key file next to the database. "
              "Set ENCRYPTION_KEY in .env for production.", flush=True)
    conn = db.connect()
    try:
        _run_backfill_once(conn)
    finally:
        conn.close()
    print(f"ColdLane worker started: tick={config.tick_seconds()}s imap_poll={config.imap_poll_seconds()}s "
          f"db={config.db_path()}", flush=True)
    while _running["value"]:
        started = time.monotonic()
        conn = db.connect()
        try:
            sent, polled = engine.tick(conn)
            classified = ai.auto_classify(conn)
            if sent or polled or classified:
                print(f"{core.ts(core.utcnow())} tick: sent={sent} imap_messages={polled} "
                      f"ai_classified={classified}", flush=True)
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        finally:
            conn.close()
        remaining = config.tick_seconds() - (time.monotonic() - started)
        while remaining > 0 and _running["value"]:
            time.sleep(min(1.0, remaining))
            remaining -= 1.0
    print("ColdLane worker stopped.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
