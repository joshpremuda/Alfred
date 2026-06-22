# Idea Reservoir

**The rule:** Ideas never get deleted. They get promoted, shelved, or connected — never removed.

Statuses:
- `raw` — just captured, not yet thought through
- `developing` — actively thinking about this
- `active` — this has become a project (link to project note)
- `shelved` — not now, but never never

```dataview
TABLE status, created
FROM "20 - Ideas"
WHERE file.name != "README"
SORT status ASC, created DESC
```
