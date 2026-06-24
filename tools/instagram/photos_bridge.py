"""
Apple Photos bridge — exports the oldest photo from the Post Queue album
and removes it after a successful post.
"""

import subprocess
import json
import os
import tempfile
from pathlib import Path
from typing import Optional


ALBUM_NAME = "Alfred Post Queue"


def _run_osxphotos(*args) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["osxphotos", *args],
        capture_output=True,
        text=True,
        check=True,
    )


def get_queue_count() -> int:
    """Return number of photos waiting in the album."""
    try:
        result = _run_osxphotos(
            "query",
            "--album", ALBUM_NAME,
            "--json",
        )
        photos = json.loads(result.stdout or "[]")
        return len(photos)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return 0


def export_next_photo(export_dir: str) -> Optional[dict]:
    """
    Export the oldest photo from the album to export_dir.
    Returns dict with keys: uuid, path, original_filename
    or None if queue is empty.
    """
    try:
        result = _run_osxphotos(
            "query",
            "--album", ALBUM_NAME,
            "--json",
            "--added-to-album-before", "now",
        )
        photos = json.loads(result.stdout or "[]")
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None

    if not photos:
        return None

    # Oldest first
    photos.sort(key=lambda p: p.get("added_date", ""))
    photo = photos[0]
    uuid = photo["uuid"]

    _run_osxphotos(
        "export",
        export_dir,
        "--uuid", uuid,
        "--convert-to-jpeg",
        "--jpeg-quality", "1.0",
        "--overwrite",
        "--skip-live",
        "--skip-burst-photos",
    )

    # Find exported file
    exported = list(Path(export_dir).glob("*.jpg")) + list(Path(export_dir).glob("*.jpeg"))
    if not exported:
        return None

    return {
        "uuid": uuid,
        "path": str(exported[0]),
        "original_filename": photo.get("original_filename", "photo.jpg"),
    }


def remove_from_album(uuid: str) -> bool:
    """Remove a photo from the Post Queue album (does not delete from library)."""
    script = f'''
tell application "Photos"
    set theAlbum to album "{ALBUM_NAME}"
    set thePhoto to media item id "{uuid}"
    remove thePhoto from theAlbum
end tell
'''
    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0
