#!/usr/bin/env python3
"""Auto-analyze new bounties via Hermes API. Stores results in SQLite DB."""

import json
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

from db import get_db, init_db, upsert_analysis, get_context_for_ai

HERMES_API = "http://127.0.0.1:8642/v1/chat/completions"
USER_SKILLS = "TypeScript, React, React Native, full-stack web dev, mobile dev, content writing (Bahasa Indonesia)"

def get_unanalyzed():
    """Get bounties that haven't been analyzed yet."""
    conn = get_db()
    rows = conn.execute("""
        SELECT b.* FROM bounties b
        LEFT JOIN analysis a ON b.id = a.bounty_id
        WHERE b.is_active = 1 AND a.bounty_id IS NULL
        ORDER BY b.reward_usd DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def analyze_bounty(bounty, ai_context):
    """Call Hermes API to analyze a single bounty."""
    prompt = f"""Analyze this bounty for a developer with skills: {USER_SKILLS}

{ai_context}

Bounty:
- Title: {bounty['title']}
- Source: {bounty['source']}
- Reward: {bounty['reward']}
- Type: {bounty['type']}
- Category: {bounty['category']}
- Deadline: {bounty.get('deadline', 'none')}
- URL: {bounty.get('url', '')}

Based on the developer's skills AND past learnings above, respond in this exact JSON format (no markdown, no code blocks):
{{"match_score": 1-10, "difficulty": "easy|medium|hard", "time_estimate": "1h|2-3h|1d|3d|1w", "summary": "1 sentence what this bounty needs", "strategy": "1-2 sentences how to win based on past learnings", "skills_needed": ["skill1", "skill2"], "verdict": "recommended|possible|skip"}}"""

    body = json.dumps({
        "model": "hermes-agent",
        "messages": [
            {"role": "system", "content": "You are a bounty analysis assistant. Return ONLY valid JSON, no markdown. Use past learnings to improve recommendations."},
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }).encode()

    req = urllib.request.Request(HERMES_API, data=body, method="POST")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            content = data["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(content)
    except (urllib.error.URLError, json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"  [ERROR] {e}")
        return None

def export_analysis_json():
    """Export analysis from DB to analysis.json for dashboard."""
    conn = get_db()
    rows = conn.execute("""
        SELECT a.*, b.title, b.source, b.reward
        FROM analysis a JOIN bounties b ON a.bounty_id = b.id
        WHERE b.is_active = 1
    """).fetchall()
    conn.close()
    
    result = {}
    for r in rows:
        result[r["bounty_id"]] = {
            "title": r["title"],
            "source": r["source"],
            "reward": r["reward"],
            "match_score": r["match_score"],
            "difficulty": r["difficulty"],
            "time_estimate": r["time_estimate"],
            "summary": r["summary"],
            "strategy": r["strategy"],
            "skills_needed": json.loads(r["skills_needed"]) if r["skills_needed"] else [],
            "verdict": r["verdict"],
        }
    
    out = Path(__file__).parent / "analysis.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    return len(result)

def main():
    init_db()
    
    unanalyzed = get_unanalyzed()
    if not unanalyzed:
        print("All active bounties already analyzed.")
        export_analysis_json()
        return

    # Get AI context (learnings from past bounties)
    ai_context = get_context_for_ai()
    if ai_context.strip() == "=== BOUNTY HUNTER LEARNINGS ===":
        ai_context = ""  # No learnings yet
    
    print(f"Analyzing {len(unanalyzed)} new bounties...")
    if ai_context:
        print("  (using past learnings for better recommendations)")
    
    analyzed = 0
    recommended = 0

    for i, bounty in enumerate(unanalyzed):
        print(f"  [{i+1}/{len(unanalyzed)}] {bounty['title'][:50]}...")
        result = analyze_bounty(bounty, ai_context)
        
        if result:
            upsert_analysis(bounty["id"], result)
            analyzed += 1
            if result.get("verdict") == "recommended":
                recommended += 1
                print(f"    ★ RECOMMENDED — score {result.get('match_score')}/10, {result.get('difficulty')}, ~{result.get('time_estimate')}")
            else:
                print(f"    → {result.get('verdict', '?')} — score {result.get('match_score', '?')}/10")
        else:
            print(f"    ✗ Failed to analyze")
        
        if i < len(unanalyzed) - 1:
            time.sleep(2)

    # Export to JSON for dashboard
    total_exported = export_analysis_json()
    
    print(f"\n✅ Done! {analyzed} analyzed, {recommended} recommended.")
    print(f"   {total_exported} total analyses exported to analysis.json")

    # Print top recommendations
    conn = get_db()
    recs = conn.execute("""
        SELECT a.*, b.title, b.reward FROM analysis a
        JOIN bounties b ON a.bounty_id = b.id
        WHERE a.verdict = 'recommended' AND b.is_active = 1
        ORDER BY a.match_score DESC LIMIT 5
    """).fetchall()
    conn.close()
    
    if recs:
        print(f"\n🎯 Top recommendations:")
        for r in recs:
            print(f"   [{r['match_score']}/10] {r['title'][:45]} — {r['reward']} ({r['difficulty']}, ~{r['time_estimate']})")
            print(f"         Strategy: {r['strategy']}")

if __name__ == "__main__":
    main()
