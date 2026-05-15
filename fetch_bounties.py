#!/usr/bin/env python3
"""Fetch bounties from public APIs, generate dashboard HTML, notify on new high-value bounties."""

import json
import os
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import requests

OUT_DIR = Path(__file__).parent
DATA_FILE = OUT_DIR / "bounties.json"
PREV_FILE = OUT_DIR / "bounties_prev.json"
HTML_FILE = OUT_DIR / "index.html"
BOOKMARKS_FILE = OUT_DIR / "bookmarks.json"
NOTIFY_THRESHOLD = 500  # USD

def notify_macos(title, message):
    """Send macOS notification."""
    try:
        subprocess.run([
            "osascript", "-e",
            f'display notification "{message}" with title "{title}"'
        ], check=True, capture_output=True)
    except Exception:
        pass

def load_bookmarks():
    """Load saved bookmarks."""
    if BOOKMARKS_FILE.exists():
        return json.loads(BOOKMARKS_FILE.read_text())
    return []

def fetch_superteam():
    """Fetch from Superteam Earn API."""
    bounties = []
    try:
        r = requests.get("https://superteam.fun/api/listings/?take=30", timeout=15)
        r.raise_for_status()
        data = r.json()
        for item in data:
            if item.get("status") != "OPEN":
                continue
            bounties.append({
                "id": f"superteam-{item.get('id', '')}",
                "source": "Superteam Earn",
                "title": item.get("title", ""),
                "reward": f"${item.get('rewardAmount', 0):,.0f} {item.get('token', 'USDC')}",
                "reward_usd": item.get("rewardAmount", 0) or 0,
                "deadline": item.get("deadline", ""),
                "url": f"https://superteam.fun/earn/listing/{item.get('slug', '')}",
                "sponsor": item.get("sponsor", {}).get("name", ""),
                "type": item.get("type", "bounty"),
                "category": "content" if item.get("type") in ["content", "design"] else "dev",
            })
    except Exception as e:
        print(f"[WARN] Superteam: {e}", file=sys.stderr)
    return bounties

def fetch_code4rena():
    """Fetch from Code4rena audits API."""
    bounties = []
    try:
        r = requests.get("https://code4rena.com/api/v1/audits", timeout=15)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict):
            items = data.get("data", data.get("audits", []))
        elif isinstance(data, list):
            items = data
        else:
            items = []
        if not isinstance(items, list):
            items = []
        for item in items[0:30]:
            if not isinstance(item, dict):
                continue
            status = str(item.get("status", "")).lower()
            if "live" not in status and "upcoming" not in status:
                continue
            prize = item.get("prize", item.get("totalPrize", 0)) or 0
            title = item.get("title", item.get("project", "Audit Contest"))
            slug = item.get("slug", "")
            bounties.append({
                "id": f"c4a-{slug or title}",
                "source": "Code4rena",
                "title": title,
                "reward": f"${prize:,.0f} USDC",
                "reward_usd": prize,
                "deadline": item.get("endDate", item.get("end_date", "")),
                "url": f"https://code4rena.com/audits/{slug}" if slug else "https://code4rena.com/audits",
                "sponsor": item.get("sponsor", ""),
                "type": "audit",
                "category": "smart-contract",
            })
    except Exception as e:
        print(f"[WARN] Code4rena: {e}", file=sys.stderr)
    return bounties

def fetch_immunefi():
    """Fetch from Immunefi unofficial GitHub JSON."""
    bounties = []
    try:
        r = requests.get(
            "https://raw.githubusercontent.com/infosec-us-team/Immunefi-Bug-Bounty-Programs-Unofficial/main/projects.json",
            timeout=15
        )
        r.raise_for_status()
        data = r.json()
        sorted_data = sorted(data, key=lambda x: x.get("maxBounty", 0), reverse=True)
        for item in sorted_data[:20]:
            slug = item.get("id", item.get("slug", ""))
            bounties.append({
                "id": f"immunefi-{slug}",
                "source": "Immunefi",
                "title": item.get("project", item.get("name", "")),
                "reward": f"${item.get('maxBounty', 0):,.0f} max",
                "reward_usd": item.get("maxBounty", 0) or 0,
                "deadline": "",
                "url": f"https://immunefi.com/bug-bounty/{slug}/",
                "sponsor": item.get("project", ""),
                "type": "bug-bounty",
                "category": "smart-contract",
            })
    except Exception as e:
        print(f"[WARN] Immunefi: {e}", file=sys.stderr)
    return bounties

