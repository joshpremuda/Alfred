import { NextRequest } from 'next/server';
import { getEnabledConnectors, getConnectorStatus } from '@/lib/connectors';
import { ingestItems } from '@/lib/connectors/pipeline';

export const runtime = 'nodejs';

// GET — show connector status
export async function GET() {
  const status = getConnectorStatus();
  const enabled = status.filter(s => s.enabled);
  return Response.json({ connectors: status, enabledCount: enabled.length });
}

// POST — run sync (all connectors or a specific one)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const targetConnector = body.connector as string | undefined;

  const connectors = getEnabledConnectors();

  if (connectors.length === 0) {
    return Response.json({
      message: 'No connectors configured. Add credentials to .env.local to enable them.',
      setup: getConnectorStatus(),
    });
  }

  const toRun = targetConnector
    ? connectors.filter(c => c.name.toLowerCase() === targetConnector.toLowerCase())
    : connectors;

  if (toRun.length === 0) {
    return Response.json({ error: `Connector "${targetConnector}" not found or not enabled` }, { status: 404 });
  }

  const results = [];

  for (const connector of toRun) {
    try {
      console.log(`[Sync] Running ${connector.name}...`);
      const items = await connector.fetch();
      const result = await ingestItems(items, connector.name);
      results.push(result);
      console.log(`[Sync] ${connector.name}: ${result.imported} imported, ${result.skipped} skipped`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Sync] ${connector.name} failed:`, msg);
      results.push({ connector: connector.name, imported: 0, skipped: 0, errors: [msg] });
    }
  }

  const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
  return Response.json({ results, totalImported });
}
