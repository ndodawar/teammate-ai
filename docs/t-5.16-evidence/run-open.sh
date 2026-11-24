#!/bin/bash
# Detached runner for the open-state capture. Same reason as capture.sh: the
# parent shell here is killed on a timer, and Chrome plus the dev server outlive
# one foreground window.
set -u
cd /home/nando/teammate-ai || exit 1
LOG=/tmp/open.log
: >"$LOG"
echo "start $(date -Is)" >>"$LOG"
pkill -f "remote-debugging-port=9222" >/dev/null 2>&1
sleep 2
timeout 300 node docs/t-5.16-evidence/tools/shoot-open.mjs open >>"$LOG" 2>&1
echo "exit=$?" >>"$LOG"
echo "PNGS=$(ls docs/t-5.16-evidence/open/*.png 2>/dev/null | wc -l)" >>"$LOG"
echo "done $(date -Is)" >>"$LOG"
