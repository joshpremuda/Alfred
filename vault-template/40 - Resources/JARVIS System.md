# JARVIS System

Reference for the AI system that powers your second brain.

## Alfred (Chief of Staff)
- URL: http://localhost:3000
- Start: `cd ~/JARVIS/Alfred && npm run dev`
- Repo: https://github.com/joshpremuda/alfred

## Agents (Planned)
| Agent | Role | Status |
|-------|------|--------|
| Alfred | Chief of Staff | Active |
| Wayne | COO of Smalley Coffee | Planned |
| Q | Systems Architect | Planned |
| Creative | Design & Writing Director | Planned |

## Useful Commands

```bash
# Start Alfred
cd ~/JARVIS/Alfred && npm run dev

# Re-seed database
cd ~/JARVIS/Alfred && node scripts/seed.js

# Update Alfred (pull latest)
cd ~/JARVIS/Alfred && git pull
```

## API Keys
- Anthropic: console.anthropic.com/keys
- Key stored in: ~/JARVIS/Alfred/.env.local

## Folder Map
```
~/JARVIS/          → root of the system
  vault/           → this Obsidian vault
  inbox/           → capture zone
  media/           → images and inspiration
  Alfred/          → the AI application
~/Work/            → day job
~/Smalley/         → Smalley Coffee business files
~/Projects/        → active personal projects
~/Archive/         → completed and inactive
~/_Review/         → staging for deletion (check monthly)
```
