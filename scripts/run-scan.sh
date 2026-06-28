#!/bin/bash
# Daily scan wrapper for cron — sets PATH so node/codex/git resolve in cron's
# minimal environment, then runs the scan (which commits & pushes → Vercel).
export PATH="/Users/clawdbot/node/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="/Users/clawdbot"
cd "$HOME/dev/github-trend" || exit 1
mkdir -p logs
echo "===== scan started $(date '+%Y-%m-%d %H:%M:%S') =====" >> logs/scan.log
node scripts/scan.mjs --concurrency 4 >> logs/scan.log 2>&1
echo "===== scan exited $? $(date '+%H:%M:%S') =====" >> logs/scan.log
