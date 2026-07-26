import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ItemRow {
  id: number;
  type: string;
  title: string;
  url: string | null;
  text_summary: string | null;
  created_at: string;
  collections: string | null;
}

export async function GET() {
  const rows = getDb()
    .prepare(
      `SELECT i.id, i.type, i.title, i.url, i.text_summary, i.created_at,
              GROUP_CONCAT(c.name, ', ') AS collections
         FROM items i
         LEFT JOIN item_collections ic ON ic.item_id = i.id
         LEFT JOIN collections c ON c.id = ic.collection_id
        GROUP BY i.id
        ORDER BY i.id DESC
        LIMIT 200`,
    )
    .all() as ItemRow[];

  return Response.json({
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      url: r.url,
      summary: r.text_summary,
      created_at: r.created_at,
      collections: r.collections ? r.collections.split(", ") : [],
    })),
  });
}
