"""
Decides whether it's a good time to post right now.
Called every hour by launchd. Exits 0 if we should post, 1 if not.
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from analytics import best_posting_hours

CONFIG_PATH = Path(__file__).parent / "config.json"


def _load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def hours_since_last_post(history: list) -> float:
    if not history:
        return 9999.0
    last = max(history, key=lambda p: p["posted_at"])
    delta = datetime.utcnow() - datetime.fromisoformat(last["posted_at"])
    return delta.total_seconds() / 3600


def posts_today(history: list) -> int:
    today = datetime.utcnow().date()
    return sum(
        1 for p in history
        if datetime.fromisoformat(p["posted_at"]).date() == today
    )


def should_post_now() -> bool:
    config = _load_config()
    now = datetime.utcnow()
    current_hour = now.hour
    current_day = now.strftime("%a").lower()

    history = config["history"]
    min_gap = config["scheduling"]["min_hours_between_posts"]
    max_daily = config["account"]["max_posts_per_day"]

    if hours_since_last_post(history) < min_gap:
        return False

    if posts_today(history) >= max_daily:
        return False

    top_slots = best_posting_hours(config, top_n=5)

    for slot in top_slots:
        slot_day = slot["day"]
        slot_hour = slot["hour"]
        if slot_day != "*" and slot_day != current_day:
            continue
        # Allow a 1-hour window around the target slot
        if abs(slot_hour - current_hour) <= 1:
            return True

    return False


if __name__ == "__main__":
    if should_post_now():
        print("POST_NOW")
        sys.exit(0)
    else:
        print("SKIP")
        sys.exit(1)
