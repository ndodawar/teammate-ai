#!/bin/bash
# Run the T-5.16 probe detached, so a killed parent shell does not take it down.
#
# Usage: bash docs/t-5.16-evidence/run-probe.sh <slug> <route>
#   e.g. bash docs/t-5.16-evidence/run-probe.sh tasks /p/abc123/tasks
#
# The route is passed through as a plain positional argument. Do not route it
# through a `{code}` placeholder: bash brace expansion rewrites that token before
# node ever sees it, which silently turned every probe URL into a 404.
set -u
cd /home/nando/teammate-ai || exit 1
SLUG="${1:-tasks}"
ROUTE="${2:?route required}"
OUT="/tmp/probe-${SLUG}.json"
LOG="/tmp/probe-${SLUG}.log"
pkill -f "remote-debugging-port=9222" >/dev/null 2>&1
sleep 1
printf 'start %s route=%s\n' "$(date -Is)" "$ROUTE" >"$LOG"
timeout 170 node docs/t-5.16-evidence/tools/probe.mjs "$ROUTE" >"$OUT" 2>>"$LOG"
printf 'exit=%s\n' "$?" >>"$LOG"
printf 'done %s\n' "$(date -Is)" >>"$LOG"
