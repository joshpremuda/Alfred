'use strict';
// Chief of Staff — generates the daily morning briefing
// Data sources: Gmail, Google Calendar, RSS feeds, NewsAPI

const Anthropic = require('@anthropic-ai/sdk');
const RSSParser = require('rss-parser');
const axios = require('axios');

const rss = new RSSParser({ timeout: 8000 });

const BRIEFING_SYSTEM = `You are Josh's Chief of Staff at Smalley Coffee. Write a tight morning briefing.
Format exactly as:

☀️ GOOD MORNING, JOSH

📅 TODAY
[calendar events as bullet list — omit section if empty]

📬 INBOX ([N] unread)
[top 3 most important emails, one line each, flagged ⚠️ if urgent]

☕ COFFEE + TRADE NEWS
[top 3 headlines from his sources, one line each]

📍 LOCAL
[any Jasper/Indiana news if present — omit entire section if none]

Keep it under 300 words. Dry, direct, no fluff.`;

let _client;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// ── Gmail ─────────────────────────────────────────────────────────────────
async function fetchRecentEmails() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return [{ subject: '(Gmail not configured)', from: '', snippet: '' }];
  }
  try {
    const token = await refreshGoogleToken();
    const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const listRes = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: `is:unread after:${since}`, maxResults: 20 },
      }
    );
    const messages = listRes.data.messages || [];
    const emails = await Promise.all(
      messages.slice(0, 10).map(async (m) => {
        const detail = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { format: 'metadata', metadataHeaders: ['Subject', 'From'] },
          }
        );
        const headers = detail.data.payload?.headers || [];
        const get = (name) => headers.find((h) => h.name === name)?.value || '';
        return { subject: get('Subject'), from: get('From'), snippet: detail.data.snippet || '' };
      })
    );
    return emails;
  } catch (err) {
    console.error('[briefing] Gmail error:', err.message);
    return [{ subject: '(Gmail error — check credentials)', from: '', snippet: '' }];
  }
}

// ── Google Calendar ───────────────────────────────────────────────────────
async function fetchTodayEvents() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return ['(Calendar not configured)'];
  }
  try {
    const token = await refreshGoogleToken();
    const now = new Date();
    const endOfTomorrow = new Date(now);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 2);
    endOfTomorrow.setHours(0, 0, 0, 0);

    const res = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          timeMin: now.toISOString(),
          timeMax: endOfTomorrow.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 15,
        },
      }
    );
    return (res.data.items || []).map((e) => {
      const start = e.start?.dateTime || e.start?.date || '';
      const time = start ? new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: process.env.TZ || 'America/Chicago' }) : 'All day';
      return `${time} — ${e.summary || 'Untitled'}`;
    });
  } catch (err) {
    console.error('[briefing] Calendar error:', err.message);
    return ['(Calendar error — check credentials)'];
  }
}

// ── RSS Feeds ─────────────────────────────────────────────────────────────
async function fetchRSSHeadlines() {
  const feedUrls = (process.env.NEWS_RSS_FEEDS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  // Always include these coffee trade feeds
  const defaultFeeds = [
    'https://sprudge.com/feed',
    'https://dailycoffeenews.com/feed',
  ];
  const allFeeds = [...new Set([...defaultFeeds, ...feedUrls])];

  const headlines = [];
  for (const url of allFeeds.slice(0, 6)) {
    try {
      const feed = await rss.parseURL(url);
      const top = feed.items.slice(0, 2);
      top.forEach((item) => headlines.push(item.title || ''));
    } catch {
      // Skip failed feeds silently
    }
  }
  return headlines.filter(Boolean).slice(0, 8);
}

// ── NewsAPI ───────────────────────────────────────────────────────────────
async function fetchNewsAPIHeadlines() {
  if (!process.env.NEWSAPI_KEY) return [];
  try {
    const queries = ['specialty coffee', 'Jasper Indiana'];
    const results = [];
    for (const q of queries) {
      const res = await axios.get('https://newsapi.org/v2/everything', {
        params: { q, sortBy: 'publishedAt', pageSize: 3, language: 'en' },
        headers: { 'X-Api-Key': process.env.NEWSAPI_KEY },
        timeout: 6000,
      });
      (res.data.articles || []).forEach((a) =>
        results.push({ title: a.title, source: a.source?.name || '', q })
      );
    }
    return results;
  } catch (err) {
    console.error('[briefing] NewsAPI error:', err.message);
    return [];
  }
}

// ── Google OAuth token refresh ────────────────────────────────────────────
async function refreshGoogleToken() {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  return res.data.access_token;
}

// ── Main briefing generator ───────────────────────────────────────────────
async function generateBriefing() {
  const [emails, events, rssHeadlines, newsItems] = await Promise.all([
    fetchRecentEmails(),
    fetchTodayEvents(),
    fetchRSSHeadlines(),
    fetchNewsAPIHeadlines(),
  ]);

  const localNews = newsItems
    .filter((n) => n.q === 'Jasper Indiana')
    .map((n) => n.title);
  const coffeeNews = newsItems
    .filter((n) => n.q === 'specialty coffee')
    .map((n) => n.title);
  const allCoffeeHeadlines = [...rssHeadlines, ...coffeeNews].slice(0, 6);

  const context = `
CALENDAR (today + tomorrow):
${events.length ? events.join('\n') : 'No events found'}

UNREAD EMAILS (${emails.length} in last 24h):
${emails
  .slice(0, 10)
  .map((e) => `From: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.snippet}`)
  .join('\n---\n')}

NEWS HEADLINES:
${allCoffeeHeadlines.join('\n')}

LOCAL NEWS (Jasper/Indiana):
${localNews.length ? localNews.join('\n') : 'None found today'}
`;

  const msg = await getClient().messages.create({
    model: process.env.HAIKU_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: BRIEFING_SYSTEM,
    messages: [{ role: 'user', content: context }],
  });

  return msg.content[0]?.text || '(briefing generation failed)';
}

module.exports = { generateBriefing };
