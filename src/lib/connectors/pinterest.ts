/**
 * Pinterest connector — imports your saved pins
 *
 * Setup:
 *   1. Go to developers.pinterest.com
 *   2. Create an app and get an access token
 *   3. Add to .env.local:
 *      PINTEREST_ACCESS_TOKEN=your_token_here
 */

import { Connector, IngestItem } from './pipeline';

interface Pin {
  id: string;
  title?: string;
  description?: string;
  link?: string;
  media?: { images?: { orig?: { url: string } } };
  board_id?: string;
}

export const pinterestConnector: Connector = {
  name: 'Pinterest',
  description: 'Imports your saved Pinterest pins',

  async fetch(): Promise<IngestItem[]> {
    const token = process.env.PINTEREST_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        'PINTEREST_ACCESS_TOKEN required in .env.local\n' +
        'Get access at developers.pinterest.com'
      );
    }

    const res = await fetch(
      'https://api.pinterest.com/v5/pins?page_size=50',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      throw new Error(`Pinterest API returned ${res.status}`);
    }

    const data = await res.json() as { items?: Pin[] };
    const items: IngestItem[] = [];

    for (const pin of data.items || []) {
      const source = pin.link || `https://pinterest.com/pin/${pin.id}`;
      const content = [pin.title, pin.description].filter(Boolean).join('\n\n');

      items.push({
        title: pin.title || pin.description?.slice(0, 80) || `Pinterest pin ${pin.id}`,
        content: content || `Saved Pinterest pin: ${source}`,
        source,
        type: 'url',
        metadata: {
          source_name: 'Pinterest',
          pin_id: pin.id,
          image_url: pin.media?.images?.orig?.url,
        },
      });
    }

    return items;
  },
};
