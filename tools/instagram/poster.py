"""
Main posting pipeline:
  1. Check schedule
  2. Export next photo from Apple Photos
  3. Upload to Instagram via Graph API (two-step: container → publish)
  4. Remove from Photos album
  5. Log to Alfred history + diary
  6. Collect any pending insights (48h-old posts)
"""

import json
import os
import sys
import tempfile
import requests
from datetime import datetime
from pathlib import Path

from photos_bridge import export_next_photo, remove_from_album, get_queue_count
from scheduler import should_post_now
from analytics import collect_pending_insights, growth_report

CONFIG_PATH = Path(__file__).parent / "config.json"
DIARY_PATH = Path(__file__).parent.parent.parent / "data" / "diary.md"
GRAPH_BASE = "https://graph.facebook.com/v21.0"


def _load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def _save_config(config: dict):
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def _post(endpoint: str, token: str, **data) -> dict:
    data["access_token"] = token
    r = requests.post(f"{GRAPH_BASE}/{endpoint}", data=data, timeout=30)
    r.raise_for_status()
    return r.json()


def _post_json(endpoint: str, token: str, **data) -> dict:
    data["access_token"] = token
    r = requests.post(f"{GRAPH_BASE}/{endpoint}", json=data, timeout=30)
    r.raise_for_status()
    return r.json()


def upload_photo_url(image_url: str, user_id: str, token: str) -> str:
    """Create an IG media container. Returns creation_id."""
    result = _post(
        f"{user_id}/media",
        token,
        image_url=image_url,
        caption="",
    )
    return result["id"]


def publish_container(creation_id: str, user_id: str, token: str) -> str:
    """Publish the container. Returns media_id."""
    result = _post(
        f"{user_id}/media_publish",
        token,
        creation_id=creation_id,
    )
    return result["id"]


def _serve_image_for_meta(image_path: str) -> str:
    """
    Meta's API requires a publicly reachable URL for the image.
    We use a short-lived imgbb upload (free tier, no account needed for API key).
    Requires IMGBB_API_KEY env var — see setup instructions.
    """
    api_key = os.environ.get("IMGBB_API_KEY")
    if not api_key:
        raise EnvironmentError("IMGBB_API_KEY not set. See tools/instagram/SETUP.md.")

    with open(image_path, "rb") as f:
        r = requests.post(
            "https://api.imgbb.com/1/upload",
            data={"key": api_key, "expiration": 600},  # 10 min TTL
            files={"image": f},
            timeout=30,
        )
    r.raise_for_status()
    return r.json()["data"]["url"]


def _append_diary(text: str):
    DIARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    with open(DIARY_PATH, "a") as f:
        f.write(f"\n## {stamp} — Instagram\n{text}\n")


def run(force: bool = False, dry_run: bool = False):
    config = _load_config()
    token = config["api"]["access_token"]
    user_id = config["api"]["instagram_user_id"]

    if not token or not user_id:
        print("[poster] ERROR: access_token or instagram_user_id not configured. Run setup.")
        sys.exit(2)

    # Always collect pending insights first (background task)
    try:
        collect_pending_insights()
    except Exception as e:
        print(f"[poster] insights collection error (non-fatal): {e}")

    if not force and not should_post_now():
        count = get_queue_count()
        print(f"[poster] Not posting now. Queue: {count} photo(s).")
        sys.exit(0)

    with tempfile.TemporaryDirectory() as tmpdir:
        photo = export_next_photo(tmpdir)
        if not photo:
            print("[poster] Queue is empty — nothing to post.")
            sys.exit(0)

        if dry_run:
            print(f"[poster] DRY RUN — would post: {photo['path']}")
            sys.exit(0)

        print(f"[poster] Uploading {photo['original_filename']}…")
        image_url = _serve_image_for_meta(photo["path"])

        creation_id = upload_photo_url(image_url, user_id, token)
        media_id = publish_container(creation_id, user_id, token)

        posted_at = datetime.utcnow().isoformat()
        print(f"[poster] Posted! media_id={media_id}")

        removed = remove_from_album(photo["uuid"])
        if not removed:
            print(f"[poster] WARNING: could not remove {photo['uuid']} from album.")

        # Log to history
        config["history"].append({
            "media_id": media_id,
            "original_filename": photo["original_filename"],
            "posted_at": posted_at,
            "insights_collected": False,
        })
        _save_config(config)

        report = growth_report(config)
        _append_diary(
            f"Posted photo `{photo['original_filename']}` to @clubsmanship.\n"
            f"Remaining in Inspo: {get_queue_count()}.\n{report}"
        )
        print(f"[poster] Done. {report}")


if __name__ == "__main__":
    force = "--force" in sys.argv
    dry_run = "--dry-run" in sys.argv
    run(force=force, dry_run=dry_run)
