# Valet — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-06-22  
**Status:** Active Development

---

## Overview

Valet is a local-first AI operating system. It is not a chatbot. It is a personal Chief of Staff, second brain, and command center that quietly works in the background, understanding your projects, schedule, ideas, reading, priorities, and businesses.

**Phase 1** builds Alfred — the primary interface and Chief of Staff agent.

---

## Problem Statement

Knowledge workers accumulate enormous amounts of information across tools, but lack a system that synthesizes it into actionable intelligence. Existing AI tools (ChatGPT, etc.) are stateless and general-purpose. What's needed is a persistent, personal AI that knows you, remembers everything, and proactively surfaces what matters.

---

## Target User

**Josh Premuda** — entrepreneur, operator, creative

- Runs Smalley Coffee (operational business)
- Building Crema and Paper Filter (media/coffee properties)
- Developing Digital Caddie Book and Clubsmanship (product ideas)
- Manages multiple projects simultaneously
- Values minimal, editorial, intelligent design (Monocle aesthetic)

---

## Core Principles

1. **Local-first** — runs on an always-on MacBook, data stays local
2. **Calm** — proactive but never noisy; surfaces information, doesn't dump it
3. **Editorial** — prioritizes and recommends, doesn't just retrieve
4. **Simple** — SQLite, Markdown, single deployment; no microservices
5. **Reliable** — must work every day without maintenance

---

## MVP Feature Set (Phase 1)

### 1. Chat Interface
- Browser-based conversation with Alfred
- Persistent conversation history per session
- Streaming responses
- Keyboard shortcuts (Cmd+Enter to send)
- Alfred personality: calm, intelligent, organized, minimal

### 2. Knowledge Vault
- Upload PDFs, documents, text files, markdown
- URL capture and article extraction
- Full-text search across all content
- Auto-tagging and categorization
- Content stored as local files + SQLite metadata

### 3. Collections
- Auto-organize content into: Projects, Ideas, Reading, Inspiration, Resources, Smalley Coffee
- Items can belong to multiple collections
- Manual override and custom collections

### 4. Idea Reservoir
- Permanent repository of ideas — nothing ever disappears
- Current seed ideas: Digital Caddie Book, Clubsmanship, Crema, Paper Filter, Grounds for Living, Smalley Website Refresh, Notes From Your Father, Coloring Graffiti, Sandwich.Services, Church Project, Soccer Club
- Alfred periodically surfaces idea connections to new information
- Ideas have: title, description, status, related content, notes

### 5. Project Tracking
- Projects have: name, status, description, next actions, related resources
- Statuses: Active, Stalled, Paused, Complete
- Alfred flags stalled projects
- Alfred knows what's active and what's blocked

### 6. Brief Me Command
- On-demand executive briefing
- Includes: calendar items (when connected), open priorities, project updates, relevant saved content, opportunities
- Concise and actionable — not a data dump
- Available as `/brief` in chat or dedicated button

### 7. Notification Center
- Alfred remains quiet — no spam
- Maintains a notification queue
- Display: "Alfred has N items worth your attention"
- Notification types: deadline approaching, idea connection found, project stalled, calendar conflict

---

## Out of Scope (Phase 1)

- Calendar integration (design for it, wire up in Phase 2)
- Email integration
- Instapaper / X bookmarks / Pinterest connectors
- Shopify / Square integrations
- Mobile notifications
- Wayne, Q, Creative agents
- n8n automation

---

## Future Agents (Planned, Not Built)

| Agent | Role |
|-------|------|
| Wayne | COO of Smalley Coffee — operational intelligence |
| Q | Systems Architect — technical planning and infrastructure |
| Creative | Design & Writing Director — brand voice and content |

---

## Design Direction

**Aesthetic:** Monocle magazine meets Arc Browser — editorial, minimal, intelligent

**Color system:**
- Light theme (default)
- Dark theme
- Sunny theme (warm cream/amber)

**Typography:** System sans-serif, generous whitespace, clear hierarchy

**Tone:** The interface should feel like a well-designed editorial tool, not a chatbot UI

---

## Success Metrics

- Alfred can answer "What should I work on today?" with a useful response
- Knowledge is searchable and retrievable in chat
- Projects and ideas are tracked and surfaced
- Brief Me produces a concise, useful briefing
- System runs reliably without maintenance on a MacBook
