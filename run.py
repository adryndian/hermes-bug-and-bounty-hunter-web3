#!/usr/bin/env python3
"""All-in-one: fetch → analyze → serve dashboard."""
import subprocess
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def run(cmd, label):
    print(f"\n{'='*40}")
    print(f"  {label}")
    print(f"{'='*40}")
    result = subprocess.run([sys.executable, cmd], capture_output=False)
    return result.returncode == 0

if __name__ == "__main__":
    run("fetch_bounties.py", "1. FETCHING BOUNTIES")
    run("auto_analyze.py", "2. ANALYZING WITH HERMES AI")
    
    print(f"\n{'='*40}")
    print(f"  3. STARTING SERVER")
    print(f"{'='*40}")
    print(f"\n🚀 Open http://localhost:3333 in your browser\n")
    subprocess.run([sys.executable, "serve.py"])
