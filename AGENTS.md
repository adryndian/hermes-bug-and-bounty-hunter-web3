# AGENTS.md — Bounty Hunter

Guidelines for AI agents working on this codebase.

## Project Overview

Local Web3 bounty tracking dashboard. React frontend + Python backend + SQLite. AI-powered analysis via multi-model routing (9Router/Hermes Gateway).

## Tech Stack

- **Frontend**: React 19, TypeScript 6, Vite 8, Zustand 5, @dnd-kit
- **Backend**: Python 3 stdlib `http.server` (no framework)
- **Database**: SQLite with WAL mode
- **AI**: OpenAI-compatible API via 9Router (port 20128) and Hermes Gateway (port 8642)

## Code Conventions

### TypeScript (Frontend)
- Functional components only, no class components
- Zustand for all state (single store with persist middleware)
- Types defined in `src/types/index.ts` — add new types there
- Hooks in `src/hooks/` — API logic lives in `useApi.ts`
- No CSS framework — plain CSS in `src/styles/index.css`
- CSS variables for theming (--green, --yellow, --red, etc.)
- Import store with `useStore(s => s.specificField)` selector pattern

### Python (Backend)
- Single-file server (`serve.py`) — no framework, stdlib only for HTTP
- External libs allowed for scraping: `requests`, `trafilatura`, `beautifulsoup4`
- DB access via `db.py` helpers — always call `init_db()` before queries
- JSON responses for all endpoints
- CORS headers on all responses

### Database
- Schema in `db.py` `init_db()` function
- Use `ON CONFLICT ... DO UPDATE` for upserts
- Always use parameterized queries (no f-strings in SQL)
- WAL mode + foreign keys enabled by default

## Model Routing Rules

When adding new AI calls in `serve.py`:
- `hermes:*` prefix → strip prefix, route to Hermes Gateway (port 8642), no auth
- `cx/*` prefix → route to Hermes Gateway as-is, no auth
- `kr/*` prefix → route to 9Router (port 20128), Bearer auth required
- `fireworks/*` prefix → route to 9Router as-is (keep full model ID), Bearer auth
- Default model for backend AI calls: `kr/claude-sonnet-4.6`

## Running Locally

```bash
# Backend (must run first — serves static files + API)
python3 serve.py  # port 3333

# Frontend dev server
cd app && npm run dev  # port 5173 (proxies to 3333)
```

## Key Patterns

### Adding a new DB endpoint
1. Add handler in `serve.py` `do_GET` or `do_POST`
2. Import from `db.py`, call `init_db()` first
3. Return JSON with `Content-Type: application/json`
4. Add CORS headers (handled by `end_headers()` override)

### Adding a new AI-powered feature
1. Add endpoint in `serve.py` `do_POST`
2. Build prompt with user profile context (fetch from `user_profile` table)
3. Route to appropriate model via `ROUTER_API` with Bearer auth
4. Parse JSON from AI response (handle markdown code fences)
5. Add frontend call in `useApi.ts`
6. Wire to component via Zustand store

### Adding a new Zustand store field
1. Add type to `src/types/index.ts`
2. Add field + action to store interface in `bountyStore.ts`
3. Add to persist whitelist if it should survive refresh

## State Persistence

- Zustand `persist` middleware saves to localStorage key `bounty-drafts`
- Analysis restored from localStorage on load (merged with `analysis.json`)
- Kanban statuses persisted in SQLite (source of truth)
- Bookmarks persisted in SQLite

## Don'ts

- Don't add new npm dependencies without explicit approval
- Don't use CSS frameworks (Tailwind, etc.) — project uses plain CSS
- Don't add authentication — this is a local-only tool
- Don't modify model routing logic without testing all prefixes
- Don't use `git add .` — stage specific files only
- Don't over-engineer — ship minimal, user will ask for additions
