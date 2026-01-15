#!/bin/zsh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/src" || exit 1
npm run dev & DEV_PID=$!

until curl -s http://localhost:3000 >/dev/null; do
  sleep 0.5
done

open -a "Google Chrome" "http://localhost:3000"
wait $DEV_PID
