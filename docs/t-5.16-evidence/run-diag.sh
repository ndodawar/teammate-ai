#!/bin/bash
# Detached runner for the hub diagnostics.
set -u
cd /home/nando/teammate-ai || exit 1
pkill -f "remote-debugging-port=9222" >/dev/null 2>&1
sleep 2
timeout 120 node docs/t-5.16-evidence/tools/diag-hub.mjs > /tmp/diag.json 2>/tmp/diag.err
echo "exit=$?" >>/tmp/diag.err
