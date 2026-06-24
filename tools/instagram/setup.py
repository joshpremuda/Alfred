"""
One-time setup wizard — configures API credentials and creates the Photos album.
Run: python3 tools/instagram/setup.py
"""

import json
import subprocess
import webbrowser
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "config.json"
ENV_PATH = Path(__file__).parent.parent.parent / ".env"


def _load_config():
    return json.loads(CONFIG_PATH.read_text())


def _save_config(config):
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def _append_env(key, value):
    with open(ENV_PATH, "a") as f:
        f.write(f"\n{key}={value}")


def create_photos_album(album_name: str):
    script = f'''
tell application "Photos"
    if not (exists album "{album_name}") then
        make new album named "{album_name}"
    end if
end tell
'''
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  ✓ Photos album '{album_name}' is ready.")
    else:
        print(f"  ✗ Could not create album: {result.stderr}")


def main():
    print("\n=== Alfred Instagram Setup ===\n")

    config = _load_config()

    print("Step 1: Meta Developer App")
    print("  You need a Meta app with these permissions:")
    print("    - instagram_basic")
    print("    - instagram_content_publish")
    print("    - instagram_manage_insights")
    print("    - pages_read_engagement\n")
    print("  Get a long-lived User Access Token from:")
    print("  https://developers.facebook.com/tools/explorer/\n")

    token = input("  Paste your long-lived access token: ").strip()
    config["api"]["access_token"] = token

    user_id = input("  Paste your Instagram User ID (numeric, from Graph Explorer): ").strip()
    config["api"]["instagram_user_id"] = user_id

    print("\nStep 2: imgbb API key (free image hosting for Meta's URL requirement)")
    print("  Sign up free at https://imgbb.com, then get API key at:")
    print("  https://api.imgbb.com/\n")
    imgbb_key = input("  Paste your imgbb API key: ").strip()

    print("\nStep 3: Verifying Apple Photos album…")
    album_name = config["account"]["photos_album"]
    print(f"  Using existing album: '{album_name}'")
    print("  (Album must already exist in Photos.app)")

    # Write to .env
    env_content = ""
    if ENV_PATH.exists():
        env_content = ENV_PATH.read_text()

    lines = env_content.splitlines()
    lines = [l for l in lines if not l.startswith("IMGBB_API_KEY=")]
    lines.append(f"IMGBB_API_KEY={imgbb_key}")
    ENV_PATH.write_text("\n".join(lines) + "\n")

    _save_config(config)

    print("\n=== Setup complete! ===")
    print(f"\nAdd photos to the '{album_name}' album in Photos.app.")
    print("Alfred will handle the rest.\n")
    print("Test with:  python3 tools/instagram/poster.py --dry-run")
    print("Force post: python3 tools/instagram/poster.py --force\n")


if __name__ == "__main__":
    main()
