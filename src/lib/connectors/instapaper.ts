/**
 * Instapaper connector
 *
 * Uses Instapaper's simple export URL (no API key needed).
 * Fetches your saved articles as an RSS/CSV feed.
 *
 * Setup:
 *   INSTAPAPER_USERNAME=your@email.com
 *   INSTAPAPER_PASSWORD=yourpassword
 */

import { Connector, IngestItem } from './pipeline';
import { extractUrl } from '../ingest';

export const instapaperConnector: Connector = {
  name: 'Instapaper',
  description: 'Imports your saved Instapaper articles',

  async fetch(): Promise<IngestItem[]> {
    const username = process.env.INSTAPAPER_USERNAME;
    const password = process.env.INSTAPAPER_PASSWORD;

    if (!username || !password) {
      throw new Error('INSTAPAPER_USERNAME and INSTAPAPER_PASSWORD required in .env.local');
    }

    // Instapaper full export via their CSV export endpoint
    const params = new URLSearchParams({ username, password });
    const res = await fetch('https://www.instapaper.com/api/1/bookmarks/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Instapaper API returned ${res.status}`);
    }

    const data = await res.json() as Array<{ type: string; url?: string; title?: string; description?: string }>;
    const bookmarks = data.filter(item => item.type === 'bookmark' && item.url);

    const items: IngestItem[] = [];

    for (const bookmark of bookmarks.slice(0, 50)) {
      if (!bookmark.url) continue;
      try {
        const { title, content } = await extractUrl(bookmark.url);
        items.push({
          title: bookmark.title || title,
          content,
          source: bookmark.url,
          type: 'url',
          metadata: {
            description: bookmark.description,
            source_name: 'Instapaper',
          },
        });
      } catch {
        // If we can't fetch the article, still save the bookmark
        items.push({
          title: bookmark.title || bookmark.url,
          content: bookmark.description || '',
          source: bookmark.url,
          type: 'url',
          metadata: { source_name: 'Instapaper' },
        });
      }
    }

    return items;
  },
};
