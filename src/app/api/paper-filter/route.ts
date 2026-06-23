import Anthropic from '@anthropic-ai/sdk';
import { fetchAllFeeds, buildFeedContext, type FeedResult } from '@/lib/briefing/fetch';
import { getDb } from '@/lib/db';
import { type FeedSource } from '@/lib/briefing/feeds';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const BRIEFING_SYSTEM = `You are Alfred, the editorial intelligence behind Paper Filter — a daily news briefing for Josh Premuda.

Paper Filter is named after his coffee brand. Like a good pour-over, it filters out the noise and delivers only the good stuff.

YOUR TASK
Synthesize today's headlines into a concise, well-edited morning briefing. Think Monocle's The Briefing meets an executive morning memo.

FORMAT
Use this structure exactly:

**THE BRIEF** — [Day, Date]

**The Big Story**
[1-2 sentences on the single most important story of the day. Be decisive about what matters most.]

**World**
[3-5 bullets. Global politics, geopolitics, international business.]

**Business & Markets**
[3-5 bullets. Economy, finance, notable company news.]

**Ideas & Culture**
[2-3 bullets. Things from Harper's, Paris Review, Works in Progress, The Economist long-reads — ideas worth holding.]

**Worth Noting**
[2-3 bullets. Anything interesting that doesn't fit above. Curated, not comprehensive.]

---
*Sourced from ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}*

GUIDELINES
- Be editorial. Pick what matters. Omit the rest.
- No fluff. No "In related news" transitions. Just clean bullets.
- If a story appears in multiple sources, mention it once — but note if it's getting wide coverage.
- Don't manufacture news that isn't in the feeds. Only summarize what's there.
- If a source was unavailable, don't mention it — just work with what you have.`;

export async function GET() {
  const started = Date.now();

  // Merge default feeds with any custom sources from DB
  const db = getDb();
  const customSources = db.prepare('SELECT * FROM briefing_sources WHERE enabled = 1').all() as Array<{name: string; homepage: string; rss: string | null}>;
  const extraFeeds: FeedSource[] = customSources.map(s => ({ name: s.name, homepage: s.homepage, rss: s.rss ?? undefined }));

  let feeds: FeedResult[] = [];
  try {
    feeds = await fetchAllFeeds(extraFeeds);
  } catch (err) {
    return Response.json({ error: 'Failed to fetch feeds' }, { status: 500 });
  }

  const context = buildFeedContext(feeds);
  const fetchMs = Date.now() - started;

  const successCount = feeds.filter(f => f.items.length > 0).length;

  if (successCount === 0) {
    return Response.json({
      error: 'Could not reach any news sources. Check your network connection.',
      feeds: feeds.map(f => ({ source: f.source, ok: false, error: f.error })),
    }, { status: 502 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let brief: string;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: BRIEFING_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Here are today's headlines from across the briefing sources:\n${context}\n\nGenerate The Brief.`,
        },
      ],
    });
    brief = msg.content[0]?.type === 'text' ? msg.content[0].text : 'Unable to generate brief.';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const isCredits = msg.includes('credit balance');
    return Response.json({
      error: isCredits
        ? 'Anthropic API credits needed. Add credits at console.anthropic.com/billing, then try again.'
        : `Claude API error: ${msg}`,
    }, { status: 402 });
  }

  return Response.json({
    brief,
    meta: {
      sourcesAttempted: feeds.length,
      sourcesSucceeded: successCount,
      fetchMs,
      totalMs: Date.now() - started,
      date: new Date().toISOString(),
    },
    feeds: feeds.map(f => ({
      source: f.source,
      ok: f.items.length > 0,
      method: f.method,
      count: f.items.length,
      error: f.error,
    })),
  });
}
