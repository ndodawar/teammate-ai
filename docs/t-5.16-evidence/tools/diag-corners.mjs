// Find which mobile corner the hub can occupy without covering real content.
//
// The hub is fixed and small, but the spec forbids covering buttons, forms or any
// work area. This measures each candidate position against every interactive and
// text element on the page at scroll-top, and reports the hit count per corner.
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const { webSocketDebuggerUrl } = await res.json();
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
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  });
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((res2, rej) => {
        const i = ++id;
        pending.set(i, { resolve: res2, reject: rej });
        ws.send(JSON.stringify({ id: i, method, params, sessionId: sessionId ?? undefined }));
      }),
  };
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/t-5.16-corner`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});
  for (let i = 0; i < 80; i += 1) {
    try {
      await fetch('http://127.0.0.1:9222/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }
  const cdp = await connect();
  const out = {};

  const routes = ['/', '/how-it-works', '/p/c7c3b1c0b05291c3c931a7d1/members', '/p/c7c3b1c0b05291c3c931a7d1/tasks', '/p/c7c3b1c0c05291c3c931a7d1/result'];

  for (const route of routes) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sid);
    await cdp.send('Runtime.enable', {}, sid);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
      sid,
    );
    await cdp.send('Page.navigate', { url: `${BASE}${route}` }, sid);
    await sleep(4200);

    const { result } = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const H = window.innerHeight, W = window.innerWidth, hub = 48, edge = 14;
          // Candidate hub centres for the four corners.
          const cands = {
            'top-left':     { cx: edge + hub/2, cy: edge + hub/2 },
            'top-right':    { cx: W - edge - hub/2, cy: edge + hub/2 },
            'bottom-left':  { cx: edge + hub/2, cy: H - edge - hub/2 },
            'bottom-right': { cx: W - edge - hub/2, cy: H - edge - hub/2 },
          };
          const R = hub/2 + 6;
          const nodes = [...document.querySelectorAll('a,button,input,label,h1,h2,h3,p,td,th,li')]
            .filter(el => !el.closest('.radial-sidebar') && !el.closest('.radial-scrim'));
          const res = {};
          for (const [name, c] of Object.entries(cands)) {
            let hits = 0; const sample = [];
            for (const el of nodes) {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              const nx = Math.max(r.left, Math.min(c.cx, r.right));
              const ny = Math.max(r.top, Math.min(c.cy, r.bottom));
              if (Math.hypot(nx - c.cx, ny - c.cy) <= R) {
                hits++;
                if (sample.length < 3) sample.push((el.textContent||el.tagName).trim().slice(0,24));
              }
            }
            res[name] = { hits, sample };
          }
          return res;
        })()`,
        returnByValue: true,
      },
      sid,
    );
    out[route] = result.value;
    await cdp.send('Target.closeTarget', { targetId });
  }

  console.log(JSON.stringify(out, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
