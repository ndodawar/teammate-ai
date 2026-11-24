// Diagnose the square halo around the open-state hub (T-5.16).
// Reads computed styles + captured screenshot corner pixels so the cause is
// named, not guessed.
import { spawn } from 'node:child_process';


const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const CODE = 'c7c3b1c0b05291c3c931a7d1';
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
    `--user-data-dir=/tmp/t-5.16-diag`,
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
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    sid,
  );
  await cdp.send('Page.navigate', { url: `${BASE}/p/${CODE}/tasks` }, sid);
  await sleep(4200);
  // Read the OPEN state, because that is where the square appears.
  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('.radial-trigger')?.click()` }, sid);
  await sleep(700);

  const { result } = await cdp.send(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const t = document.querySelector('.radial-trigger');
        const s = document.querySelector('.radial-sidebar');
        const scrim = document.querySelector('.radial-scrim');
        const cs = getComputedStyle(t);
        const ss = getComputedStyle(s);
        return {
          sidebar: { bg: ss.backgroundColor, backdrop: ss.backdropFilter, boxShadow: ss.boxShadow, transform: ss.transform },
          trigger: {
            bg: cs.backgroundColor, backdrop: cs.backdropFilter,
            borderRadius: cs.borderRadius, boxShadow: cs.boxShadow,
            isolation: cs.isolation, filter: cs.filter,
          },
          scrim: { z: getComputedStyle(scrim).zIndex, bg: getComputedStyle(scrim).backgroundColor, opacity: getComputedStyle(scrim).opacity },
          stackAtHub: (() => {
            const r = t.getBoundingClientRect();
            const els = document.elementsFromPoint(r.left + 6, r.top + 6);
            return els.slice(0, 6).map(e => (e.className||'').toString().slice(0,40) || e.tagName);
          })(),
          scrimRect: (() => {
            const s = document.querySelector('.radial-scrim');
            const r = s.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cs: getComputedStyle(s).backdropFilter, op: getComputedStyle(s).opacity };
          })(),
          hubPixels: (() => {
            const r = t.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          })(),
        };
      })()`,
      returnByValue: true,
    },
    sid,
  );
  console.log(JSON.stringify(result.value, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
