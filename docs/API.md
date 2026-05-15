# API Reference

## Model Routing

All AI requests go through `POST /api/v1/chat/completions` with OpenAI-compatible format.

### Model Prefixes

| Prefix | Backend | Port | Auth | Example |
|--------|---------|------|------|---------|
| `hermes:` | Hermes Gateway | 8642 | None | `hermes:cx/gpt-5.5` |
| `cx/` | Hermes Gateway | 8642 | None | `cx/gpt-5.5` |
| `kr/` | 9Router | 20128 | Bearer | `kr/claude-sonnet-4.6` |
| `fireworks/` | 9Router | 20128 | Bearer | `fireworks/accounts/fireworks/models/deepseek-v4-pro` |

### Available Models (ChatModel type)

```typescript
type ChatModel =
  | 'kr/claude-opus-4.7'
  | 'kr/claude-opus-4.6'
  | 'kr/claude-sonnet-4.6'
  | 'kr/claude-sonnet-4.5'
  | 'fireworks/accounts/fireworks/models/deepseek-v4-pro'
  | 'fireworks/accounts/fireworks/models/kimi-k2p6'
  | 'fireworks/accounts/fireworks/models/minimax-m2p7'
  | 'hermes:cx/gpt-5.5'
  | 'hermes:cx/gpt-5.4'
  | 'hermes:cx/gpt-5.3-codex-high'
  | 'hermes:cx/gpt-5.3-codex-xhigh'
```

---

## DB Endpoints

### GET /db/stats

Returns dashboard statistics.

**Response:**
```json
{
  "total_bounties": 43,
  "active_bounties": 43,
  "analyzed": 43,
  "recommended": 1,
  "learnings": 0,
  "wins": 0,
  "total_earned": 0
}
```

### GET /db/statuses

Returns all current kanban statuses.

**Response:**
```json
{
  "bounty-id-1": "interested",
  "bounty-id-2": "submitted"
}
```

### GET /db/bookmarks

Returns array of bookmarked bounty IDs.

**Response:**
```json
["bounty-id-1", "bounty-id-2"]
```

### GET /db/context

Returns AI context string generated from learnings/stats.

**Response:**
```json
{
  "context": "=== BOUNTY HUNTER LEARNINGS ===\nStats:\n  won: 2 bounties, $500 earned\n..."
}
```

### GET /db/history/:bounty_id

Returns status change history for a bounty.

**Response:**
```json
[
  {"id": 1, "bounty_id": "abc", "status": "submitted", "changed_at": "2025-05-09T12:00:00", "notes": null},
  {"id": 2, "bounty_id": "abc", "status": "interested", "changed_at": "2025-05-08T10:00:00", "notes": null}
]
```

### GET /db/user-profile

Returns user profile (or defaults if not set).

**Response:**
```json
{
  "skills": ["TypeScript", "React", "React Native", "Next.js", "Node.js", "Content Writing"],
  "experience_level": "intermediate",
  "languages": ["Bahasa Indonesia", "English"],
  "focus_areas": ["Frontend", "Content", "Full-stack"],
  "notes": "Learning Solidity and smart contract security."
}
```

### POST /db/status

Set bounty kanban status.

**Request:**
```json
{
  "bounty_id": "abc-123",
  "status": "interested",
  "notes": "optional note"
}
```

### POST /db/learning

Record outcome from a bounty attempt.

**Request:**
```json
{
  "bounty_id": "abc-123",
  "outcome": "won",
  "reward_received": 500,
  "time_spent": "3 days",
  "what_worked": "Strong technical writing",
  "what_failed": "Initial approach too broad",
  "lesson": "Focus on specific deliverables first"
}
```

### POST /db/bookmark

Toggle bookmark for a bounty.

**Request:**
```json
{
  "bounty_id": "abc-123"
}
```

**Response:**
```json
{
  "ok": true,
  "bookmarked": true
}
```

### POST /db/user-profile

Save/update user profile.

**Request:**
```json
{
  "skills": ["TypeScript", "React"],
  "experience_level": "intermediate",
  "languages": ["English"],
  "focus_areas": ["Frontend"],
  "notes": "Learning Solidity"
}
```

---

## AI Pipeline Endpoints

### POST /api/draft-research

Step 1: Deep research on a bounty. Scrapes page content + AI structures findings.

**Request:**
```json
{
  "bounty": {
    "title": "Build DeFi Dashboard",
    "url": "https://earn.superteam.fun/...",
    "source": "superteam"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "research": {
    "title": "Build DeFi Dashboard",
    "source": "superteam",
    "url": "https://...",
    "content": "scraped text...",
    "links": ["https://github.com/..."],
    "structured": {
      "scope": "Build a responsive DeFi dashboard...",
      "requirements": ["React frontend", "API integration"],
      "deliverables": ["Working dashboard", "Documentation"],
      "judging_criteria": ["Code quality", "UX"],
      "relevant_links": [],
      "skill_match": "Strong match with React/TS skills",
      "difficulty": "medium",
      "estimated_hours": 20,
      "key_challenges": ["Real-time data", "Multi-chain support"],
      "recommended_approach": "Start with Vite + React..."
    }
  }
}
```

### POST /api/draft-generate

Step 2: Generate submission draft from research.

**Request:**
```json
{
  "bounty": { "title": "...", "source": "...", "type": "development", "reward": "$500" },
  "research": { "structured": { "scope": "...", "requirements": [...] } }
}
```

**Response:**
```json
{
  "ok": true,
  "draft": "# Submission\n\n## Introduction\n..."
}
```

### POST /api/draft-verify

Step 3: Verify draft against requirements.

**Request:**
```json
{
  "draft": "# Submission\n...",
  "research": { "structured": { "requirements": [...], "deliverables": [...] } }
}
```

**Response:**
```json
{
  "ok": true,
  "verification": {
    "score": 8,
    "checklist": [
      {"item": "React frontend", "met": true, "note": "Clearly addressed"},
      {"item": "Documentation", "met": false, "note": "Missing docs section"}
    ],
    "suggestions": ["Add timeline section", "Include code samples"],
    "missing": ["Documentation plan"],
    "ready_to_submit": false
  }
}
```

### GET /api/fetch-bounty-detail?url=URL

Scrape and extract clean text from a bounty page.

**Response:**
```json
{
  "ok": true,
  "content": "extracted text content...",
  "title": "Page Title"
}
```

### POST /api/bounties/refresh

Re-fetch bounties from sources (runs `fetch_bounties.py`).

**Response:**
```json
{
  "ok": true,
  "count": 43
}
```
