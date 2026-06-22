import fs from 'fs';
import path from 'path';

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  if (mimeType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }

  return buffer.toString('utf-8');
}

export async function extractUrl(url: string): Promise<{ title: string; content: string }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Valet/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  const html = await response.text();
  const { load } = await import('cheerio');
  const $ = load(html);

  $('script, style, nav, footer, header, aside, .ad, #ad, [class*="banner"]').remove();

  const title = $('title').text().trim() ||
    $('h1').first().text().trim() ||
    new URL(url).hostname;

  const content = $('article, main, [role="main"], .content, #content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000);

  return { title, content };
}

export function saveUploadedFile(buffer: Buffer, originalName: string): string {
  const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads', 'documents');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const ext = path.extname(originalName);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(UPLOADS_DIR, safeName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
