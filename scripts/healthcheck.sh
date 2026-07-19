#!/usr/bin/env bash
# healthcheck.sh — verify a RUNNING Valet instance is set up correctly.
# Run this in another Terminal tab while `npm run dev` is running.
#
# Usage:  ./scripts/healthcheck.sh

set -uo pipefail
PORT="${PORT:-3210}"
B="http://127.0.0.1:${PORT}"

GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
bad()  { printf '  %s✗%s %s\n' "$RED" "$RESET" "$*"; }

printf '\n%sValet health check%s  (%s)\n' "$BOLD" "$RESET" "$B"

# 1. Is the server up?
if ! curl -sf --max-time 5 "$B/api/health" >/dev/null 2>&1; then
  bad "No server responding at $B"
  warn "Start it first:  npm run dev    (then re-run this in another tab)"
  exit 1
fi
ok "Server is up"

HEALTH="$(curl -s "$B/api/health")"

# 2. Parse + interpret with node (present on any Valet machine).
echo "$HEALTH" | node -e '
let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>{
  const h=JSON.parse(d), c=h.counts;
  const G="\x1b[0;32m",Y="\x1b[1;33m",RS="\x1b[0m";
  const line=(s,m)=>console.log(`  ${s} ${m}`);
  line(`${G}✓${RS}`, `Backend for chat: ${h.backend==="claude" ? "Claude ("+h.models.anthropic+")" : "LOCAL model ("+h.models.local+")"}`);
  if(!h.hasKey) line(`${Y}!${RS}`, "No API key set — chat uses the free local model (downloads once). Add ANTHROPIC_API_KEY for Claude.");
  line(`${G}✓${RS}`, `Obsidian vault: ${h.vault}`);
  line((c.items>0?`${G}✓${RS}`:`${Y}!${RS}`), `Captured items: ${c.items}` + (c.items===0 ? "  → open Vault tab and click \"Import Obsidian\"" : ""));
  line(`${G}✓${RS}`, `Projects: ${c.projects}   Ideas: ${c.ideas}`);
  if(c.chunks>0){
    const pct=Math.round(100*c.embedded/c.chunks);
    line((c.embedded>=c.chunks?`${G}✓${RS}`:`${Y}!${RS}`), `Search index: ${c.embedded}/${c.chunks} chunks embedded (${pct}%)` + (c.embedded<c.chunks ? "  → click \"Reindex\" in the Vault tab once the model has downloaded" : ""));
  }
});
'

# 3. Live probes that need no AI model: capture + keyword search round-trip.
PROBE="valet healthcheck probe $(date +%s)"
curl -s -X POST "$B/api/note" -H 'Content-Type: application/json' -d "{\"text\":\"$PROBE\"}" >/dev/null
FOUND="$(curl -s "$B/api/search?q=healthcheck%20probe" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).results||[];console.log(r.length>0?"yes":"no")})')"
if [ "$FOUND" = "yes" ]; then ok "Capture → search round-trip works"; else warn "Capture/search probe did not return a result"; fi

# 4. Chat probe (may be slow the first time if the local model is downloading).
printf '  %s·%s Testing chat (first local reply can take a minute while the model downloads)…\n' "$YELLOW" "$RESET"
REPLY="$(curl -s --max-time 180 -X POST "$B/api/chat" -H 'Content-Type: application/json' -d '{"message":"Reply with exactly: OK"}')"
if printf '%s' "$REPLY" | grep -qiE 'unavailable|error|not set'; then
  warn "Chat backend not ready: $(printf '%s' "$REPLY" | head -c 160)"
else
  ok "Chat responded: $(printf '%s' "$REPLY" | tr '\n' ' ' | head -c 80)…"
fi

printf '\n%sDone.%s Paste this whole output to Claude if anything shows ✗ or !.\n\n' "$BOLD" "$RESET"
