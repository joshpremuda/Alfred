/**
 * X (Twitter) connector — imports your liked tweets and bookmarks
 *
 * Setup — requires X API v2 access:
 *   1. Go to developer.twitter.com and create an app
 *   2. Get a Bearer Token and your User ID
 *   3. Add to .env.local:
 *      X_BEARER_TOKEN=your_bearer_token
 *      X_USER_ID=your_numeric_user_id
 *
 * Note: X API free tier allows 1 bookmark/like request per 15 minutes.
 * Run this connector sparingly.
 */

import { Connector, IngestItem } from './pipeline';

interface Tweet {
  id: string;
  text: string;
  author_id?: string;
  entities?: {
    urls?: Array<{ expanded_url: string; display_url: string }>;
  };
}

export const xConnector: Connector = {
  name: 'X (Twitter)',
  description: 'Imports your X likes and bookmarks',

  async fetch(): Promise<IngestItem[]> {
    const token = process.env.X_BEARER_TOKEN;
    const userId = process.env.X_USER_ID;

    if (!token || !userId) {
      throw new Error(
        'X_BEARER_TOKEN and X_USER_ID required in .env.local\n' +
        'Get access at developer.twitter.com'
      );
    }

    const items: IngestItem[] = [];

    // Fetch bookmarks
    try {
      const bookmarksRes = await fetch(
        `https://api.twitter.com/2/users/${userId}/bookmarks?max_results=100&tweet.fields=entities,created_at,author_id&expansions=author_id`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (bookmarksRes.ok) {
        const data = await bookmarksRes.json() as { data?: Tweet[] };
        for (const tweet of data.data || []) {
          items.push(tweetToItem(tweet, 'X Bookmark'));
        }
      }
    } catch {
      // bookmarks failed, continue to likes
    }

    // Fetch likes
    try {
      const likesRes = await fetch(
        `https://api.twitter.com/2/users/${userId}/liked_tweets?max_results=100&tweet.fields=entities,created_at,author_id`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        }
      );

      if (likesRes.ok) {
        const data = await likesRes.json() as { data?: Tweet[] };
        for (const tweet of data.data || []) {
          items.push(tweetToItem(tweet, 'X Like'));
        }
      }
    } catch {
      // likes failed
    }

    return items;
  },
};

function tweetToItem(tweet: Tweet, sourceLabel: string): IngestItem {
  const tweetUrl = `https://x.com/i/web/status/${tweet.id}`;
  const urls = tweet.entities?.urls?.map(u => u.expanded_url).join(' ') || '';
  const content = `${tweet.text}\n\n${urls}`.trim();

  return {
    title: tweet.text.slice(0, 100),
    content,
    source: tweetUrl,
    type: 'url',
    metadata: { source_name: sourceLabel, tweet_id: tweet.id },
  };
}
