import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/db";
import { streamLocal } from "@/lib/localModel";

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
    throw new Error("ANTHROPIC_API_KEY is not set. Add your key to .env (see .env.example).");
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/** True when a usable Anthropic key is configured. */
export function hasApiKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !!k && !k.includes("REPLACE");
}

function shortErr(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  return m.length > 140 ? m.slice(0, 140) + "…" : m;
}

export interface Grounding {
  /** Relevant retrieved notes (cited as [n]). */
  notes?: string;
  /** Compact snapshot of projects/calendar/notifications. */
  state?: string;
}

/** Build the system prompt as Claude blocks (cached) and as plain text (local). */
function composeSystem(grounding: Grounding): { blocks: Anthropic.TextBlockParam[]; text: string } {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: ALFRED_SYSTEM, cache_control: { type: "ephemeral" } },
  ];
  const parts = [ALFRED_SYSTEM];
  if (grounding.state) {
    blocks.push({ type: "text", text: grounding.state });
    parts.push(grounding.state);
  }
  if (grounding.notes) {
    const notes = `Relevant notes from Josh's knowledge base are below. Draw on them when they help, and cite the sources you use as [1], [2], etc. If they are not relevant, ignore them.\n\n${grounding.notes}`;
    blocks.push({ type: "text", text: notes });
    parts.push(notes);
  }
  return { blocks, text: parts.join("\n\n") };
}

/** Claude streaming path. Throws if no key or on an API error (e.g. no credits). */
async function* streamClaude(history: ChatMessage[], grounding: Grounding): AsyncGenerator<string> {
  const { blocks } = composeSystem(grounding);
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: blocks,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/**
 * Alfred's reply. Uses Claude when a key is configured and working; otherwise —
 * or if Claude errors before producing output (e.g. billing/credit failure) —
 * falls back to the free in-process local model so Alfred always answers.
 */
export async function* streamAssistant(
  history: ChatMessage[],
  grounding: Grounding = {},
): AsyncGenerator<string> {
  if (hasApiKey()) {
    let yielded = false;
    try {
      for await (const chunk of streamClaude(history, grounding)) {
        yielded = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (yielded) {
        yield `\n\n[Claude error mid-response: ${shortErr(err)}]`;
        return;
      }
      // Nothing streamed yet (usually no credits / auth) → fall back to local.
      yield `_(Claude unavailable — answering with the local model. ${shortErr(err)})_\n\n`;
    }
  }
  const { text } = composeSystem(grounding);
  yield* streamLocal(history, text);
}

/**
 * The user-turn prompt for an on-demand briefing — "The Paper Filter": a quick,
 * relatively unbiased news brief synthesizing Josh's sources.
 */
export function briefPrompt(stateContext: string): string {
  return `You are writing Josh's briefing — think of it as "The Paper Filter": a quick, relatively unbiased digest that saves him from reading everything himself.

Below are the full-text sources from his "Briefing" reading list, plus his projects and calendar. Write a tight brief:
- Lead with the 3–5 things actually worth knowing across the sources — the stories/themes, in plain language.
- Stay neutral and factual; where sources emphasize different angles, note it briefly. Don't editorialize or take sides.
- Then one line on anything time-sensitive in his projects/calendar.
- Assume he'll click through to the sources you flag; be specific about which are most worth his time and why.
Keep it skimmable and concise — no filler, no restating the raw list.

Data:\n\n${stateContext || "(no sources or projects yet)"}`;
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
