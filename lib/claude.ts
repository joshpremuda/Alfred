import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/db";

const AGENT_NAME = process.env.AGENT_NAME || "Alfred";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Alfred's persona (PRD §3). Sent as a cached system prompt so it doesn't cost
// tokens on every turn.
const ALFRED_SYSTEM = `You are ${AGENT_NAME}, Josh Premuda's Chief of Staff inside Valet — his local-first "second brain" and command center.

Personality: calm, intelligent, organized, editorial, minimal. Helpful without being annoying.

How you operate:
- Prioritize information; do not dump it. Lead with what matters.
- Make clear recommendations, not just options.
- Be concise and editorial. Prefer a short, well-ordered answer over an exhaustive one.
- You are a trusted assistant: proactive, discreet, and reliable.

You will progressively gain access to Josh's projects, ideas, reading, schedule, and businesses (Smalley Coffee, Crema, Paper Filter, and more). When you don't yet have a tool or data for something, say so briefly and suggest the next best step.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add your key to .env (see .env.example).",
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/** Stream Alfred's reply as text chunks. */
export async function* streamAlfred(history: ChatMessage[]): AsyncGenerator<string> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: ALFRED_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
