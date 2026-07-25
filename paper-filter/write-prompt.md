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
- **Spread the sourcing.** Draw across the range of outlets in the data — don't build the whole issue from one publisher (e.g. not everything from BBC). Favor stories that appear across multiple sources, and when two or three cover the same story, cite them together in that item's `sources`. The brief should reflect the breadth of the day, not one newsroom.
- **Clean source names.** In `sources[].name`, use the recognizable outlet name, not the raw bookmark/page title — e.g. "BBC News" (not "Home - BBC News"), "The Economist" (not "The Economist | Independent journalism"), "The New York Times" (not the full breaking-news tagline).

Write the file and stop. Do not print the JSON to the console; do not edit any other file.