def fetch_sherlock():
    """Fetch from Sherlock audits."""
    bounties = []
    try:
        r = requests.get("https://mainnet-contest.sherlock.xyz/contests", timeout=15)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list):
            data = []
        for item in data[:15]:
            if not isinstance(item, dict):
                continue
            status = str(item.get("status", "")).lower()
            if status not in ("active", "upcoming", "open"):
                continue
            prize = item.get("prize_pool", item.get("rewards", 0)) or 0
            title = item.get("title", item.get("name", "Sherlock Audit"))
            bounties.append({
                "id": f"sherlock-{item.get('id', title)}",
                "source": "Sherlock",
                "title": title,
                "reward": f"${prize:,.0f} USDC",
                "reward_usd": prize,
                "deadline": item.get("end_date", item.get("judging_end_date", "")),
                "url": f"https://audits.sherlock.xyz/contests/{item.get('id', '')}",
                "sponsor": item.get("sponsor", ""),
                "type": "audit",
                "category": "smart-contract",
            })
    except Exception as e:
        print(f"[WARN] Sherlock: {e}", file=sys.stderr)
    return bounties

def fetch_all():
    """Fetch from all sources."""
    # Save previous data for diff
    if DATA_FILE.exists():
        PREV_FILE.write_text(DATA_FILE.read_text())

    print("Fetching Superteam Earn...")
    superteam = fetch_superteam()
    print(f"  -> {len(superteam)} bounties")

    print("Fetching Code4rena...")
    code4rena = fetch_code4rena()
    print(f"  -> {len(code4rena)} audits")

    print("Fetching Immunefi...")
    immunefi = fetch_immunefi()
    print(f"  -> {len(immunefi)} programs")

    print("Fetching Sherlock...")
    sherlock = fetch_sherlock()
    print(f"  -> {len(sherlock)} audits")

    all_bounties = superteam + code4rena + immunefi + sherlock

    result = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "total": len(all_bounties),
        "bounties": all_bounties,
    }

    DATA_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nTotal: {len(all_bounties)} bounties saved to {DATA_FILE.name}")
    return result

def check_new_bounties(data):
    """Compare with previous fetch and notify on new high-value bounties."""
    if not PREV_FILE.exists():
        return

    prev = json.loads(PREV_FILE.read_text())
    prev_ids = {b["id"] for b in prev.get("bounties", []) if "id" in b}
    
    new_high_value = []
    for b in data["bounties"]:
        if b["id"] not in prev_ids and b["reward_usd"] >= NOTIFY_THRESHOLD:
            new_high_value.append(b)

    if new_high_value:
        print(f"\n🔔 {len(new_high_value)} NEW bounties >= ${NOTIFY_THRESHOLD}:")
        for b in new_high_value:
            print(f"   [{b['source']}] {b['title']} — {b['reward']}")
            notify_macos("🎯 New Bounty!", f"{b['title']} — {b['reward']} ({b['source']})")

