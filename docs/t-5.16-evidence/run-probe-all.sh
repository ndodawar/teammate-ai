#!/bin/bash
# Probe every route in sequence, detached. One Chrome launch per route because
# the probe exits the browser when it finishes.
set -u
cd /home/nando/teammate-ai || exit 1
CODE=c7c3b1c0b05291c3c931a7d1
LOG=/tmp/probe-all.log
: >"$LOG"
echo "start $(date -Is)" >>"$LOG"

run() {
  local slug="$1" route="$2"
  echo "--- $slug $route" >>"$LOG"
  pkill -f "remote-debugging-port=9222" >/dev/null 2>&1
  sleep 2
  timeout 170 node docs/t-5.16-evidence/tools/probe.mjs "$route" >"/tmp/probe-${slug}.json" 2>>"$LOG"
  echo "exit=$?" >>"$LOG"
}

run tasks   "/p/$CODE/tasks"
run members "/p/$CODE/members"
run result  "/p/$CODE/result"
run home    "/"
run how     "/how-it-works"

echo "done $(date -Is)" >>"$LOG"
