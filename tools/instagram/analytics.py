"""
Instagram Insights fetcher and engagement heatmap builder.
Runs ~48h after each post to score it, then updates the learned schedule.
"""

import json
import requests
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "config.json"
GRAPH_BASE = "https://graph.facebook.com/v21.0"


def _load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def _save_config(config: dict):
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def _get(endpoint: str, token: str, **params) -> dict:
    params["access_token"] = token
    r = requests.get(f"{GRAPH_BASE}/{endpoint}", params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def fetch_post_insights(media_id: str, token: str) -> dict:
    data = _get(
        f"{media_id}/insights",
        token,
        metric="impressions,reach,likes,comments,saved,shares",
        period="lifetime",
    )
    result = {}
    for item in data.get("data", []):
        result[item["name"]] = item["values"][0]["value"] if item.get("values") else 0
    return result


def score_engagement(insights: dict, weights: dict) -> float:
    return sum(
        insights.get(metric, 0) * weight
        for metric, weight in weights.items()
    )


def _heatmap_key(dt: datetime) -> str:
    return f"{dt.strftime('%a').lower()}_{dt.hour}"


def update_heatmap(config: dict, post_datetime: datetime, score: float):
    key = _heatmap_key(post_datetime)
    heatmap = config["learning"]["heatmap"]
    if key not in heatmap:
        heatmap[key] = {"score_sum": 0.0, "count": 0, "avg": 0.0}
    entry = heatmap[key]
    entry["score_sum"] += score
    entry["count"] += 1
    entry["avg"] = entry["score_sum"] / entry["count"]


def collect_pending_insights():
    """Check history for posts that are 48h+ old and haven't had insights collected."""
    config = _load_config()
    token = config["api"]["access_token"]
    weights = config["learning"]["engagement_weights"]
    now = datetime.utcnow()
    changed = False

    for post in config["history"]:
        if post.get("insights_collected"):
            continue
        posted_at = datetime.fromisoformat(post["posted_at"])
        if now - posted_at < timedelta(hours=48):
            continue

        try:
            insights = fetch_post_insights(post["media_id"], token)
            score = score_engagement(insights, weights)
            post["insights"] = insights
            post["engagement_score"] = round(score, 2)
            post["insights_collected"] = True
            update_heatmap(config, posted_at, score)
            changed = True
            print(f"[analytics] scored post {post['media_id']}: {score:.1f}")
        except Exception as e:
            print(f"[analytics] could not fetch insights for {post['media_id']}: {e}")

    if changed:
        _save_config(config)


def best_posting_hours(config: dict, top_n: int = 3) -> list[dict]:
    """
    Return top N (day, hour) slots by learned heatmap score.
    Falls back to seed windows until enough data is collected.
    """
    heatmap = config["learning"]["heatmap"]
    total_posts = len([p for p in config["history"] if p.get("insights_collected")])
    min_posts = config["learning"]["min_posts_before_learning"]

    if total_posts < min_posts or not heatmap:
        # Use seed windows, weighted by weight field
        seeds = sorted(
            config["scheduling"]["seed_windows"],
            key=lambda w: w["weight"],
            reverse=True,
        )
        return [{"day": s["day"], "hour": s["hour"], "score": s["weight"]} for s in seeds[:top_n]]

    # Use heatmap
    slots = [
        {"key": k, "day": k.split("_")[0], "hour": int(k.split("_")[1]), "score": v["avg"]}
        for k, v in heatmap.items()
    ]
    return sorted(slots, key=lambda s: s["score"], reverse=True)[:top_n]


def growth_report(config: dict) -> str:
    """Generate a brief growth summary for Alfred's diary."""
    history = config["history"]
    if not history:
        return "No posts yet."

    scored = [p for p in history if p.get("insights_collected")]
    total_posts = len(history)
    avg_score = (
        sum(p["engagement_score"] for p in scored) / len(scored) if scored else 0
    )

    top_slots = best_posting_hours(config, top_n=3)
    slot_str = ", ".join(
        f"{s['day']} {s['hour']}:00" for s in top_slots
    )

    trend = ""
    if len(scored) >= 6:
        recent = scored[-3:]
        older = scored[-6:-3]
        recent_avg = sum(p["engagement_score"] for p in recent) / 3
        older_avg = sum(p["engagement_score"] for p in older) / 3
        pct = ((recent_avg - older_avg) / older_avg * 100) if older_avg else 0
        trend = f" Engagement trending {'up' if pct > 0 else 'down'} {abs(pct):.0f}% vs prior 3 posts."

    return (
        f"@clubsmanship: {total_posts} posts total, "
        f"{len(scored)} scored. Avg engagement score: {avg_score:.1f}.{trend} "
        f"Best windows: {slot_str}."
    )
