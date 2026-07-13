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

export interface Grounding {
  /** Relevant retrieved notes (cited as [n]). */
  notes?: string;
  /** Compact snapshot of projects/calendar/notifications. */
  state?: string;
}

/** Stream Alfred's reply as text chunks, optionally grounded in notes + state. */
export async function* streamAlfred(
  history: ChatMessage[],
  grounding: Grounding = {},
): AsyncGenerator<string> {
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: ALFRED_SYSTEM, cache_control: { type: "ephemeral" } },
  ];
  if (grounding.state) {
    system.push({ type: "text", text: grounding.state });
  }
  if (grounding.notes) {
    system.push({
      type: "text",
      text: `Relevant notes from Josh's knowledge base are below. Draw on them when they help, and cite the sources you use as [1], [2], etc. If they are not relevant, ignore them.\n\n${grounding.notes}`,
    });
  }

  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system,
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

/** Stream an on-demand briefing built from Josh's current state. */
export async function* streamBriefing(stateContext: string): AsyncGenerator<string> {
  const anthropic = getClient();
  const user = `Give me a briefing. Current state:\n\n${stateContext || "(no projects, calendar, or captures yet)"}\n\nStructure it as: a one-line greeting, then only the sections that have something worth saying — **Focus today**, **Calendar**, **Projects** (active & stalled), **Worth your attention**. Prioritize ruthlessly and recommend what to do first. Keep it tight and editorial; do not pad.`;

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: ALFRED_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export const COLLECTIONS = [
  "Projects",
  "Ideas",
  "Reading",
  "Inspiration",
  "Resources",
  "Smalley Coffee",
] as const;

export interface Enrichment {
  title: string;
  summary: string;
  collections: string[];
}

/**
 * Summarize + auto-classify captured content. Returns null (gracefully) when no
 * API key is configured, so capture still works offline — items just aren't
 * enriched until a key is present.
 */
export async function summarizeClassify(
  text: string,
  hintTitle?: string,
): Promise<Enrichment | null> {
  let anthropic: Anthropic;
  try {
    anthropic = getClient();
  } catch {
    return null;
  }

  const prompt = `Summarize the content below in 2-3 sentences, and classify it into zero or more of these collections: ${COLLECTIONS.join(
    ", ",
  )}.\nRespond with ONLY JSON: {"title": string, "summary": string, "collections": string[]}.\n\nContent:\n${text.slice(0, 6000)}`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const collections = Array.isArray(json.collections)
      ? json.collections.filter((c: string) => (COLLECTIONS as readonly string[]).includes(c))
      : [];
    return {
      title: typeof json.title === "string" ? json.title : hintTitle ?? "",
      summary: typeof json.summary === "string" ? json.summary : "",
      collections,
    };
  } catch {
    return null;
  }
}
