Read `paper-filter/issue-data.json` (today's real headlines grouped by source) and write **only** the file `paper-filter/issue-content.json` — valid JSON, matching this schema exactly:

```json
{
  "date": "Sunday, July 20",
  "intro": "One warm, conversational opening line.",
  "items": [
    {
      "lead": "2–4 word topic",
      "body": "2–4 sentence plain-prose summary that SYNTHESIZES what several sources are reporting on this story. No links, no markup — just the summary.",
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
- 3–5 `items` (the day's biggest stories) + 2–3 `quick` hits.
- **Synthesize across multiple sources.** Each item's `body` should draw on what *several* outlets are reporting — the shared picture — not restate one headline. Where the coverage differs, note it briefly and neutrally.
- **No links or markup in `body` or `text`.** They are plain prose only. **All links live in `sources`** — that's what the reader clicks.
- Each item's `sources` should list **2–4 real references** (the outlets covering that story), each a real URL from the data. `quick` items carry 1–2 sources. Prefer stories that appear across multiple sources so you can cite several.
- Voice: a sharp friend catching Josh up over coffee. Conversational, tight, no preamble.
- Neutral and factual. Use **only** facts and URLs present in `issue-data.json` — never invent details, quotes, numbers, or links.
- **Spread the sourcing** across the range of outlets; don't build the whole issue from one publisher.
- **Clean source names** in `sources[].name` — the recognizable outlet (e.g. "BBC News", not "Home - BBC News"; "The Economist", not "The Economist | Independent journalism").

Write the file and stop. Do not print the JSON to the console; do not edit any other file.
