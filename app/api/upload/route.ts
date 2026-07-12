import type { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractPdf } from "@/lib/extract";
import { ingestItem } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "Expected multipart/form-data with a 'file'." }, { status: 400 });
  }
  if (!file) return Response.json({ error: "No file provided." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "data", "documents");
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${Date.now()}-${file.name}`);
  writeFileSync(filePath, buf);

  try {
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const text = isPdf ? (await extractPdf(buf)).text : buf.toString("utf8");
    if (!text.trim()) {
      return Response.json({ error: "No extractable text in that file." }, { status: 422 });
    }
    const result = await ingestItem({
      type: "file",
      title: file.name,
      text,
      filePath,
      source: "upload",
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
