#!/bin/bash
# T-5.16 before/after capture runner.
#
# Chrome + the Next dev server are heavy, and the parent shell here gets killed
# on a timer, which used to take the capture run down with it. So this script is
# launched once with setsid, survives the shell, and writes progress to a log the
# agent can poll. It calls the existing T-5.14 harness one route at a time
# because the full 5-route sweep outruns a single foreground window.
set -u

cd /home/nando/teammate-ai || exit 1

LABEL="${1:-before}"
CODE="c7c3b1c0b05291c3c931a7d1"
LOG="/tmp/capture-${LABEL}.log"
: >"$LOG"

echo "start $(date -Is)" >>"$LOG"

for ROUTE in "/" "/how-it-works" "/p/{code}/members" "/p/{code}/tasks" "/p/{code}/result" "/p/{code}/members/{code}"; do
  echo "--- route $ROUTE" >>"$LOG"
  pkill -f "remote-debugging-port=9222" >/dev/null 2>&1
  sleep 1
  timeout 180 node docs/t-5.14-evidence/tools/shoot.mjs "$LABEL" "$CODE" "$ROUTE" >>"$LOG" 2>&1
  echo "exit=$?" >>"$LOG"
done

echo "done $(date -Is)" >>"$LOG"
echo "PNGS=$(ls docs/t-5.14-evidence/"$LABEL"/*.png 2>/dev/null | wc -l)" >>"$LOG"
