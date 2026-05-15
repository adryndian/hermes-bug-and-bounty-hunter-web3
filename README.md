# Bounty Hunter

Local dashboard untuk tracking, analyzing, dan managing Web3 bounties dari berbagai platform. AI-powered analysis membantu menentukan bounty mana yang worth dikerjakan berdasarkan skill profile.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript 6 + Vite 8 + Zustand 5 |
| UI | Custom CSS (no framework), @dnd-kit for Kanban drag-drop |
| Backend | Python `serve.py` (stdlib http.server) port 3333 |
| Database | SQLite (WAL mode) via `db.py` |
| AI | Multi-model via 9Router (Claude, DeepSeek, GPT, Kimi, MiniMax) |
| Content | react-markdown for rendering |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (localhost:5173)                            │
│  React App — Vite dev server                        │
└──────────────────────┬──────────────────────────────┘
                       │ fetch /api/*, /db/*
                       ▼
┌─────────────────────────────────────────────────────┐
│  serve.py (localhost:3333)                           │
│  - Static file serving                              │
│  - CORS proxy to AI backends                        │
│  - DB endpoints (CRUD)                              │
│  - Bounty detail scraping (Jina → trafilatura → BS4)│
│  - Draft pipeline (research → generate → verify)    │
└────────┬────────────────────┬───────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│  SQLite DB      │  │  AI Backends       │
│  bounty_hunter  │  │  - Hermes (8642)   │
│  .db            │  │  - 9Router (20128) │
└─────────────────┘  └────────────────────┘
```

## Features

### Bounty Grid (Tab: All / per-source)
- Card-based grid view semua active bounties
- Sort by reward, deadline, source
- Bookmark bounties
- Quick status assignment (interested → applied → submitted)
- Per-card AI analysis trigger

### AI Analysis
- Deep analyze: scrape bounty page → AI generates match_score, difficulty, strategy, verdict
- Verdict: `recommended` / `possible` / `skip`
- Cross-bounty context (learns from previous analyses)
- User profile-aware scoring

### Draft Workspace (Tab: Draft)
- 5-step pipeline: Research → Generate → Review → Finalize → Submit
- **Research**: Scrape bounty detail + AI structures requirements/deliverables
- **Generate**: AI writes submission draft based on research + profile
- **Review**: AI verifies draft against requirements (checklist + score)
- **Finalize**: Manual edit + polish
- **Submit**: Copy final text, mark as submitted

### Kanban Board (Tab: Kanban)
- Drag-and-drop columns: Interested → Applied → Submitted
- Bottom row: Won / Lost / Archived
- Auto-sync with Draft panel status changes
- Status history tracking in DB

### AI Chat
- Sidebar chat with bounty context
- Multi-model selection (Claude, DeepSeek, GPT, Kimi, MiniMax)
- Attach specific bounty for focused discussion
- Web3 expert system prompt

### User Profile
- Skills, experience level, languages, focus areas
- Persisted in DB, used by all AI prompts for personalized analysis

## Data Sources

Bounties loaded from `bounties.json` (fetched externally). Sources:
- **Superteam Earn** — Solana ecosystem (content, dev, design)
- **Code4rena** — Smart contract audit contests
- **Immunefi** — Security/bug bounties
- **Sherlock** — Audit contests

## Quick Start

```bash
# Terminal 1: Backend
cd ~/Desktop/bounty-hunter
python3 serve.py
# → http://localhost:3333

# Terminal 2: Frontend
cd ~/Desktop/bounty-hunter/app
npm run dev
# → http://localhost:5173
```

## API Endpoints

### DB Endpoints (serve.py)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bounties` | All active bounties from DB |
| POST | `/api/bounties/refresh` | Re-fetch bounties from sources |
| GET | `/api/fetch-bounty-detail?url=` | Scrape bounty page content |
| GET | `/db/stats` | Dashboard statistics |
| GET | `/db/context` | AI context from learnings |
| GET | `/db/statuses` | All kanban statuses |
| GET | `/db/bookmarks` | All bookmarked bounty IDs |
| GET | `/db/history/:id` | Status history for a bounty |
| GET | `/db/user-profile` | User profile data |
| POST | `/db/status` | Set bounty kanban status |
| POST | `/db/learning` | Record outcome/learning |
| POST | `/db/bookmark` | Toggle bookmark |
| POST | `/db/user-profile` | Save user profile |

### AI Proxy Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/chat/completions` | Proxied to Hermes/9Router |
| POST | `/api/draft-research` | Step 1: Research bounty |
| POST | `/api/draft-generate` | Step 2: Generate submission |
| POST | `/api/draft-verify` | Step 3: Verify draft quality |

### Model Routing (serve.py)

| Prefix | Route To | Auth |
|--------|----------|------|
| `hermes:*` | Hermes Gateway :8642 (strip prefix) | None |
| `cx/*` | Hermes Gateway :8642 (as-is) | None |
| `kr/*` | 9Router :20128 (as-is) | Bearer key |
| `fireworks/*` | 9Router :20128 (as-is) | Bearer key |

## Database Schema

```sql
bounties        — Raw bounty data (id, source, title, reward, deadline, url, sponsor, type, category)
analysis        — AI analysis per bounty (match_score, difficulty, verdict, strategy, skills_needed)
bounty_status   — Current kanban status per bounty
status_history  — Full status change log
learnings       — Outcome tracking (won/lost/skipped + lessons learned)
bookmarks       — Bookmarked bounty IDs
user_profile    — Single-row JSON blob (skills, experience, focus areas)
```

## File Structure

```
bounty-hunter/
├── serve.py              # Backend server (port 3333)
├── db.py                 # SQLite schema + helpers
├── bounty_hunter.db      # SQLite database
├── bounties.json         # Current bounties data
├── bounties_prev.json    # Previous fetch (for diff)
├── analysis.json         # Cached analysis results
├── index.html            # Entry point
├── app/
│   ├── package.json
│   ├── src/
│   │   ├── types/index.ts        # All TypeScript interfaces
│   │   ├── stores/bountyStore.ts # Zustand state management
│   │   ├── hooks/useApi.ts       # API calls + AI integration
│   │   ├── components/
│   │   │   ├── BountyGrid.tsx    # Main grid view
│   │   │   ├── BountyCard.tsx    # Individual bounty card
│   │   │   ├── KanbanBoard.tsx   # Drag-drop kanban
│   │   │   ├── DraftPanel.tsx    # 5-step draft workspace
│   │   │   ├── Topbar.tsx        # Navigation + tabs
│   │   │   ├── UserProfileModal.tsx
│   │   │   └── Tooltip.tsx
│   │   └── styles/index.css      # All styles
│   └── tsconfig*.json
└── graphify-out/                  # Knowledge graph (auto-generated)
```
