Read `paper-filter/issue-data.json` (today's real headlines grouped by source) and write **only** the file `paper-filter/issue-content.json` — valid JSON, matching this schema exactly:

```json
{
  "date": "Sunday, July 19",
  "intro": "One warm, conversational opening line.",
  "items": [
    {
      "lead": "2–4 word topic",
      "body": "1–3 sentence conversational synthesis with 1–3 inline <a href=\"REAL_URL\">linked phrases</a> drawn from the data.",
      "sources": [ { "name": "Outlet", "url": "https://real-article-url" } ]
    }
  ],
  "quick": [ "One-sentence item with an inline <a href=\"REAL_URL\">link</a>." ]
}
```

Rules:
- 3–5 `items` (the day's biggest stories across sources) + 2–3 `quick` hits.
- Voice: a sharp friend catching Josh up over coffee. Conversational, tight, no preamble.
- Neutral and factual. Where sources emphasize different angles on the same story, note it in a few words. Do not editorialize or take sides.
- Use **only** facts and URLs present in `issue-data.json`. Never invent details, quotes, numbers, or links. Every `href` and every `sources[].url` must be a real link from the data.
- Weave links into the sentences (not a list). Each item's `sources` lists the outlets covering it, with their real URLs.

Write the file and stop. Do not print the JSON to the console; do not edit any other file.