def generate_html(data):
    """Generate the dashboard HTML - DeepSeek TUI inspired + glass + Codex chatbox."""
    import json
    bounties = data["bounties"]
    fetched_at = data["fetched_at"]
    bookmarks = load_bookmarks()
    bookmark_ids = [b["id"] for b in bookmarks]

    bounties_json = json.dumps(bounties, ensure_ascii=False)
    bookmark_ids_json = json.dumps(bookmark_ids)

    html = f'''<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bounty Hunter</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
  --bg: #fafafa;
  --bg-glass: rgba(255,255,255,0.72);
  --bg-card: rgba(255,255,255,0.6);
  --border: rgba(0,0,0,0.06);
  --border-strong: rgba(0,0,0,0.1);
  --text: #1a1a1a;
  --text-muted: #6b7280;
  --text-light: #9ca3af;
  --accent: #2563eb;
  --green: #059669;
  --green-bg: #ecfdf5;
  --purple: #7c3aed;
  --purple-bg: #f5f3ff;
  --yellow: #d97706;
  --yellow-bg: #fffbeb;
  --red: #dc2626;
  --blur: 16px;
  --radius: 12px;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-display: 'Instrument Serif', Georgia, serif;
  --mono: 'JetBrains Mono', 'SF Mono', monospace;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
  padding-bottom: 120px;
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.04) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 0%, rgba(16,185,129,0.04) 0%, transparent 50%);
}}
.topbar {{
  position: sticky; top: 0; z-index: 100;
  background: var(--bg-glass);
  backdrop-filter: blur(var(--blur));
  -webkit-backdrop-filter: blur(var(--blur));
  border-bottom: 1px solid var(--border);
  padding: 10px 0;
}}
.topbar-inner {{
  max-width: 1200px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between;
}}
.logo {{
  font-family: var(--font-display);
  font-size: 20px; color: var(--text);
  display: flex; align-items: center; gap: 10px;
  text-decoration: none;
}}
.logo-mark {{
  width: 28px; height: 28px; background: var(--text);
  border-radius: 6px; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 13px; font-weight: 800; font-family: var(--font);
}}
.topbar-nav {{ display: flex; align-items: center; gap: 2px; }}
.topbar-nav button {{
  padding: 6px 14px; border-radius: 8px; font-size: 12px;
  font-weight: 500; cursor: pointer; border: none;
  background: none; color: var(--text-muted); transition: all 0.15s;
  font-family: var(--font);
}}
.topbar-nav button:hover {{ background: rgba(0,0,0,0.04); color: var(--text); }}
.topbar-nav button.active {{ background: var(--text); color: #fff; }}
.topbar-right {{ display: flex; align-items: center; gap: 10px; }}
.pill {{
  font-size: 11px; padding: 4px 10px; border-radius: 20px;
  background: var(--bg-glass); border: 1px solid var(--border);
  color: var(--text-muted); font-weight: 500;
  backdrop-filter: blur(8px);
}}
.pill strong {{ color: var(--text); }}
.sort-sel {{
  font-size: 12px; padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-glass);
  color: var(--text); cursor: pointer; font-family: var(--font);
}}
.hero {{
  max-width: 1200px; margin: 0 auto; padding: 48px 24px 28px;
}}
.hero h1 {{
  font-family: var(--font-display);
  font-size: 36px; font-weight: 400; letter-spacing: -0.3px;
  margin-bottom: 8px;
}}
.hero p {{ font-size: 14px; color: var(--text-muted); max-width: 520px; }}
.meta-row {{ display: flex; gap: 24px; margin-top: 20px; flex-wrap: wrap; }}
.meta-item {{
  font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
  color: var(--text-light); font-weight: 600;
}}
.meta-item span {{
  color: var(--text); font-weight: 700; font-size: 18px;
  font-family: var(--mono); display: block; margin-bottom: 2px;
}}
.container {{ max-width: 1200px; margin: 0 auto; padding: 0 24px; }}
.section-label {{
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; color: var(--text-light);
  margin: 32px 0 14px; padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}}
.grid {{
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
}}
.card {{
  background: var(--bg-card);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius); padding: 16px;
  text-decoration: none; color: var(--text);
  transition: all 0.2s; position: relative;
  display: flex; flex-direction: column; gap: 8px;
}}
.card:hover {{
  border-color: var(--border-strong);
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  transform: translateY(-2px);
}}
.card-title {{ font-size: 14px; font-weight: 600; line-height: 1.4; padding-right: 28px; }}
.card-meta {{ display: flex; align-items: center; gap: 10px; }}
.reward {{ font-size: 14px; font-weight: 600; color: var(--green); font-family: var(--mono); }}
.deadline-badge {{
  font-size: 10px; font-weight: 600; padding: 2px 8px;
  border-radius: 10px; background: var(--yellow-bg); color: var(--yellow);
}}
.deadline-badge.expired {{ background: #fef2f2; color: var(--red); }}
.card-footer {{ display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }}
.tag {{
  font-size: 9px; font-weight: 600; padding: 3px 8px;
  border-radius: 4px; text-transform: uppercase; letter-spacing: 0.4px;
}}
.tag-content {{ background: var(--green-bg); color: var(--green); }}
.tag-dev {{ background: #eff6ff; color: var(--accent); }}
.tag-sc {{ background: var(--purple-bg); color: var(--purple); }}
.tag-default {{ background: var(--yellow-bg); color: var(--yellow); }}
.source-label {{ font-size: 10px; color: var(--text-light); margin-left: auto; }}
.bookmark-btn {{
  position: absolute; top: 12px; right: 12px;
  background: none; border: none; cursor: pointer;
  font-size: 14px; opacity: 0.3; transition: opacity 0.15s; padding: 2px;
}}
.bookmark-btn:hover {{ opacity: 0.8; }}
.bookmark-btn.saved {{ opacity: 1; }}
.x-grid {{
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px;
}}
.x-btn {{
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border: 1px solid var(--border);
  border-radius: var(--radius); text-decoration: none;
  color: var(--text-muted); font-size: 12px; transition: all 0.15s;
  background: var(--bg-card); backdrop-filter: blur(8px);
}}
.x-btn:hover {{ border-color: #1d9bf0; color: #1d9bf0; background: #f0f9ff; }}
.x-btn .xi {{ color: #1d9bf0; font-weight: 700; font-size: 14px; }}
.panel {{ display: none; }}
.panel.active {{ display: block; }}
.empty {{ text-align: center; padding: 60px 20px; color: var(--text-light); }}
.empty-icon {{ font-size: 32px; margin-bottom: 8px; }}
.chat-backdrop {{
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: center;
  padding: 0 24px 20px; pointer-events: none; z-index: 1000;
}}
.chat-container {{ width: 100%; max-width: 640px; pointer-events: all; }}
.chat-messages-panel {{
  max-height: 0; overflow: hidden; transition: max-height 0.3s ease;
  background: var(--bg-glass);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-bottom: none; border-radius: 16px 16px 0 0;
  margin-bottom: -1px;
}}
.chat-messages-panel.open {{
  max-height: 340px; overflow-y: auto; padding: 16px;
  display: flex; flex-direction: column; gap: 8px;
}}
.chat-msg {{
  padding: 10px 14px; border-radius: 10px;
  font-size: 13px; line-height: 1.5; max-width: 85%; word-wrap: break-word;
}}
.chat-user {{
  background: var(--text); color: #fff;
  align-self: flex-end; border-bottom-right-radius: 3px;
}}
.chat-assistant {{
  background: #fff; color: var(--text);
  border: 1px solid var(--border);
  align-self: flex-start; border-bottom-left-radius: 3px;
}}
.typing {{ color: var(--text-muted); font-style: italic; }}
.chat-input-bar {{
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-glass);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 14px; padding: 12px 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03);
  transition: border-color 0.2s, box-shadow 0.2s;
}}
.chat-input-bar:focus-within {{
  border-color: rgba(37,99,235,0.3);
  box-shadow: 0 8px 32px rgba(37,99,235,0.08), 0 2px 8px rgba(0,0,0,0.03);
}}
.chat-input-bar textarea {{
  flex: 1; border: none; outline: none; resize: none;
  font-size: 14px; font-family: var(--font); color: var(--text);
  background: transparent; line-height: 1.5; max-height: 100px;
}}
.chat-input-bar textarea::placeholder {{ color: var(--text-light); }}
.chat-send-btn {{
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--text); border: none; color: #fff;
  font-size: 14px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}}
.chat-send-btn:hover {{ background: var(--accent); }}
.chat-hint {{
  text-align: center; font-size: 11px; color: var(--text-light);
  margin-top: 6px; font-family: var(--mono);
}}
.footer {{
  max-width: 1200px; margin: 40px auto 0; padding: 20px 24px;
  border-top: 1px solid var(--border);
  font-size: 11px; color: var(--text-light); text-align: center;
}}
.footer a {{ color: var(--text-muted); text-decoration: none; }}
.footer a:hover {{ color: var(--accent); }}
.footer code {{
  background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px;
  font-family: var(--mono); font-size: 11px;
}}
@media (max-width: 640px) {{
  .hero h1 {{ font-size: 26px; }}
  .grid {{ grid-template-columns: 1fr; }}
  .topbar-nav {{ display: none; }}
  .chat-container {{ max-width: 100%; }}
}}
</style>
</head>
<body>
<div class="topbar"><div class="topbar-inner">
  <a class="logo" href="#"><div class="logo-mark">B</div>Bounty Hunter</a>
  <div class="topbar-nav">
    <button class="active" onclick="switchTab('all')">All</button>
    <button onclick="switchTab('search')">X Search</button>
    <button onclick="switchTab('superteam')">Superteam</button>
    <button onclick="switchTab('code4rena')">Code4rena</button>
    <button onclick="switchTab('immunefi')">Immunefi</button>
    <button onclick="switchTab('sherlock')">Sherlock</button>
    <button onclick="switchTab('bookmarks')">Saved</button>
  </div>
  <div class="topbar-right">
    <span class="pill"><strong>{data["total"]}</strong> bounties</span>
    <select class="sort-sel" id="sort-select" onchange="applySort()">
      <option value="reward-desc">Reward down</option>
      <option value="reward-asc">Reward up</option>
      <option value="deadline">Deadline</option>
      <option value="source">Source</option>
    </select>
  </div>
</div></div>
<div class="hero">
  <h1>Find bounties. Ship work. Get paid.</h1>
  <p>Aggregated from Superteam, Immunefi, Code4rena, Sherlock. Ask Hermes below.</p>
  <div class="meta-row">
    <div class="meta-item"><span>{len([b for b in bounties if b["category"]=="content"])}</span>Content</div>
    <div class="meta-item"><span>{len([b for b in bounties if b["category"]=="dev"])}</span>Dev</div>
    <div class="meta-item"><span>{len([b for b in bounties if b["category"]=="smart-contract"])}</span>Smart Contract</div>
    <div class="meta-item"><span>{fetched_at[:10]}</span>Last Fetch</div>
  </div>
</div>
<div class="container">
  <div id="panel-all" class="panel active"></div>
  <div id="panel-search" class="panel">
    <div class="section-label">Live X Search</div>
    <div class="x-grid">
      <a class="x-btn" href="https://x.com/search?q=%22bounty%22+%22web3%22+%22%24%22+min_faves%3A20&f=live" target="_blank"><span class="xi">X</span> Web3 Bounty</a>
      <a class="x-btn" href="https://x.com/search?q=%22content+bounty%22+OR+%22thread+bounty%22+min_faves%3A10&f=live" target="_blank"><span class="xi">X</span> Content / Thread Bounty</a>
      <a class="x-btn" href="https://x.com/search?q=%22gitcoin%22+%22bounty%22+%22typescript%22+OR+%22react%22&f=live" target="_blank"><span class="xi">X</span> Gitcoin TS/React</a>
      <a class="x-btn" href="https://x.com/search?q=from%3Asuperteamdao+OR+from%3Aarbitrum+%22bounty%22&f=live" target="_blank"><span class="xi">X</span> Superteam / Arbitrum</a>
      <a class="x-btn" href="https://x.com/search?q=%22bug+bounty%22+%22%2410k%22+OR+%22%2450k%22&f=live" target="_blank"><span class="xi">X</span> Bug Bounty $10k+</a>
      <a class="x-btn" href="https://x.com/search?q=%22audit+contest%22+OR+%22code4rena%22+OR+%22sherlock%22&f=live" target="_blank"><span class="xi">X</span> Audit Contest</a>
    </div>
  </div>
  <div id="panel-superteam" class="panel"></div>
  <div id="panel-code4rena" class="panel"></div>
  <div id="panel-immunefi" class="panel"></div>
  <div id="panel-sherlock" class="panel"></div>
  <div id="panel-bookmarks" class="panel"></div>
</div>
<div class="footer">
  <p>Start: <code>cd ~/Desktop/bounty-hunter; python3 serve.py</code></p>
  <p style="margin-top:6px"><a href="https://superteam.fun/bounties" target="_blank">Superteam</a> . <a href="https://code4rena.com/audits" target="_blank">Code4rena</a> . <a href="https://immunefi.com/explore/" target="_blank">Immunefi</a> . <a href="https://audits.sherlock.xyz" target="_blank">Sherlock</a></p>
</div>
<div class="chat-backdrop"><div class="chat-container">
  <div id="chat-messages-panel" class="chat-messages-panel">
    <div class="chat-msg chat-assistant">Hai! Tanya soal bounty - analisa, strategi, skill yang dibutuhkan.</div>
  </div>
  <div class="chat-input-bar">
    <textarea id="chat-input" placeholder="Ask Hermes about bounties..." rows="1" onkeydown="chatKeydown(event)" oninput="autoResize(this)"></textarea>
    <button class="chat-send-btn" onclick="sendChat()">^</button>
  </div>
  <div class="chat-hint">hermes-agent . enter to send</div>
</div></div>
<script>
const bounties = {bounties_json};
let bookmarks = JSON.parse(localStorage.getItem('bounty-bookmarks') || '{bookmark_ids_json}');
let currentTab = 'all';
let currentSort = 'reward-desc';
function saveBookmarks() {{ localStorage.setItem('bounty-bookmarks', JSON.stringify(bookmarks)); }}
function toggleBookmark(e, id) {{
  e.preventDefault(); e.stopPropagation();
  const idx = bookmarks.indexOf(id);
  if (idx >= 0) bookmarks.splice(idx, 1); else bookmarks.push(id);
  saveBookmarks(); renderCurrentTab();
}}
function sortBounties(items) {{
  const s = [...items];
  switch(currentSort) {{
    case 'reward-desc': return s.sort((a,b) => (b.reward_usd||0) - (a.reward_usd||0));
    case 'reward-asc': return s.sort((a,b) => (a.reward_usd||0) - (b.reward_usd||0));
    case 'deadline': return s.sort((a,b) => {{ if (!a.deadline) return 1; if (!b.deadline) return -1; return new Date(a.deadline) - new Date(b.deadline); }});
    case 'source': return s.sort((a,b) => a.source.localeCompare(b.source));
    default: return s;
  }}
}}
function renderCards(items) {{
  if (!items.length) return '<div class="empty"><div class="empty-icon">No bounties</div></div>';
  let h = '<div class="grid">';
  items.forEach(item => {{
    const tc = {{"content":"tag-content","dev":"tag-dev","smart-contract":"tag-sc"}}[item.category] || "tag-default";
    let dl = '';
    if (item.deadline) {{ try {{ const days = Math.ceil((new Date(item.deadline) - new Date()) / 86400000); dl = days >= 0 ? '<span class="deadline-badge">'+days+'d</span>' : '<span class="deadline-badge expired">Exp</span>'; }} catch(e) {{}} }}
    const saved = bookmarks.includes(item.id);
    h += '<a class="card" href="'+item.url+'" target="_blank"><button class="bookmark-btn '+(saved?'saved':'')+'" onclick="toggleBookmark(event,\\''+item.id+'\\')">'+( saved?'\\u2605':'\\u2606')+'</button><div class="card-title">'+item.title.slice(0,60)+'</div><div class="card-meta"><span class="reward">'+item.reward+'</span>'+dl+'</div><div class="card-footer"><span class="tag '+tc+'">'+item.type+'</span>'+(item.sponsor?'<span class="source-label">'+item.sponsor+'</span>':'')+'<span class="source-label">'+item.source+'</span></div></a>';
  }});
  return h + '</div>';
}}
function renderCurrentTab() {{ switchTab(currentTab); }}
function switchTab(tab) {{
  currentTab = tab;
  document.querySelectorAll('.topbar-nav button').forEach(t => t.classList.remove('active'));
  if (event && event.target && event.target.tagName === 'BUTTON') event.target.classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  let panel, items;
  if (tab === 'search') {{ document.getElementById('panel-search').classList.add('active'); return; }}
  else if (tab === 'bookmarks') {{ panel = document.getElementById('panel-bookmarks'); items = bounties.filter(b => bookmarks.includes(b.id)); }}
  else if (tab === 'all') {{ panel = document.getElementById('panel-all'); items = bounties; }}
  else {{ panel = document.getElementById('panel-'+tab); const m={{'superteam':'Superteam Earn','code4rena':'Code4rena','immunefi':'Immunefi','sherlock':'Sherlock'}}; items = bounties.filter(b => b.source === m[tab]); }}
  panel.innerHTML = renderCards(sortBounties(items));
  panel.classList.add('active');
}}
function applySort() {{ currentSort = document.getElementById('sort-select').value; renderCurrentTab(); }}
const CHAT_API = '/api/v1/chat/completions';
let chatSessionId = 'bounty-' + Date.now();
let chatHistory = [];
let chatOpen = false;
function autoResize(el) {{ el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 100) + 'px'; }}
function addMsg(role, content) {{
  const panel = document.getElementById('chat-messages-panel');
  if (!chatOpen) {{ chatOpen = true; panel.classList.add('open'); }}
  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-' + role;
  msg.innerHTML = content.replace(/\\n/g, '<br>');
  panel.appendChild(msg);
  panel.scrollTop = panel.scrollHeight;
}}
async function sendChat() {{
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  addMsg('user', text);
  const sys = 'You are a bounty hunting assistant. Analyze bounties, suggest strategies. Be concise. Respond in Bahasa Indonesia.\\nActive bounties:\\n' + bounties.slice(0,10).map(b => b.title+' ('+b.source+') - '+b.reward).join('\\n');
  chatHistory.push({{ role: 'user', content: text }});
  addMsg('assistant', '<span class="typing">thinking...</span>');
  try {{
    const res = await fetch(CHAT_API, {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json', 'X-Hermes-Session-Id': chatSessionId }},
      body: JSON.stringify({{ model: 'hermes-agent', messages: [{{role:'system',content:sys}}, ...chatHistory], stream: false }})
    }});
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || data.error || 'No response';
    const p = document.getElementById('chat-messages-panel');
    p.removeChild(p.lastChild);
    chatHistory.push({{ role: 'assistant', content: reply }});
    addMsg('assistant', reply);
  }} catch(e) {{
    const p = document.getElementById('chat-messages-panel');
    p.removeChild(p.lastChild);
    addMsg('assistant', 'Cannot reach Hermes. Run: python3 serve.py');
  }}
}}
function chatKeydown(e) {{ if (e.key === 'Enter' && !e.shiftKey) {{ e.preventDefault(); sendChat(); }} }}
switchTab('all');
</script>
</body>
</html>'''

    HTML_FILE.write_text(html)
    print(f"Dashboard generated: {HTML_FILE}")

if __name__ == "__main__":
    data = fetch_all()
    check_new_bounties(data)
    # Sync to database
    try:
        from db import init_db, upsert_bounties
        init_db()
        upsert_bounties(data["bounties"])
    except Exception as e:
        print(f"[WARN] DB sync: {e}")
    generate_html(data)
    print("\n Done! Run: python3 serve.py")
