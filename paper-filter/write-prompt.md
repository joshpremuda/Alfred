Read `paper-filter/issue-data.json` (today's real headlines grouped by source) and write **only** the file `paper-filter/issue-content.json` — valid JSON, matching this schema exactly:

```json
{
  "date": "Sunday, July 20",
  "intro": "One warm, conversational opening line.",
  "items": [
    {
      "lead": "2–4 word topic",
      "body": "2–4 sentence plain-prose summary with the concrete, pertinent details (who/what, key names, numbers, outcomes), synthesizing multiple sources when they cover it. No links, no markup.",
      "sources": [
        { "name": "Reuters", "url": "https://real-article-url" },
        { "name": "BBC News", "url": "https://real-article-url" },
        { "name": "The New York Times", "url": "https://real-article-url" }
      ]
    }
  ],
  "quick": [
    { "text": "One-sentence item, plain prose, no links.", "sources": [ { "name": "Bloomberg", "url": "https://real-article-url" } ] }
  ]
}
```

Rules:
- **6–8 `items`** covering the day broadly — the biggest stories *and* the notable smaller ones — plus **4–6 `quick` hits**. Err toward including more pertinent news, not less.
- **Be specific and concrete.** Each `body` carries the actual news — the who/what, key names, numbers, outcomes — not a vague high-level gloss. The reader should finish an item actually knowing what happened.
- **Use multiple sources where they exist, but never drop a story for being single-source.** When several outlets cover something, synthesize the shared picture and note any meaningful difference. When only one source has an important story, include it anyway.
- **No links or markup in `body` or `text`.** They are plain prose only. **All links live in `sources`** — that's what the reader clicks.
- Each item's `sources` lists **1–4 real references** (every outlet in the data that covers the story), each a real URL from the data. `quick` items carry 1–2 sources.
- Voice: a sharp friend catching Josh up over coffee. Conversational, tight, no preamble.
- Neutral and factual. Use **only** facts and URLs present in `issue-data.json` — never invent details, quotes, numbers, or links.
- **Spread the sourcing** across the range of outlets; don't build the whole issue from one publisher.
- **Clean source names** in `sources[].name` — the recognizable outlet (e.g. "BBC News", not "Home - BBC News"; "The Economist", not "The Economist | Independent journalism").

Write the file and stop. Do not print the JSON to the console; do not edit any other file.
