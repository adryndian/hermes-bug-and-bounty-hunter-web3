# Architecture Decision Records

## ADR-001: Single-file Python backend (no framework)

**Status**: Accepted  
**Date**: 2025-05

**Context**: Need a local HTTP server that proxies AI requests, serves static files, and provides DB endpoints.

**Decision**: Use Python stdlib `http.server` in a single `serve.py` file.

**Rationale**:
- Zero dependencies for core HTTP (only scraping libs added)
- Simple to understand and modify
- No framework overhead for a local-only tool
- Easy to start: `python3 serve.py`

**Consequences**: No middleware, no routing framework, manual CORS handling. Acceptable for local use.

---

## ADR-002: Zustand over Redux/Context

**Status**: Accepted  
**Date**: 2025-05

**Context**: Need state management for bounties, analysis, drafts, kanban statuses, chat, and UI state.

**Decision**: Single Zustand store with `persist` middleware.

**Rationale**:
- Minimal boilerplate vs Redux
- Built-in persistence to localStorage
- Selector pattern prevents unnecessary re-renders
- Single store keeps all state co-located

**Consequences**: Large store file (300+ lines). Acceptable given single-developer project.

---

## ADR-003: Multi-model AI routing via serve.py proxy

**Status**: Accepted  
**Date**: 2025-05

**Context**: Frontend needs to call different AI models (Claude, GPT, DeepSeek, etc.) without exposing API keys.

**Decision**: `serve.py` acts as proxy — routes based on model prefix to either Hermes Gateway or 9Router.

**Rationale**:
- API keys stay server-side
- Single `/api/v1/chat/completions` endpoint for frontend
- Model selection is just a string in the request body
- Easy to add new providers

**Consequences**: Model routing logic in serve.py must be maintained. Prefix conventions must be documented.

---

## ADR-004: SQLite for persistence (not JSON files)

**Status**: Accepted  
**Date**: 2025-05

**Context**: Initially used JSON files. Needed relational queries (status history, learnings aggregation, cross-bounty stats).

**Decision**: Migrate to SQLite with WAL mode. Keep JSON files as import source only.

**Rationale**:
- Relational queries for stats/context generation
- WAL mode for concurrent reads
- Foreign keys for data integrity
- Easy migration path from JSON (`db.py migrate`)

**Consequences**: Requires `sqlite3` (bundled with Python). DB file must not be committed to git.

---

## ADR-005: 5-step Draft Workspace pipeline

**Status**: Accepted  
**Date**: 2025-05

**Context**: Submitting bounties requires research, writing, and verification. Manual process is error-prone.

**Decision**: Structured 5-step pipeline: Research → Generate → Review → Finalize → Submit.

**Rationale**:
- Each step has clear input/output
- Steps 1-3 are AI-assisted (auto)
- Steps 4-5 are human-controlled (manual)
- State persisted per-bounty in localStorage
- Can resume from any step

**Consequences**: Complex DraftPanel component (460 lines). Each step needs its own API endpoint.

---

## ADR-006: Jina Reader as primary scraper

**Status**: Accepted  
**Date**: 2025-05

**Context**: Need to extract bounty page content for AI analysis. Many bounty pages are SPAs (React/Next.js).

**Decision**: 3-tier scraping: Jina Reader → trafilatura → BeautifulSoup.

**Rationale**:
- Jina handles JS-rendered pages (free, no API key)
- trafilatura for static pages with good content extraction
- BS4 as last resort fallback
- No headless browser needed

**Consequences**: Depends on external Jina service availability. Content limited to 4-6KB per page.
