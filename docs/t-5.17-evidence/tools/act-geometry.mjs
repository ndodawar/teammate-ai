// Diagnostic: the ledger's act geometry vs the real document position.
//
// The engine measures `a.top` at layout time and drives `p` from it. When the
// previous section is itself a pinned story whose track height is set by
// JavaScript (or by a client mount a beat after the engine's own measure), the
// engine's `top` can be stale by a whole viewport — the act then reads p=1 the
// moment it enters, which shows the reader a finished ledger instead of a
// count. This prints both numbers side by side so the drift is visible.
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const PORT = 9800 + Math.floor(Math.random() * 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(port) {
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) {
        p.reject(new Error(JSON.stringify(m.error)));
      } else {
        p.resolve(m.result);
      }
    }
  });
  return {
    send: (m, p = {}, sessionId) =>
      new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId }));
      }),
  };
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/geo-${PORT}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});
  for (let i = 0; i < 150; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      break;
    } catch {
      await sleep(200);
    }
  }
  const cdp = await connect(PORT);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sid);
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Sample the engine's measured top at three moments, because the whole
  // question is whether it was measured before the page finished settling.
  await S('Page.navigate', { url: 'http://localhost:3000/' });
  const reads = [];
  for (const delay of [1200, 2500, 5000, 9000]) {
    await sleep(delay - (reads[reads.length - 1]?.delay ?? 0));
    const v = await S('Runtime.evaluate', {
      expression: `(() => {
        const g = window.ScrollCraft;
        const api = g && g.instances && g.instances[0];
        const act = document.getElementById('scoring');
        const rec = api && api.acts ? api.acts.find((a) => a.el === act) : null;
        const absTop = act ? Math.round(act.getBoundingClientRect().top + scrollY) : null;
        return {
          engineTop: rec ? Math.round(rec.top) : null,
          engineHeight: rec ? Math.round(rec.height) : null,
          realTop: absTop,
          docHeight: document.documentElement.scrollHeight,
          prevStoryHeight: (() => {
            const s = document.getElementById('cara-kerja');
            return s ? Math.round(s.getBoundingClientRect().height) : null;
          })(),
        };
      })()`,
      returnByValue: true,
    });
    reads.push({ delay, ...v.result.value });
  }

  console.log(JSON.stringify(reads, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
