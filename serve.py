#!/usr/bin/env python3
"""Local HTTP server with CORS proxy to Hermes API + DB endpoints."""
import http.server
import json
import os
import subprocess
import urllib.parse
from pathlib import Path

# --- Configuration (via .env or environment variables) ---
def _load_env():
    """Load .env file if present (simple key=value parser)."""
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_env()

PORT = int(os.environ.get("PORT", "3333"))
# LLM API endpoint (any OpenAI-compatible server: LiteLLM, Ollama, OpenRouter, etc.)
LLM_API_URL = os.environ.get("LLM_API_URL", "http://127.0.0.1:8642")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
# Default model for AI features (analyze, copilot, checklist generation)
LLM_DEFAULT_MODEL = os.environ.get("LLM_DEFAULT_MODEL", "gpt-4o-mini")
# Optional: secondary router for multi-provider setups (leave empty if not needed)
LLM_ROUTER_URL = os.environ.get("LLM_ROUTER_URL", "")
LLM_ROUTER_KEY = os.environ.get("LLM_ROUTER_KEY", "")

def llm_call(messages, model=None, max_tokens=2000, temperature=0.3, extra_headers=None):
    """Call any OpenAI-compatible LLM API via subprocess curl.
    
    Uses curl instead of urllib to avoid chunked encoding issues
    with various LLM providers. Works with any OpenAI-compatible endpoint:
    Ollama, LiteLLM, OpenRouter, vLLM, Hermes Gateway, etc.
    """
    model = model or LLM_DEFAULT_MODEL
    url, key = _resolve_endpoint(model)
    
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False
    })
    
    cmd = [
        "curl", "-s", "--max-time", "120",
        "-X", "POST", f"{url}/v1/chat/completions",
        "-H", "Content-Type: application/json",
    ]
    if key:
        cmd += ["-H", f"Authorization: Bearer {key}"]
    if extra_headers:
        for k, v in extra_headers.items():
            cmd += ["-H", f"{k}: {v}"]
    cmd += ["-d", payload]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=130)
    if result.returncode != 0:
        raise RuntimeError(f"LLM call failed: {result.stderr}")
    if not result.stdout.strip():
        raise RuntimeError("LLM returned empty response")
    return json.loads(result.stdout)


