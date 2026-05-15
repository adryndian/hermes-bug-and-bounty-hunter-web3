# Changelog

## [Unreleased]

### Planned
- Auto-fetch bounties from platform APIs (currently manual JSON)
- Notification when new high-match bounties appear
- Submission template library
- Win/loss analytics dashboard
- Export learnings to Obsidian

---

## [0.1.0] — 2025-05-09

### Added
- Initial project setup (React + Vite + TypeScript + Zustand)
- Python backend (`serve.py`) with CORS proxy and DB endpoints
- SQLite database with full schema (`db.py`)
- Bounty grid view with card-based layout
- AI-powered deep analysis (scrape + analyze via Claude)
- Kanban board with drag-and-drop (@dnd-kit)
- 5-step Draft Workspace (Research → Generate → Review → Finalize → Submit)
- Multi-model AI chat sidebar
- Model routing: hermes:/cx/ → Gateway, kr:/fireworks/ → 9Router
- User profile system (skills, experience, focus areas)
- Bookmark system
- Status tracking with history
- Learnings/outcome recording
- Bounty detail scraping (Jina → trafilatura → BS4 fallback)
- Toast notification system
- Sort by reward/deadline/source
- Tab filtering by platform source
