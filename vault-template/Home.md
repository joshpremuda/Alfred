# JARVIS

> *Josh's Artificial Valet Intelligence System*

---

## Now

```dataview
TABLE status, file.mtime as "Updated"
FROM "10 - Projects"
WHERE status = "active"
SORT file.mtime DESC
```

## This Week

- [ ] 

## Inbox

```dataview
LIST
FROM "00 - Inbox"
SORT file.ctime DESC
LIMIT 10
```

---

## Quick Links

- [[00 - Inbox/README|Inbox]] — capture everything here first
- [[10 - Projects/README|Projects]] — active work
- [[20 - Ideas/README|Idea Reservoir]] — nothing is ever deleted
- [[30 - Areas/README|Areas]] — ongoing responsibilities
- [[40 - Resources/README|Resources]] — reference and research
- [Alfred (AI)](http://localhost:3000) — your Chief of Staff
