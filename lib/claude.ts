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

function backendNote(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err);
  if (/credit balance is too low|insufficient|billing/i.test(m)) {
    return "_The written brief needs Claude, and the API has no credits yet. Everything above is live and accurate — add credits at console.anthropic.com/keys to enable synthesis._";
  }
  return `_AI synthesis unavailable: ${shortErr(err)}_`;
}

export interface AssistantOpts {
  /**
   * If Claude fails/absent, fall back to the free local model. Default true for
   * interactive chat. Set FALSE for briefings/news so the small local model can
   * never fabricate facts — those show accurate deterministic content instead.
   */
  localFallback?: boolean;
}

/**
 * Alfred's reply. Uses Claude when a key is configured and working; otherwise
 * falls back to the local model (interactive chat) or a short note (localFallback
 * = false, used by briefs so the tiny local model never invents facts).
 */
export async function* streamAssistant(
  history: ChatMessage[],
  grounding: Grounding = {},
  opts: AssistantOpts = {},
): AsyncGenerator<string> {
  const { localFallback = true } = opts;
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
      if (!localFallback) {
        yield backendNote(err);
        return;
      }
      yield `_(Claude unavailable — answering with the local model. ${shortErr(err)})_\n\n`;
    }
  } else if (!localFallback) {
    yield "_No Claude API key is set, so the written synthesis is off. The content above is live. Add ANTHROPIC_API_KEY to .env to enable it._";
    return;
  }
  const { text } = composeSystem(grounding);
  yield* streamLocal(history, text);
}

/** Personal Chief-of-Staff briefing (projects, calendar, priorities — not news). */
export function briefPrompt(stateContext: string): string {
  return `Give Josh a short, prioritized personal briefing as his Chief of Staff. Based only on the data below (his projects, calendar, and notifications), tell him in 3–5 sentences what to focus on first today and flag anything time-sensitive or stalled. Editorial and decisive; do not invent anything not in the data.\n\nData:\n\n${stateContext || "(no projects or calendar yet)"}`;
}

/** The Paper Filter: a neutral news brief synthesized from current headlines. */
export function paperFilterPrompt(headlines: string): string {
  return `You are "The Paper Filter" — you turn many news sources into one quick, relatively unbiased brief so Josh doesn't have to read them all.

Below are today's actual headlines from his sources. Write a tight brief:
- Lead with the 4–6 biggest stories/themes appearing across the sources, in plain, neutral language.
- Where different outlets emphasize different angles on the same story, note it in a few words. Do not editorialize or take a side.
- Use ONLY what's in the headlines below — do not invent details, quotes, numbers, or events. If something is unclear from the headline, keep it high-level.
- Keep it skimmable: short paragraphs or tight bullets. No preamble.

Today's headlines:\n\n${headlines}`;
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
