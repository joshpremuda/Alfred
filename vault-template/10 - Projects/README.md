# Projects

Active projects with a defined outcome. Each project gets its own note.

```dataview
TABLE status, file.mtime as "Last updated"
FROM "10 - Projects"
WHERE file.name != "README"
SORT status ASC, file.mtime DESC
```
