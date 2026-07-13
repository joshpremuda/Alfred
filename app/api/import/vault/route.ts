import { importVault } from "@/lib/importVault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return Response.json(await importVault());
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
