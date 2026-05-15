# Development Guide

## Prerequisites

- Python 3.12+
- Node.js 20+
- npm 10+
- Local services running:
  - Hermes Gateway on port 8642 (optional, for `hermes:` and `cx/` models)
  - 9Router on port 20128 (for `kr/` and `fireworks/` models)

## Setup

```bash
cd ~/Desktop/bounty-hunter

# Install Python scraping deps (optional, for bounty detail fetching)
pip install requests trafilatura beautifulsoup4

# Install frontend deps
cd app
npm install
```

## Development

```bash
# Terminal 1: Backend
python3 serve.py
# Serves on http://localhost:3333
# Endpoints: /api/*, /db/*

# Terminal 2: Frontend
cd app
npm run dev
# Vite dev server on http://localhost:5173
# Auto-proxies API calls to :3333
```

## Database Management

```bash
# Initialize (auto-runs on first serve.py start)
python3 db.py

# Migrate from JSON files to SQLite
python3 db.py migrate

# View AI context (learnings summary)
python3 db.py context

# Direct DB access
sqlite3 bounty_hunter.db
```

### Useful Queries

```sql
-- Top bounties by reward
SELECT title, reward, reward_usd, source FROM bounties
WHERE is_active=1 ORDER BY reward_usd DESC LIMIT 10;

-- Analysis summary
SELECT verdict, COUNT(*), AVG(match_score) FROM analysis GROUP BY verdict;

-- Kanban pipeline
SELECT bs.status, COUNT(*), GROUP_CONCAT(b.title, ', ')
FROM bounty_status bs JOIN bounties b ON bs.bounty_id = b.id
GROUP BY bs.status;

-- Learnings
SELECT outcome, COUNT(*), SUM(reward_received) FROM learnings GROUP BY outcome;
```

## Adding New Bounty Sources

1. Create fetcher function that returns array of:
```python
{
    "id": "source-unique-id",
    "source": "platform-name",
    "title": "Bounty Title",
    "reward": "$500 USDC",
    "reward_usd": 500.0,
    "deadline": "2025-06-01",
    "url": "https://...",
    "sponsor": "Project Name",
    "type": "content|development|security|design",
    "category": "defi|nft|infrastructure|..."
}
```
2. Add to fetch pipeline (currently manual via `bounties.json`)
3. Run `python3 db.py migrate` to sync to SQLite

## Frontend Component Guide

| Component | Responsibility |
|-----------|---------------|
| `BountyGrid` | Grid layout, tab filtering, sort controls |
| `BountyCard` | Single bounty display, analyze trigger, status dropdown |
| `KanbanBoard` | Drag-drop columns, status management |
| `DraftPanel` | 5-step workspace, AI pipeline controls |
| `Topbar` | Tab navigation, search, refresh button |
| `UserProfileModal` | Edit skills/experience/focus areas |
| `Tooltip` | Reusable tooltip component |

## Testing

No test framework currently set up. Manual testing:

1. Start backend + frontend
2. Verify bounties load in grid
3. Test analyze on a bounty card
4. Test kanban drag-drop
5. Test draft workspace pipeline
6. Test chat with different models

## Build for Production

```bash
cd app
npm run build
# Output in app/dist/
# Serve via serve.py (it serves static files from project root)
```
