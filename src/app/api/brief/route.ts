import { generateBrief } from '@/lib/alfred';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const brief = await generateBrief();
    return Response.json({ brief });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
