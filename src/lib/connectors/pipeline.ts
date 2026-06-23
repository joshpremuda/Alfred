import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface IngestItem {
  title: string;
  content: string;
  source: string;
  type: 'url' | 'document' | 'note';
  metadata?: Record<string, unknown>;
}

export interface ConnectorResult {
  connector: string;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Core ingestion pipeline. All connectors funnel through here.
 * Deduplicates by source URL — re-running a connector is always safe.
 */
export async function ingestItems(
  items: IngestItem[],
  connectorName: string
): Promise<ConnectorResult> {
  const db = getDb();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const existing = db.prepare(
        'SELECT id FROM knowledge_items WHERE source = ?'
      ).get(item.source);

      if (existing) {
        skipped++;
        continue;
      }

      db.prepare(`
        INSERT INTO knowledge_items (id, type, title, content, source, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        item.type,
        item.title,
        item.content,
        item.source,
        JSON.stringify({ ...item.metadata, connector: connectorName, importedAt: Date.now() })
      );

      imported++;
    } catch (err) {
      errors.push(`${item.source}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Log sync result as notification if anything was imported
  if (imported > 0) {
    db.prepare(`
      INSERT INTO notifications (id, type, title, body)
      VALUES (?, 'sync', ?, ?)
    `).run(
      uuidv4(),
      `${connectorName} sync complete`,
      `Imported ${imported} new item${imported !== 1 ? 's' : ''} into your knowledge vault.`
    );
  }

  return { connector: connectorName, imported, skipped, errors };
}

export interface Connector {
  name: string;
  description: string;
  fetch(): Promise<IngestItem[]>;
}