def _resolve_endpoint(model):
    """Determine which API endpoint and key to use for a given model.
    
    Routing logic (configurable via env):
    - If LLM_ROUTER_URL is set and model contains '/' (e.g. provider/model),
      route to the secondary router.
    - Otherwise, use the primary LLM_API_URL.
    """
    if LLM_ROUTER_URL and "/" in model:
        return LLM_ROUTER_URL, LLM_ROUTER_KEY
    return LLM_API_URL, LLM_API_KEY

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Hermes-Session-Id")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/db/context":
            # Return AI context from learnings
            from db import init_db, get_context_for_ai
            init_db()
            ctx = get_context_for_ai()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"context": ctx}).encode())
        elif self.path == "/db/stats":
            # Return DB stats
            from db import get_db, init_db
            init_db()
            conn = get_db()
            stats = {
                "total_bounties": conn.execute("SELECT COUNT(*) FROM bounties").fetchone()[0],
                "active_bounties": conn.execute("SELECT COUNT(*) FROM bounties WHERE is_active=1").fetchone()[0],
                "analyzed": conn.execute("SELECT COUNT(*) FROM analysis").fetchone()[0],
                "recommended": conn.execute("SELECT COUNT(*) FROM analysis WHERE verdict='recommended'").fetchone()[0],
                "learnings": conn.execute("SELECT COUNT(*) FROM learnings").fetchone()[0],
                "wins": conn.execute("SELECT COUNT(*) FROM learnings WHERE outcome='won'").fetchone()[0],
                "total_earned": conn.execute("SELECT COALESCE(SUM(reward_received),0) FROM learnings WHERE outcome='won'").fetchone()[0],
            }
            conn.close()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(stats).encode())
        elif self.path.startswith("/db/history/"):
            # Return status history for a bounty
            bounty_id = self.path.replace("/db/history/", "")
            from db import get_db, init_db
            init_db()
            conn = get_db()
            rows = conn.execute(
                "SELECT * FROM status_history WHERE bounty_id=? ORDER BY changed_at DESC",
                (bounty_id,)
            ).fetchall()
            conn.close()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps([dict(r) for r in rows]).encode())
        elif self.path == "/db/statuses":
            # Return all current statuses
            from db import get_db, init_db
            init_db()
            conn = get_db()
            rows = conn.execute("SELECT bounty_id, status FROM bounty_status").fetchall()
            conn.close()
            result = {r["bounty_id"]: r["status"] for r in rows}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        elif self.path == "/db/bookmarks":
            # Return all bookmarks
            from db import get_db, init_db
            init_db()
            conn = get_db()
            rows = conn.execute("SELECT bounty_id FROM bookmarks").fetchall()
            conn.close()
            result = [r["bounty_id"] for r in rows]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        elif self.path == "/api/bounties":
            # Return all bounties from DB
            from db import get_db, init_db
            init_db()
            conn = get_db()
            rows = conn.execute("SELECT * FROM bounties WHERE is_active=1 ORDER BY reward_usd DESC").fetchall()
            conn.close()
            result = [dict(r) for r in rows]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        elif self.path.startswith("/api/fetch-bounty-detail"):
            # Scrape bounty page and extract clean text
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            url = qs.get("url", [""])[0]
            if not url:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "content": "", "error": "Missing url parameter"}).encode())
                return
            try:
                content = None
                title = ""
                # 1. Try Jina reader (handles JS-rendered pages, SPA, etc.)
                try:
                    import requests as req
                    jina_url = f"https://r.jina.ai/{url}"
                    r = req.get(jina_url, timeout=20, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/plain"})
                    if r.status_code == 200 and len(r.text) > 200:
                        raw = r.text
                        # Extract title from Jina output
                        for line in raw.splitlines()[:5]:
                            if line.startswith("Title:"):
                                title = line.replace("Title:", "").strip()
                                break
                        # Strip Jina header lines (Title/URL Source/Markdown Content:)
                        lines = raw.splitlines()
                        body_start = 0
                        for i, line in enumerate(lines):
                            if line.startswith("Markdown Content:"):
                                body_start = i + 1
                                break
                        content = "\n".join(lines[body_start:]).strip()
                        # Clean up: remove image lines, nav links, empty lines spam
                        import re
                        clean_lines = []
                        for line in content.splitlines():
                            line = line.strip()
                            if not line: continue
                            if line.startswith("![") or line.startswith("[!["): continue
                            if re.match(r'^\[.*\]\(https?://.*\)$', line): continue
                            if len(line) < 8: continue
                            clean_lines.append(line)
                        content = "\n".join(clean_lines)
                except Exception:
                    pass
                # 2. Fall back to trafilatura
                if not content:
                    try:
                        import trafilatura
                        downloaded = trafilatura.fetch_url(url)
                        if downloaded:
                            content = trafilatura.extract(downloaded, include_comments=False, include_tables=True)
                            meta = trafilatura.extract_metadata(downloaded)
                            if meta and meta.title:
                                title = meta.title
                    except Exception:
                        pass
                # 3. Fall back to requests + BeautifulSoup
                if not content:
                    import requests as req
                    from bs4 import BeautifulSoup
                    resp = req.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
                    resp.raise_for_status()
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                        tag.decompose()
                    if not title:
                        title_tag = soup.find("title")
                        title = title_tag.get_text(strip=True) if title_tag else ""
                    content = soup.get_text(separator="\n", strip=True)
                content = (content or "")[:4000]
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "content": content, "title": title}).encode())
            except Exception as e:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "content": "", "error": str(e)}).encode())
        elif self.path == "/db/user-profile":
            # Return user profile or defaults
            from db import get_db, init_db
            init_db()
            DEFAULT_PROFILE = {
                "skills": ["TypeScript", "React", "React Native", "Next.js", "Node.js", "Content Writing"],
                "experience_level": "intermediate",
                "languages": ["Bahasa Indonesia", "English"],
                "focus_areas": ["Frontend", "Content", "Full-stack"],
                "notes": "Learning Solidity and smart contract security. Strong in TypeScript/React ecosystem."
            }
            try:
                conn = get_db()
                row = conn.execute("SELECT data FROM user_profile ORDER BY id DESC LIMIT 1").fetchone()
                conn.close()
                profile = json.loads(row["data"]) if row else DEFAULT_PROFILE
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(profile).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        elif self.path.startswith("/api/copilot/workspace"):
            # Return workspace session data (checklist, resources, notes)
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            bounty_id = qs.get("bounty_id", [""])[0]
            if not bounty_id:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "Missing bounty_id"}).encode())
                return
            try:
                from db import get_db, init_db
                init_db()
                conn = get_db()
                row = conn.execute("SELECT * FROM workspace_sessions WHERE bounty_id=?", (bounty_id,)).fetchone()
                conn.close()
                if row:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "ok": True,
                        "checklist": json.loads(row["checklist"] or "[]"),
                        "resources": json.loads(row["resources"] or "[]"),
                        "notes": row["notes"] or "",
                        "session_id": row["session_id"],
                    }).encode())
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": True, "checklist": [], "resources": [], "notes": ""}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())
        else:
            super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        if self.path == "/api/bounties/refresh":
            # Run fetch_bounties.py and return count
            import subprocess
            try:
                result = subprocess.run(
                    ["python3", "fetch_bounties.py"],
                    cwd=os.path.dirname(os.path.abspath(__file__)),
                    capture_output=True, text=True, timeout=60
                )
                from db import get_db, init_db
                init_db()
                conn = get_db()
                count = conn.execute("SELECT COUNT(*) FROM bounties WHERE is_active=1").fetchone()[0]
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "count": count}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())
            return

        if self.path.startswith("/api/") and not self.path.startswith("/api/copilot/") and not self.path.startswith("/api/draft-") and self.path != "/api/bounties/refresh":
            # Proxy LLM requests to configured endpoint
            try:
                req_data = json.loads(body)
                model = req_data.get("model", LLM_DEFAULT_MODEL)
                if model == "default":
                    model = LLM_DEFAULT_MODEL
                messages = req_data.get("messages", [])
                max_tokens = req_data.get("max_tokens", 2000)
                temperature = req_data.get("temperature", 0.7)
                
                ai_data = llm_call(messages, model=model, max_tokens=max_tokens, temperature=temperature)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(ai_data).encode())
            except Exception as e:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path == "/db/status":
            # Set bounty status
            from db import init_db, set_status
            init_db()
            data = json.loads(body)
            try:
                set_status(data["bounty_id"], data["status"], data.get("notes"))
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path == "/db/learning":
            # Record a learning
            from db import init_db, add_learning
            init_db()
            data = json.loads(body)
            try:
                add_learning(
                    bounty_id=data["bounty_id"],
                    outcome=data["outcome"],
                    reward_received=data.get("reward_received", 0),
                    time_spent=data.get("time_spent", ""),
                    what_worked=data.get("what_worked", ""),
                    what_failed=data.get("what_failed", ""),
                    lesson=data.get("lesson", "")
                )
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path == "/db/bookmark":
            # Toggle bookmark
            from db import get_db, init_db
            init_db()
            data = json.loads(body)
            try:
                conn = get_db()
                exists = conn.execute("SELECT 1 FROM bookmarks WHERE bounty_id=?", (data["bounty_id"],)).fetchone()
                if exists:
                    conn.execute("DELETE FROM bookmarks WHERE bounty_id=?", (data["bounty_id"],))
                else:
                    conn.execute("INSERT INTO bookmarks (bounty_id) VALUES (?)", (data["bounty_id"],))
                conn.commit()
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "bookmarked": not exists}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        elif self.path == "/db/user-profile":
            # Save/update user profile
            from db import get_db, init_db
            init_db()
            try:
                data = json.loads(body)
                # Validate allowed fields
                profile = {
                    "skills": data.get("skills", []),
                    "experience_level": data.get("experience_level", "intermediate"),
                    "languages": data.get("languages", []),
                    "focus_areas": data.get("focus_areas", []),
                    "notes": data.get("notes", ""),
                }
                conn = get_db()
                conn.execute("""
                    INSERT INTO user_profile (id, data, updated_at)
                    VALUES (1, ?, datetime('now'))
                    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
                """, (json.dumps(profile),))
                conn.commit()
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "profile": profile}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        elif self.path == "/api/draft-research":
            # Step 1: Deep research on a bounty — scrape detail + find related repos/docs
            data = json.loads(body)
            bounty = data.get("bounty", {})
            url = bounty.get("url", "")
            title = bounty.get("title", "")
            source = bounty.get("source", "")

            research = {"title": title, "source": source, "url": url, "content": "", "links": [], "error": None}

            # Scrape bounty page
            try:
                import requests as req
                content = ""
                # Jina reader
                try:
                    jina_url = f"https://r.jina.ai/{url}"
                    r = req.get(jina_url, timeout=25, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/plain"})
                    if r.status_code == 200 and len(r.text) > 200:
                        import re
                        raw = r.text
                        lines = raw.splitlines()
                        body_start = 0
                        for i, line in enumerate(lines):
                            if line.startswith("Markdown Content:"):
                                body_start = i + 1
                                break
                        text = "\n".join(lines[body_start:]).strip()
                        clean_lines = []
                        for line in text.splitlines():
                            line = line.strip()
                            if not line: continue
                            if line.startswith("![") or line.startswith("[!["): continue
                            if len(line) < 8: continue
                            clean_lines.append(line)
                        content = "\n".join(clean_lines)
                except Exception:
                    pass

                if not content:
                    try:
                        import trafilatura
                        downloaded = trafilatura.fetch_url(url)
                        if downloaded:
                            content = trafilatura.extract(downloaded, include_comments=False, include_tables=True) or ""
                    except Exception:
                        pass

                research["content"] = content[:6000]

                # Extract links from content (GitHub repos, docs)
                import re
                links = re.findall(r'https?://(?:github\.com|docs\.|gitlab\.com)[^\s\)\"\'>\]]+', content)
                research["links"] = list(set(links))[:10]

            except Exception as e:
                research["error"] = str(e)

            # Now ask AI to structure the research
            try:
                profile_data = {}
                try:
                    from db import get_db, init_db
                    init_db()
                    conn = get_db()
                    row = conn.execute("SELECT data FROM user_profile ORDER BY id DESC LIMIT 1").fetchone()
                    conn.close()
                    if row:
                        profile_data = json.loads(row["data"])
                except Exception:
                    pass

                prompt = f"""You are a bounty research assistant. Analyze this bounty and produce structured research notes.

BOUNTY: {title}
SOURCE: {source}
URL: {url}

SCRAPED CONTENT:
{research['content'][:4000]}

USER PROFILE:
- Skills: {', '.join(profile_data.get('skills', []))}
- Experience: {profile_data.get('experience_level', 'intermediate')}
- Focus: {', '.join(profile_data.get('focus_areas', []))}

Respond in JSON:
{{
  "scope": "What the bounty requires (2-3 sentences)",
  "requirements": ["requirement 1", "requirement 2", ...],
  "deliverables": ["deliverable 1", "deliverable 2", ...],
  "judging_criteria": ["criteria 1", "criteria 2", ...],
  "relevant_links": ["url1", "url2", ...],
  "skill_match": "How user's skills match (1-2 sentences)",
  "difficulty": "easy|medium|hard",
  "estimated_hours": number,
  "key_challenges": ["challenge 1", "challenge 2", ...],
  "recommended_approach": "Brief strategy (2-3 sentences)"
}}"""

                ai_data = llm_call(
                    [{"role": "user", "content": prompt}],
                    model=LLM_DEFAULT_MODEL, max_tokens=1500, temperature=0.3
                )
                ai_text = ai_data["choices"][0]["message"]["content"]
                import re
                json_match = re.search(r'\{[\s\S]*\}', ai_text)
                if json_match:
                    research["structured"] = json.loads(json_match.group())
                else:
                    research["structured"] = {"raw": ai_text}
            except Exception as e:
                research["ai_error"] = str(e)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "research": research}).encode())

        elif self.path == "/api/draft-generate":
            # Step 2: Generate submission draft from research
            data = json.loads(body)
            bounty = data.get("bounty", {})
            research = data.get("research", {})
            bounty_type = bounty.get("type", "bounty")

            try:
                profile_data = {}
                try:
                    from db import get_db, init_db
                    init_db()
                    conn = get_db()
                    row = conn.execute("SELECT data FROM user_profile ORDER BY id DESC LIMIT 1").fetchone()
                    conn.close()
                    if row:
                        profile_data = json.loads(row["data"])
                except Exception:
                    pass

                structured = research.get("structured", {})

                prompt = f"""You are a professional bounty submission writer. Generate a complete submission draft.

BOUNTY: {bounty.get('title', '')}
TYPE: {bounty_type}
SOURCE: {bounty.get('source', '')}
REWARD: {bounty.get('reward', '')}

RESEARCH:
- Scope: {structured.get('scope', 'N/A')}
- Requirements: {json.dumps(structured.get('requirements', []))}
- Deliverables: {json.dumps(structured.get('deliverables', []))}
- Judging criteria: {json.dumps(structured.get('judging_criteria', []))}
- Recommended approach: {structured.get('recommended_approach', 'N/A')}

USER PROFILE:
- Skills: {', '.join(profile_data.get('skills', []))}
- Experience: {profile_data.get('experience_level', 'intermediate')}
- Languages: {', '.join(profile_data.get('languages', []))}
- Notes: {profile_data.get('notes', '')}

Write a submission draft in markdown format that:
1. Addresses all requirements and deliverables
2. Highlights relevant experience/skills
3. Proposes a clear approach/timeline
4. Is professional but concise
5. Matches the platform style ({bounty.get('source', 'general')})

For bug bounty type: focus on methodology, tools, and areas of investigation.
For development type: focus on technical approach, architecture, and timeline.
For content type: focus on content plan, distribution strategy, and samples.

Output the draft in markdown. Start with a brief intro, then structured sections."""

                ai_data = llm_call(
                    [{"role": "user", "content": prompt}],
                    model=LLM_DEFAULT_MODEL, max_tokens=2500, temperature=0.4
                )
                draft_text = ai_data["choices"][0]["message"]["content"]

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "draft": draft_text}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        elif self.path == "/api/draft-verify":
            # Step 3: Verify draft against requirements
            data = json.loads(body)
            draft_text = data.get("draft", "")
            research = data.get("research", {})
            structured = research.get("structured", {})

            try:
                prompt = f"""You are a submission quality checker. Review this draft against the bounty requirements.

REQUIREMENTS: {json.dumps(structured.get('requirements', []))}
DELIVERABLES: {json.dumps(structured.get('deliverables', []))}
JUDGING CRITERIA: {json.dumps(structured.get('judging_criteria', []))}

DRAFT:
{draft_text[:3000]}

Respond in JSON:
{{
  "score": 1-10,
  "checklist": [
    {{"item": "requirement text", "met": true/false, "note": "brief note"}},
    ...
  ],
  "suggestions": ["improvement 1", "improvement 2", ...],
  "missing": ["what's missing 1", ...],
  "ready_to_submit": true/false
}}"""

                ai_data = llm_call(
                    [{"role": "user", "content": prompt}],
                    model=LLM_DEFAULT_MODEL, max_tokens=1500, temperature=0.2
                )
                ai_text = ai_data["choices"][0]["message"]["content"]
                import re
                json_match = re.search(r'\{[\s\S]*\}', ai_text)
                if json_match:
                    verification = json.loads(json_match.group())
                else:
                    verification = {"raw": ai_text}

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "verification": verification}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        elif self.path == "/api/copilot/chat":
            # Co-pilot chat: routed to Hermes API Server with dedicated session per bounty
            data = json.loads(body)
            bounty_id = data.get("bounty_id", "")
            message = data.get("message", "")
            model = data.get("model", LLM_DEFAULT_MODEL)

            if not bounty_id or not message:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": "Missing bounty_id or message"}).encode())
                return

            try:
                from db import get_db, init_db
                init_db()
                conn = get_db()

                # Get or create workspace session
                session_row = conn.execute("SELECT * FROM workspace_sessions WHERE bounty_id=?", (bounty_id,)).fetchone()
                if not session_row:
                    session_id = f"bounty-{bounty_id[:16]}"
                    conn.execute("""
                        INSERT INTO workspace_sessions (bounty_id, session_id) VALUES (?, ?)
                    """, (bounty_id, session_id))
                    conn.commit()
                else:
                    session_id = session_row["session_id"]

                # Build context from bounty + research + checklist
                bounty_row = conn.execute("SELECT * FROM bounties WHERE id=?", (bounty_id,)).fetchone()
                analysis_row = conn.execute("SELECT * FROM analysis WHERE bounty_id=?", (bounty_id,)).fetchone()
                ws_row = conn.execute("SELECT * FROM workspace_sessions WHERE bounty_id=?", (bounty_id,)).fetchone()

                context_parts = []
                if bounty_row:
                    context_parts.append(f"BOUNTY: {bounty_row['title']}\nSource: {bounty_row['source']}\nReward: {bounty_row['reward']}\nDeadline: {bounty_row['deadline'] or 'Ongoing'}\nURL: {bounty_row['url']}")
                if analysis_row:
                    context_parts.append(f"ANALYSIS: Score {analysis_row['match_score']}/10, Verdict: {analysis_row['verdict']}\nStrategy: {analysis_row['strategy']}\nSummary: {analysis_row['summary']}")
                if ws_row:
                    checklist = json.loads(ws_row["checklist"] or "[]")
                    resources = json.loads(ws_row["resources"] or "[]")
                    if checklist:
                        cl_text = "\n".join([f"  {'✅' if t.get('done') else '☐'} {t.get('text','')}" for t in checklist])
                        context_parts.append(f"CHECKLIST:\n{cl_text}")
                    if resources:
                        res_text = "\n".join([f"  - {r.get('label','')}: {r.get('url','')}" for r in resources])
                        context_parts.append(f"RESOURCES:\n{res_text}")
                    if ws_row["notes"]:
                        context_parts.append(f"NOTES:\n{ws_row['notes']}")

                # Load user profile
                profile_row = conn.execute("SELECT data FROM user_profile ORDER BY id DESC LIMIT 1").fetchone()
                if profile_row:
                    profile = json.loads(profile_row["data"])
                    context_parts.append(f"USER PROFILE: Skills: {', '.join(profile.get('skills',[]))}, Level: {profile.get('experience_level','')}")

                conn.close()

                system_prompt = f"""You are a bounty hunting co-pilot. You help the user complete Web3 bounties by providing guidance, generating code, reviewing work, and suggesting next steps.

You have full context of the current bounty being worked on:

{chr(10).join(context_parts)}

Be concise, actionable, and specific to this bounty. Respond in the user's language (Bahasa Indonesia if they write in Indonesian)."""

                # Call LLM with bounty context
                extra_hdrs = {}
                if LLM_API_KEY:
                    # Support Hermes session isolation if using Hermes Gateway
                    extra_hdrs["X-Hermes-Session-Id"] = session_id
                
                ai_data = llm_call(
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message}
                    ],
                    model=model, max_tokens=2000, temperature=0.7,
                    extra_headers=extra_hdrs if extra_hdrs else None
                )
                reply = ai_data["choices"][0]["message"]["content"]

                # Log action
                from db import get_db, init_db
                init_db()
                conn = get_db()
                tokens = ai_data.get("usage", {}).get("total_tokens", 0)
                conn.execute("""
                    INSERT INTO copilot_actions (bounty_id, action, prompt, response, model, tokens_used)
                    VALUES (?, 'chat', ?, ?, ?, ?)
                """, (bounty_id, message, reply, model, tokens))
                conn.commit()
                conn.close()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "reply": reply, "session_id": session_id}).encode())

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        elif self.path == "/api/copilot/checklist":
            # Update checklist for a bounty workspace
            data = json.loads(body)
            bounty_id = data.get("bounty_id", "")
            checklist = data.get("checklist", [])
            try:
                from db import get_db, init_db
                init_db()
                conn = get_db()
                conn.execute("""
                    UPDATE workspace_sessions SET checklist=?, updated_at=datetime('now') WHERE bounty_id=?
                """, (json.dumps(checklist), bounty_id))
                conn.commit()
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        elif self.path == "/api/copilot/resources":
            # Update resources for a bounty workspace
            data = json.loads(body)
            bounty_id = data.get("bounty_id", "")
            resources = data.get("resources", [])
            try:
                from db import get_db, init_db
                init_db()
                conn = get_db()
                conn.execute("""
                    UPDATE workspace_sessions SET resources=?, updated_at=datetime('now') WHERE bounty_id=?
                """, (json.dumps(resources), bounty_id))
                conn.commit()
                conn.close()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        elif self.path == "/api/copilot/generate-checklist":
            # AI generates checklist from research/analysis
            data = json.loads(body)
            bounty_id = data.get("bounty_id", "")
            try:
                from db import get_db, init_db
                init_db()
                conn = get_db()
                bounty_row = conn.execute("SELECT * FROM bounties WHERE id=?", (bounty_id,)).fetchone()
                analysis_row = conn.execute("SELECT * FROM analysis WHERE bounty_id=?", (bounty_id,)).fetchone()
                conn.close()

                prompt = f"""Generate a practical checklist of 5-8 tasks for completing this bounty.

BOUNTY: {bounty_row['title'] if bounty_row else 'Unknown'}
TYPE: {bounty_row['type'] if bounty_row else 'Unknown'}
SOURCE: {bounty_row['source'] if bounty_row else 'Unknown'}
STRATEGY: {analysis_row['strategy'] if analysis_row else 'N/A'}
SKILLS NEEDED: {analysis_row['skills_needed'] if analysis_row else 'N/A'}

Return JSON array only:
[{{"text": "task description", "done": false}}, ...]

Tasks should be specific, actionable, and ordered logically. Include setup, implementation, testing, and submission prep."""

                ai_data = llm_call(
                    [{"role": "user", "content": prompt}],
                    model=LLM_DEFAULT_MODEL, max_tokens=1000, temperature=0.3
                )
                ai_text = ai_data["choices"][0]["message"]["content"]
                import re
                json_match = re.search(r'\[[\s\S]*\]', ai_text)
                if json_match:
                    checklist = json.loads(json_match.group())
                else:
                    checklist = [{"text": "Review bounty requirements", "done": False}]

                # Save to workspace
                from db import get_db, init_db
                init_db()
                conn = get_db()
                # Ensure workspace session exists
                existing = conn.execute("SELECT 1 FROM workspace_sessions WHERE bounty_id=?", (bounty_id,)).fetchone()
                if not existing:
                    conn.execute("INSERT INTO workspace_sessions (bounty_id, session_id) VALUES (?, ?)",
                                (bounty_id, f"bounty-{bounty_id[:16]}"))
                conn.execute("UPDATE workspace_sessions SET checklist=?, updated_at=datetime('now') WHERE bounty_id=?",
                            (json.dumps(checklist), bounty_id))
                conn.commit()
                conn.close()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True, "checklist": checklist}).encode())

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress default logging noise
        pass

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"🚀 Bounty Hunter running at http://localhost:{PORT}")
    print(f"   LLM endpoint: {LLM_API_URL}")
    print(f"   Default model: {LLM_DEFAULT_MODEL}")
    if LLM_ROUTER_URL:
        print(f"   Router: {LLM_ROUTER_URL}")
    print(f"   DB endpoints: /db/status, /db/learning, /db/bookmark, /db/context, /db/stats")
    print(f"   Press Ctrl+C to stop")
    server.serve_forever()
