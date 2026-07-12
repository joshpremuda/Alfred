import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { PDFParse } from "pdf-parse";

export interface Extracted {
  title: string;
  text: string;
}

/** Fetch a URL and extract its main readable article text. */
export async function extractUrl(url: string): Promise<Extracted> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ValetBot/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return extractHtml(await res.text(), url);
}

/** Extract readable text from an HTML string (Readability, with a plain fallback). */
export function extractHtml(html: string, url = "https://local/"): Extracted {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  try {
    const article = new Readability(doc).parse();
    if (article?.textContent?.trim()) {
      return { title: (article.title || doc.title || url).trim(), text: article.textContent.trim() };
    }
  } catch {
    /* fall through to plain-text extraction */
  }

  const body = doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return { title: (doc.title || url).trim(), text: body };
}

/** Extract text from a PDF buffer. */
export async function extractPdf(buf: Buffer): Promise<Extracted> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    return { title: "", text: (result.text || "").trim() };
  } finally {
    await parser.destroy();
  }
}
