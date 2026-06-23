/**
 * Feedly connector — imports your saved/starred articles
 *
 * Setup:
 *   1. Go to feedly.com/i/cortex
 *   2. Generate a Developer Token
 *   3. Add to .env.local:
 *      FEEDLY_ACCESS_TOKEN=your_token_here
 */

import { Connector, IngestItem } from './pipeline';
import { extractUrl } from '../ingest';

export const feedlyConnector: Connector = {
  name: 'Feedly',
  description: 'Imports your saved/starred Feedly articles',

  async fetch(): Promise<IngestItem[]> {
    const token = process.env.FEEDLY_ACCESS_TOKEN;
    if (!token) {
      throw new Error('FEEDLY_ACCESS_TOKEN required in .env.local — get one at feedly.com/i/cortex');
    }

    const res = await fetch(
      'https://cloud.feedly.com/v3/streams/contents?streamId=user%2Fme%2Ftag%2Fglobal.saved&count=50',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      throw new Error(`Feedly API returned ${res.status} — check your access token`);
    }

    const data = await res.json() as {
      items: Array<{
        id: string;
        title?: string;
        alternate?: Array<{ href: string }>;
        summary?: { content: string };
        content?: { content: string };
      }>
    };

    const items: IngestItem[] = [];

    for (const article of data.items || []) {
      const url = article.alternate?.[0]?.href;
      if (!url) continue;

      const rawContent = article.content?.content || article.summary?.content || '';
      const textContent = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      let finalContent = textContent;
      if (textContent.length < 200) {
        try {
          const fetched = await extractUrl(url);
          finalContent = fetched.content;
        } catch {
          finalContent = textContent;
        }
      }

      items.push({
        title: article.title || url,
        content: finalContent,
        source: url,
        type: 'url',
        metadata: { source_name: 'Feedly', feedly_id: article.id },
      });
    }

    return items;
  },
};
