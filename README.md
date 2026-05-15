# Bounty Hunter

AI-driven local dashboard for Web3 bounty hunting. Analyze, strategize, and execute bounties with an AI co-pilot that assists at every step — from discovery to submission.

## What is this?

Bounty Hunter is a personal command center for Web3 bounty hunters. Instead of juggling browser tabs, spreadsheets, and chat windows, you get a single dashboard that:

- **Aggregates bounties** from multiple platforms (Superteam Earn, Code4rena, Immunefi, Sherlock)
- **AI-analyzes each bounty** against your skill profile — scoring difficulty, match, and strategy
- **Guides you through execution** with a step-by-step workspace powered by AI co-pilot
- **Tracks progress** via Kanban board with automatic status transitions

## AI Co-Pilot

The core differentiator. Every bounty gets an AI workspace with:

| Step | What the AI does |
|------|-----------------|
| **Research** | Scrapes bounty page, structures requirements, identifies deliverables |
| **Generate** | Produces execution checklist based on research + your profile |
| **Execute** | Interactive checklist + chat — ask questions, get guidance in context |
| **Finalize** | Review, polish, prepare submission |

The co-pilot uses [Hermes Agent](https://github.com/nousresearch/hermes-agent) as its brain — each bounty gets an isolated AI session with full context of that specific bounty. You stay in control: AI assists, you decide.

### Model Routing

Supports any OpenAI-compatible endpoint. Configure multiple backends:

- **Hermes Gateway** — local agent server for complex reasoning
- **9Router** — multi-provider gateway (Claude, GPT, DeepSeek, Kimi, etc.)
- **Any OpenAI-compatible API** — bring your own endpoint

## Features

- **Universal Bounty Intake** — paste any URL (Gitcoin, Discord, blog post) → AI extracts and analyzes
- **Smart Kanban** — auto-moves cards as you progress through workspace steps
- **X Search** — 30+ curated search queries to discover bounties on X/Twitter
- **Multi-model chat** — pick the right model for each task
- **Profile-aware scoring** — AI knows your skills and recommends accordingly
- **Fully local** — your data stays on your machine, no cloud dependency

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Zustand |
| UI | Custom CSS, @dnd-kit for Kanban drag-drop |
| Backend | Python `serve.py` (stdlib http.server) |
| Database | SQLite (WAL mode) |
| AI | Multi-model via configurable OpenAI-compatible endpoints |

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 20+
- An OpenAI-compatible LLM endpoint (local or remote)

### Setup

```bash
git clone https://github.com/adryndian/bounty-hunter.git
cd bounty-hunter

# Configure your AI endpoints
cp .env.example .env
# Edit .env with your API URLs and keys

# Install frontend
cd app && npm install --include=dev && cd ..

# Start (both backend + frontend)
./start.sh
# Or manually:
# Terminal 1: python3 serve.py
# Terminal 2: cd app && npm run dev
```

Open `http://localhost:5173`

### Environment Variables

```env
LLM_API_URL=http://127.0.0.1:8642      # Primary LLM endpoint
LLM_API_KEY=your-key                     # API key for primary
LLM_ROUTER_URL=http://127.0.0.1:20128   # Secondary router (optional)
LLM_ROUTER_KEY=your-router-key           # Router API key
LLM_DEFAULT_MODEL=your-model-name        # Default model for analysis
API_SERVER_KEY=your-hermes-key           # Hermes Agent API key (for co-pilot)
```

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
│  - AI co-pilot endpoints (research, generate, chat) │
│  - DB CRUD + status tracking                        │
│  - URL scraping (Jina → BS4 fallback)               │
│  - Model routing (multi-backend)                    │
└────────┬────────────────────┬───────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│  SQLite DB      │  │  AI Backends       │
│  (local file)   │  │  (configurable)    │
└─────────────────┘  └────────────────────┘
```

## Kanban Flow

```
Draft → Todo → In Progress → Ready → Submitted → Won
                                                  └→ Lost
                                                  └→ Archived
```

Status transitions happen automatically as you progress through workspace steps, or manually via drag-and-drop.

## License

MIT
