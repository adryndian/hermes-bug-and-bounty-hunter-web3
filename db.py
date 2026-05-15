#!/usr/bin/env python3
"""SQLite database for Bounty Hunter — stores bounties, analysis, status history, and learnings."""

import sqlite3
import json
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / "bounty_hunter.db"

def get_db():
    """Get database connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    """Initialize database schema."""
    conn = get_db()
    conn.executescript("""
    -- Bounties: raw data from sources
    CREATE TABLE IF NOT EXISTS bounties (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT NOT NULL,
        reward TEXT,
        reward_usd REAL DEFAULT 0,
        deadline TEXT,
        url TEXT,
        sponsor TEXT,
        type TEXT,
        category TEXT,
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now')),
        is_active INTEGER DEFAULT 1
    );

    -- Analysis: AI-generated insights per bounty
    CREATE TABLE IF NOT EXISTS analysis (
        bounty_id TEXT PRIMARY KEY REFERENCES bounties(id),
        match_score INTEGER,
        difficulty TEXT,
        time_estimate TEXT,
        summary TEXT,
        strategy TEXT,
        skills_needed TEXT,  -- JSON array
        verdict TEXT,
        analyzed_at TEXT DEFAULT (datetime('now')),
        model_used TEXT DEFAULT 'hermes-agent'
    );

    -- Status tracking: kanban pipeline
    CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bounty_id TEXT REFERENCES bounties(id),
        status TEXT NOT NULL,
        changed_at TEXT DEFAULT (datetime('now')),
        notes TEXT
    );

    -- Current status view
    CREATE TABLE IF NOT EXISTS bounty_status (
        bounty_id TEXT PRIMARY KEY REFERENCES bounties(id),
        status TEXT NOT NULL DEFAULT 'none',
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Learnings: what worked, what didn't (for AI reference)
    CREATE TABLE IF NOT EXISTS learnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bounty_id TEXT REFERENCES bounties(id),
        outcome TEXT,  -- won, lost, skipped, expired
        reward_received REAL DEFAULT 0,
        time_spent TEXT,
        what_worked TEXT,
        what_failed TEXT,
        lesson TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- Bookmarks
    CREATE TABLE IF NOT EXISTS bookmarks (
        bounty_id TEXT PRIMARY KEY REFERENCES bounties(id),
        bookmarked_at TEXT DEFAULT (datetime('now'))
    );

    -- User profile: single-row JSON blob
    CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Workspace sessions: per-bounty co-pilot state
    CREATE TABLE IF NOT EXISTS workspace_sessions (
        bounty_id TEXT PRIMARY KEY REFERENCES bounties(id),
        session_id TEXT NOT NULL,
        checklist TEXT DEFAULT '[]',
        resources TEXT DEFAULT '[]',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Co-pilot action log
    CREATE TABLE IF NOT EXISTS copilot_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bounty_id TEXT REFERENCES bounties(id),
        action TEXT NOT NULL,
        prompt TEXT,
        response TEXT,
        model TEXT,
        tokens_used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_bounties_source ON bounties(source);
    CREATE INDEX IF NOT EXISTS idx_bounties_category ON bounties(category);
    CREATE INDEX IF NOT EXISTS idx_bounties_active ON bounties(is_active);
    CREATE INDEX IF NOT EXISTS idx_analysis_verdict ON analysis(verdict);
    CREATE INDEX IF NOT EXISTS idx_analysis_score ON analysis(match_score);
    CREATE INDEX IF NOT EXISTS idx_status_history_bounty ON status_history(bounty_id);
    CREATE INDEX IF NOT EXISTS idx_learnings_outcome ON learnings(outcome);
    """)
    conn.commit()
    conn.close()
    print("✓ Database initialized")

def upsert_bounties(bounties_list):
    """Insert or update bounties from fetch."""
    conn = get_db()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    # Mark all as potentially inactive
    conn.execute("UPDATE bounties SET is_active = 0")
    
    for b in bounties_list:
        conn.execute("""
            INSERT INTO bounties (id, source, title, reward, reward_usd, deadline, url, sponsor, type, category, last_seen, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET
                reward = excluded.reward,
                reward_usd = excluded.reward_usd,
                deadline = excluded.deadline,
                last_seen = excluded.last_seen,
                is_active = 1
        """, (b["id"], b["source"], b["title"], b["reward"], b.get("reward_usd", 0),
              b.get("deadline", ""), b.get("url", ""), b.get("sponsor", ""),
              b.get("type", ""), b.get("category", ""), now))
    
    conn.commit()
    active = conn.execute("SELECT COUNT(*) FROM bounties WHERE is_active=1").fetchone()[0]
    total = conn.execute("SELECT COUNT(*) FROM bounties").fetchone()[0]
    conn.close()
    print(f"✓ Bounties synced: {active} active, {total} total (incl. historical)")

def upsert_analysis(bounty_id, result):
    """Save analysis result."""
    conn = get_db()
    conn.execute("""
        INSERT INTO analysis (bounty_id, match_score, difficulty, time_estimate, summary, strategy, skills_needed, verdict)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(bounty_id) DO UPDATE SET
            match_score = excluded.match_score,
            difficulty = excluded.difficulty,
            time_estimate = excluded.time_estimate,
            summary = excluded.summary,
            strategy = excluded.strategy,
            skills_needed = excluded.skills_needed,
            verdict = excluded.verdict,
            analyzed_at = datetime('now')
    """, (bounty_id, result.get("match_score"), result.get("difficulty"),
          result.get("time_estimate"), result.get("summary"), result.get("strategy"),
          json.dumps(result.get("skills_needed", [])), result.get("verdict")))
    conn.commit()
    conn.close()

def set_status(bounty_id, status, notes=None):
    """Update bounty status and log history."""
    conn = get_db()
    conn.execute("""
        INSERT INTO bounty_status (bounty_id, status, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(bounty_id) DO UPDATE SET status = excluded.status, updated_at = datetime('now')
    """, (bounty_id, status))
    conn.execute("""
        INSERT INTO status_history (bounty_id, status, notes) VALUES (?, ?, ?)
    """, (bounty_id, status, notes))
    conn.commit()
    conn.close()

def add_learning(bounty_id, outcome, reward_received=0, time_spent="", what_worked="", what_failed="", lesson=""):
    """Record a learning from a bounty attempt."""
    conn = get_db()
    conn.execute("""
        INSERT INTO learnings (bounty_id, outcome, reward_received, time_spent, what_worked, what_failed, lesson)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (bounty_id, outcome, reward_received, time_spent, what_worked, what_failed, lesson))
    conn.commit()
    conn.close()

def get_context_for_ai():
    """Generate context string for Hermes AI — learnings, stats, patterns."""
    conn = get_db()
    
    # Win/loss stats
    stats = conn.execute("""
        SELECT outcome, COUNT(*) as cnt, SUM(reward_received) as total_reward
        FROM learnings GROUP BY outcome
    """).fetchall()
    
    # Recent learnings
    recent = conn.execute("""
        SELECT l.lesson, l.outcome, l.what_worked, b.category, b.type
        FROM learnings l JOIN bounties b ON l.bounty_id = b.id
        ORDER BY l.created_at DESC LIMIT 10
    """).fetchall()
    
    # Best performing categories
    best_cats = conn.execute("""
        SELECT b.category, COUNT(*) as wins, AVG(l.reward_received) as avg_reward
        FROM learnings l JOIN bounties b ON l.bounty_id = b.id
        WHERE l.outcome = 'won'
        GROUP BY b.category ORDER BY wins DESC
    """).fetchall()
    
    # Analysis patterns
    analyzed = conn.execute("""
        SELECT verdict, COUNT(*) as cnt, AVG(match_score) as avg_score
        FROM analysis GROUP BY verdict
    """).fetchall()
    
    conn.close()
    
    context = "=== BOUNTY HUNTER LEARNINGS ===\n"
    
    if stats:
        context += "\nStats:\n"
        for s in stats:
            context += f"  {s['outcome']}: {s['cnt']} bounties, ${s['total_reward'] or 0:.0f} earned\n"
    
    if best_cats:
        context += "\nBest categories:\n"
        for c in best_cats:
            context += f"  {c['category']}: {c['wins']} wins, avg ${c['avg_reward'] or 0:.0f}\n"
    
    if recent:
        context += "\nRecent lessons:\n"
        for r in recent:
            if r['lesson']:
                context += f"  [{r['outcome']}] {r['lesson']}\n"
    
    if analyzed:
        context += "\nAnalysis summary:\n"
        for a in analyzed:
            context += f"  {a['verdict']}: {a['cnt']} bounties, avg score {a['avg_score'] or 0:.1f}\n"
    
    return context

def export_for_dashboard():
    """Export data as JSON for the dashboard."""
    conn = get_db()
    
    bounties = [dict(r) for r in conn.execute("""
        SELECT b.*, a.match_score, a.difficulty, a.time_estimate, a.summary, 
               a.strategy, a.verdict, a.skills_needed,
               bs.status as current_status
        FROM bounties b
        LEFT JOIN analysis a ON b.id = a.bounty_id
        LEFT JOIN bounty_status bs ON b.id = bs.bounty_id
        WHERE b.is_active = 1
        ORDER BY a.match_score DESC NULLS LAST
    """).fetchall()]
    
    learnings_ctx = get_context_for_ai()
    
    stats = {
        "total_active": len(bounties),
        "analyzed": conn.execute("SELECT COUNT(*) FROM analysis").fetchone()[0],
        "recommended": conn.execute("SELECT COUNT(*) FROM analysis WHERE verdict='recommended'").fetchone()[0],
        "total_historical": conn.execute("SELECT COUNT(*) FROM bounties").fetchone()[0],
        "learnings_count": conn.execute("SELECT COUNT(*) FROM learnings").fetchone()[0],
    }
    
    conn.close()
    return {"bounties": bounties, "stats": stats, "ai_context": learnings_ctx}

def migrate_from_json():
    """Migrate existing JSON files to database."""
    data_file = Path(__file__).parent / "bounties.json"
    analysis_file = Path(__file__).parent / "analysis.json"
    
    if data_file.exists():
        data = json.loads(data_file.read_text())
        upsert_bounties(data.get("bounties", []))
        print(f"  Migrated {len(data.get('bounties', []))} bounties from JSON")
    
    if analysis_file.exists():
        analyses = json.loads(analysis_file.read_text())
        for bounty_id, result in analyses.items():
            upsert_analysis(bounty_id, result)
        print(f"  Migrated {len(analyses)} analyses from JSON")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "migrate":
        init_db()
        migrate_from_json()
        print("\n✅ Migration complete!")
    elif len(sys.argv) > 1 and sys.argv[1] == "context":
        init_db()
        print(get_context_for_ai())
    else:
        init_db()
        print("Usage:")
        print("  python3 db.py          — init database")
        print("  python3 db.py migrate  — migrate from JSON files")
        print("  python3 db.py context  — show AI context")
