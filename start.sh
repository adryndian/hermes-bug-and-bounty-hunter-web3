#!/bin/bash
cd /Users/xkkkk/PROJECT/APP/bounty-hunter

# Start backend
python3 serve.py &
BACKEND_PID=$!

# Start frontend
cd app
node node_modules/vite/bin/vite.js --host &
FRONTEND_PID=$!

echo "🚀 Bounty Hunter running"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3333"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
